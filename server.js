const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for in-memory file uploads (max 15MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, and XLS files are allowed'));
    }
  }
});

// In-memory Job store for real-time progress & SSE streaming
const jobs = new Map();

// Helper: Basic Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: Create Nodemailer Transporter
function createTransporter(user, pass) {
  const cleanUser = (user || process.env.GMAIL_USER || '').trim();
  const cleanPass = (pass || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!cleanUser || !cleanPass) {
    throw new Error('Gmail address and App Password are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: cleanUser,
      pass: cleanPass
    }
  });
}

// Helper: Convert plain text email body to clean HTML with clickable links
function textToHtml(text) {
  if (!text) return '';
  // Escape HTML tags to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert URLs into clickable styled links
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const linked = escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${url}</a>`;
  });

  // Convert paragraphs and line breaks
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937; max-width: 650px;">
      ${linked.replace(/\n/g, '<br/>')}
    </div>
  `;
}

// ---------------- API ENDPOINTS ---------------- //

// 1. Get Environment Config Status
app.get('/api/config', (req, res) => {
  const hasEnvUser = Boolean(process.env.GMAIL_USER && process.env.GMAIL_USER.trim());
  const hasEnvPass = Boolean(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.trim());
  
  res.json({
    hasEnvCredentials: hasEnvUser && hasEnvPass,
    envUser: hasEnvUser ? process.env.GMAIL_USER.trim() : null,
    defaultDelaySeconds: Number(process.env.DEFAULT_DELAY_SECONDS) || 3
  });
});

// 2. Test / Verify SMTP Connection
app.post('/api/verify-smtp', async (req, res) => {
  try {
    const { gmailUser, gmailAppPassword } = req.body;
    const transporter = createTransporter(gmailUser, gmailAppPassword);
    await transporter.verify();
    res.json({ success: true, message: 'SMTP credentials verified successfully! Connected to Gmail.' });
  } catch (error) {
    let friendlyMessage = error.message;
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      friendlyMessage = 'Authentication failed. Please check your Gmail address and 16-character App Password. Ensure 2-Step Verification is active on your Google Account.';
    }
    res.status(400).json({ success: false, error: friendlyMessage });
  }
});

// 3. Upload & Parse CSV or XLSX File
app.post('/api/parse-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Uploaded file has no sheets or data' });
    }

    const sheet = workbook.Sheets[sheetName];
    // Parse to JSON array of objects
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded file appears to be empty' });
    }

    // Get list of columns from the first row keys
    const columns = Object.keys(rawRows[0]);

    // Detect email column:
    // 1. Exact match on standard names
    let detectedEmailColumn = columns.find(col => /^(e[-_]?mail|mail|email[-_]?address|contact[-_]?email|to)$/i.test(col.trim()));

    // 2. Contains "email" or "mail"
    if (!detectedEmailColumn) {
      detectedEmailColumn = columns.find(col => /email|mail/i.test(col.trim()));
    }

    // 3. Scan cell values in each column for valid email format
    if (!detectedEmailColumn) {
      for (const col of columns) {
        const hasEmails = rawRows.slice(0, 15).some(row => EMAIL_REGEX.test(String(row[col] || '').trim()));
        if (hasEmails) {
          detectedEmailColumn = col;
          break;
        }
      }
    }

    // Fallback to first column if still undetected
    if (!detectedEmailColumn && columns.length > 0) {
      detectedEmailColumn = columns[0];
    }

    // Count valid email entries
    let validCount = 0;
    if (detectedEmailColumn) {
      rawRows.forEach(row => {
        const val = String(row[detectedEmailColumn] || '').trim();
        if (EMAIL_REGEX.test(val)) validCount++;
      });
    }

    res.json({
      success: true,
      fileName: req.file.originalname,
      sheetName,
      columns,
      detectedEmailColumn,
      totalRows: rawRows.length,
      validEmailCount: validCount,
      sampleRows: rawRows.slice(0, 5),
      rows: rawRows
    });
  } catch (error) {
    console.error('File parsing error:', error);
    res.status(500).json({ error: `Failed to parse file: ${error.message}` });
  }
});

// 3b. Parse Raw Text / Notepad Emails
app.post('/api/parse-text-emails', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'No text provided' });
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const seen = new Set();
    const valid = [];
    let duplicates = 0;
    let invalid = 0;

    lines.forEach(line => {
      const tokens = line.split(/[,\s;]+/).map(t => t.trim()).filter(Boolean);
      tokens.forEach(email => {
        if (EMAIL_REGEX.test(email)) {
          const lower = email.toLowerCase();
          if (seen.has(lower)) {
            duplicates++;
          } else {
            seen.add(lower);
            valid.push(email);
          }
        } else {
          invalid++;
        }
      });
    });

    const rows = valid.map(e => ({ Email: e }));

    res.json({
      success: true,
      fileName: 'Pasted Emails (Notepad)',
      sheetName: 'Notepad',
      columns: ['Email'],
      detectedEmailColumn: 'Email',
      totalRows: valid.length,
      validEmailCount: valid.length,
      duplicateCount: duplicates,
      invalidCount: invalid,
      totalLines: lines.length,
      sampleRows: rows.slice(0, 5),
      rows
    });
  } catch (error) {
    console.error('Text parsing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Create Sending Job
app.post('/api/jobs', (req, res) => {
  try {
    const {
      recipients,
      emailColumn,
      subject,
      body,
      delaySeconds = 3,
      skipDuplicates = true,
      isDryRun = false,
      attachment = null,
      gmailUser,
      gmailAppPassword
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list is empty' });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject cannot be empty' });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body cannot be empty' });
    }

    // Prepare and sanitize email list
    const preparedList = [];
    const seenEmails = new Set();

    recipients.forEach((row, idx) => {
      let email = '';
      if (typeof row === 'string') {
        email = row.trim();
      } else if (typeof row === 'object' && row !== null) {
        email = String(row[emailColumn] || row.email || row.Email || '').trim();
      }

      const isValid = EMAIL_REGEX.test(email);
      const isDuplicate = seenEmails.has(email.toLowerCase());

      if (skipDuplicates && isDuplicate) {
        return; // skip duplicate
      }

      if (isValid) {
        seenEmails.add(email.toLowerCase());
      }

      preparedList.push({
        id: idx + 1,
        email,
        isValid,
        data: typeof row === 'object' ? row : { email },
        status: isValid ? 'queued' : 'invalid_email',
        error: isValid ? null : 'Invalid email format'
      });
    });

    const validItems = preparedList.filter(item => item.isValid);
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found in the selected column' });
    }

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      status: 'ready', // ready, running, paused, stopped, completed
      total: preparedList.length,
      validTotal: validItems.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: preparedList.length - validItems.length,
      currentIndex: 0,
      items: preparedList,
      subject,
      body,
      delaySeconds: Math.max(1, Number(delaySeconds) || 3),
      isDryRun: Boolean(isDryRun),
      attachment: attachment && attachment.filename && attachment.data ? attachment : null,
      credentials: {
        gmailUser: gmailUser || process.env.GMAIL_USER,
        gmailAppPassword: gmailAppPassword || process.env.GMAIL_APP_PASSWORD
      },
      clients: new Set(),
      logs: [],
      startTime: null,
      endTime: null
    };

    jobs.set(jobId, job);

    res.json({
      success: true,
      jobId,
      total: job.total,
      validTotal: job.validTotal,
      delaySeconds: job.delaySeconds
    });
  } catch (error) {
    console.error('Job creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Broadcast SSE event to all connected clients for a job
function broadcastJobEvent(job, eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.clients) {
    try {
      client.write(message);
    } catch (e) {
      // client disconnected
    }
  }
}

// Helper: Perform template variable replacement (e.g. {{Company}}, {{HR Name}}, etc.)
function replacePlaceholders(template, rowData) {
  if (!template || !rowData) return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    // Search exact key or case-insensitive key
    if (rowData[trimmedKey] !== undefined && rowData[trimmedKey] !== '') {
      return String(rowData[trimmedKey]);
    }
    const foundKey = Object.keys(rowData).find(k => k.toLowerCase() === trimmedKey.toLowerCase());
    if (foundKey && rowData[foundKey] !== undefined && rowData[foundKey] !== '') {
      return String(rowData[foundKey]);
    }
    // Return empty string or fallback gracefully
    return match;
  });
}

// 5. Connect SSE Stream and start sending
app.get('/api/jobs/:jobId/stream', async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).send('Job not found');
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  job.clients.add(res);

  // Initial state notification
  res.write(`event: init\ndata: ${JSON.stringify({
    jobId: job.id,
    status: job.status,
    total: job.total,
    validTotal: job.validTotal,
    sentCount: job.sentCount,
    failedCount: job.failedCount,
    items: job.items
  })}\n\n`);

  req.on('close', () => {
    job.clients.delete(res);
  });

  // If job hasn't started yet, kick it off
  if (job.status === 'ready') {
    startSendingJob(job);
  }
});

// Runner: Send Emails sequentially with delay
async function startSendingJob(job) {
  job.status = 'running';
  job.startTime = new Date();

  broadcastJobEvent(job, 'job_start', {
    status: 'running',
    message: `Starting cold email campaign to ${job.validTotal} recipients...`
  });

  let transporter;
  if (!job.isDryRun) {
    try {
      transporter = createTransporter(job.credentials.gmailUser, job.credentials.gmailAppPassword);
      await transporter.verify();
    } catch (err) {
      job.status = 'error';
      const errMessage = `SMTP connection failed: ${err.message}`;
      job.logs.push({ time: new Date().toLocaleTimeString(), type: 'error', message: errMessage });
      broadcastJobEvent(job, 'job_error', { error: errMessage });
      return;
    }
  } else {
    job.logs.push({ time: new Date().toLocaleTimeString(), type: 'info', message: 'Campaign running in DRY RUN (Simulation) mode. No real emails will be sent.' });
  }

  for (let i = 0; i < job.items.length; i++) {
    // Check if job was cancelled / stopped
    if (job.status === 'stopped') {
      broadcastJobEvent(job, 'job_stopped', {
        message: 'Campaign stopped by user.',
        sentCount: job.sentCount,
        failedCount: job.failedCount
      });
      break;
    }

    const item = job.items[i];
    job.currentIndex = i;

    if (!item.isValid) {
      continue;
    }

    // Interpolate placeholders for subject and body
    const personalizedSubject = replacePlaceholders(job.subject, item.data);
    const personalizedBody = replacePlaceholders(job.body, item.data);
    const htmlBody = textToHtml(personalizedBody);

    broadcastJobEvent(job, 'item_sending', {
      index: i,
      id: item.id,
      email: item.email
    });

    try {
      let info;
      if (job.isDryRun) {
        // Simulate sending delay
        await new Promise(r => setTimeout(r, 400));
        info = { messageId: `dry-run-${Date.now()}-${item.id}` };
      } else {
        const mailOptions = {
          from: `"${job.credentials.gmailUser.split('@')[0]}" <${job.credentials.gmailUser}>`,
          to: item.email,
          subject: personalizedSubject,
          text: personalizedBody,
          html: htmlBody
        };

        if (job.attachment && job.attachment.filename && job.attachment.data) {
          mailOptions.attachments = [
            {
              filename: job.attachment.filename,
              content: Buffer.from(job.attachment.data, 'base64'),
              contentType: job.attachment.contentType || 'application/octet-stream'
            }
          ];
        }

        info = await transporter.sendMail(mailOptions);
      }

      item.status = 'sent';
      item.messageId = info.messageId;
      job.sentCount++;

      const logMsg = job.isDryRun
        ? `[${job.sentCount + job.failedCount}/${job.validTotal}] [SIMULATED] Sent to: ${item.email}`
        : `[${job.sentCount + job.failedCount}/${job.validTotal}] Sent to: ${item.email}`;
      job.logs.push({ time: new Date().toLocaleTimeString(), type: 'success', message: logMsg });

      broadcastJobEvent(job, 'item_success', {
        index: i,
        id: item.id,
        email: item.email,
        sentCount: job.sentCount,
        failedCount: job.failedCount,
        message: logMsg
      });

    } catch (sendErr) {
      item.status = 'failed';
      item.error = sendErr.message;
      job.failedCount++;

      const logMsg = `[${job.sentCount + job.failedCount}/${job.validTotal}] Failed to send to: ${item.email} (${sendErr.message})`;
      job.logs.push({ time: new Date().toLocaleTimeString(), type: 'error', message: logMsg });

      broadcastJobEvent(job, 'item_failure', {
        index: i,
        id: item.id,
        email: item.email,
        sentCount: job.sentCount,
        failedCount: job.failedCount,
        error: sendErr.message,
        message: logMsg
      });
    }

    // Apply anti-spam delay if there are more valid items remaining
    const remainingValid = job.items.slice(i + 1).filter(it => it.isValid).length;
    if (remainingValid > 0 && job.status === 'running') {
      broadcastJobEvent(job, 'waiting_delay', {
        seconds: job.delaySeconds,
        nextIndex: i + 1
      });
      await new Promise(resolve => setTimeout(resolve, job.delaySeconds * 1000));
    }
  }

  // Clean up sensitive row data and attachment from memory immediately after campaign run
  job.items.forEach(it => {
    delete it.data; // Wipe all spreadsheet row details from memory
  });
  if (job.attachment) {
    delete job.attachment; // Wipe attached file/image from memory immediately
  }

  if (job.status !== 'stopped') {
    job.status = 'completed';
    job.endTime = new Date();
    const durationSec = Math.round((job.endTime - job.startTime) / 1000);

    broadcastJobEvent(job, 'job_completed', {
      status: 'completed',
      sentCount: job.sentCount,
      failedCount: job.failedCount,
      total: job.validTotal,
      durationSeconds: durationSec,
      message: `Completed! ${job.sentCount} sent successfully, ${job.failedCount} failed in ${durationSec}s. Spreadsheet data purged from memory.`
    });
  }

  // Auto-purge the job record completely from server memory after 15 minutes
  setTimeout(() => {
    jobs.delete(job.id);
  }, 15 * 60 * 1000);
}

// 6. Stop / Cancel a Job
app.post('/api/jobs/:jobId/stop', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  job.status = 'stopped';
  res.json({ success: true, message: 'Job stopped' });
});

// 7. Get Job Summary / Export Results
app.get('/api/jobs/:jobId/report', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    validTotal: job.validTotal,
    sentCount: job.sentCount,
    failedCount: job.failedCount,
    startTime: job.startTime,
    endTime: job.endTime,
    items: job.items,
    logs: job.logs
  });
});

// 8. Serve Sample CSV
app.get('/api/sample-csv', (req, res) => {
  const samplePath = path.join(__dirname, 'sample_contacts.csv');
  res.download(samplePath, 'sample_contacts.csv');
});

// 9. Serve Sample XLSX
app.get('/api/sample-xlsx', (req, res) => {
  const samplePath = path.join(__dirname, 'sample_contacts.xlsx');
  res.download(samplePath, 'sample_contacts.xlsx');
});

// 10. Serve Flowchart Markdown
app.get('/api/download-flowchart-md', (req, res) => {
  const mdPath = path.join(__dirname, 'FLOWCHART.md');
  res.download(mdPath, 'FLOWCHART.md');
});

// ---------------- LINKEDIN SCRAPER APIS ---------------- //
const linkedinScraper = require('./linkedinScraper');

// Get LinkedIn Authentication Status
app.get('/api/linkedin/status', async (req, res) => {
  try {
    const status = await linkedinScraper.getSessionStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Launch Interactive Browser Login Window
app.post('/api/linkedin/login-interactive', async (req, res) => {
  try {
    const result = await linkedinScraper.startInteractiveLogin();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Cancel Interactive Login
app.post('/api/linkedin/login-cancel', async (req, res) => {
  try {
    const result = await linkedinScraper.cancelInteractiveLogin();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Manual Cookie (li_at)
app.post('/api/linkedin/save-cookie', async (req, res) => {
  try {
    const { liAtCookie } = req.body;
    const result = await linkedinScraper.saveManualCookie(liAtCookie);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Clear LinkedIn Session / Logout
app.post('/api/linkedin/logout', (req, res) => {
  linkedinScraper.clearStoredSession();
  res.json({ success: true, message: 'Logged out from LinkedIn.' });
});

// Scrape LinkedIn Posts
app.post('/api/linkedin/scrape', async (req, res) => {
  try {
    const { targetUrl, postLimit = 10 } = req.body;
    const result = await linkedinScraper.scrapeLinkedInPosts({
      targetUrl,
      postLimit: Number(postLimit) || 10,
      onProgress: (p) => {
        // Can be logged if needed
      }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Auto Cold Email Sender is running!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
