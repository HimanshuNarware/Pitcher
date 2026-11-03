// Auto Cold Email Sender - Frontend Logic

let appConfig = {
  hasEnvCredentials: false,
  envUser: null,
  defaultDelaySeconds: 3
};

let currentFileData = null;
let activeEventSource = null;
let currentJobId = null;
let delayTimerInterval = null;

// DOM Elements
const smtpStatusBadge = document.getElementById('smtpStatusBadge');
const smtpStatusText = document.getElementById('smtpStatusText');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const settingsModal = document.getElementById('settingsModal');
const inputGmailUser = document.getElementById('inputGmailUser');
const inputGmailPass = document.getElementById('inputGmailPass');
const togglePassVisibility = document.getElementById('togglePassVisibility');
const testSmtpBtn = document.getElementById('testSmtpBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const verifyFeedback = document.getElementById('verifyFeedback');
const envStatusAlertText = document.getElementById('envStatusAlertText');

// Mode Switch & Containers
const tabModeFileBtn = document.getElementById('tabModeFileBtn');
const tabModeNotepadBtn = document.getElementById('tabModeNotepadBtn');
const fileModeContainer = document.getElementById('fileModeContainer');
const notepadModeContainer = document.getElementById('notepadModeContainer');
const sharedDataPanel = document.getElementById('sharedDataPanel');

// File Upload Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfoPanel = document.getElementById('fileInfoPanel');
const uploadedFileName = document.getElementById('uploadedFileName');
const uploadedFileStats = document.getElementById('uploadedFileStats');
const removeFileBtn = document.getElementById('removeFileBtn');
const emailColumnSelect = document.getElementById('emailColumnSelect');

// Notepad Elements
const notepadTextarea = document.getElementById('notepadTextarea');
const notepadPasteBtn = document.getElementById('notepadPasteBtn');
const notepadCleanBtn = document.getElementById('notepadCleanBtn');
const notepadSampleBtn = document.getElementById('notepadSampleBtn');
const notepadClearBtn = document.getElementById('notepadClearBtn');
const notepadTotalLines = document.getElementById('notepadTotalLines');
const notepadValidEmails = document.getElementById('notepadValidEmails');
const notepadDuplicateEmails = document.getElementById('notepadDuplicateEmails');

// Shared Table & Counters
const totalRowsCount = document.getElementById('totalRowsCount');
const validEmailsCount = document.getElementById('validEmailsCount');
const previewTable = document.getElementById('previewTable');

const delaySeconds = document.getElementById('delaySeconds');
const delayBadge = document.getElementById('delayBadge');
const skipDuplicatesCheck = document.getElementById('skipDuplicatesCheck');
const dryRunCheck = document.getElementById('dryRunCheck');

const tabEditBtn = document.getElementById('tabEditBtn');
const tabPreviewBtn = document.getElementById('tabPreviewBtn');
const editModeContainer = document.getElementById('editModeContainer');
const previewModeContainer = document.getElementById('previewModeContainer');
const emailSubject = document.getElementById('emailSubject');
const emailBody = document.getElementById('emailBody');
const renderedSubjectPreview = document.getElementById('renderedSubjectPreview');
const renderedSenderPreview = document.getElementById('renderedSenderPreview');
const renderedHtmlBody = document.getElementById('renderedHtmlBody');

// Attachment Elements
const imageUploadBox = document.getElementById('imageUploadBox');
const imageFileInput = document.getElementById('imageFileInput');
const imagePreviewChip = document.getElementById('imagePreviewChip');
const imageThumbnail = document.getElementById('imageThumbnail');
const imageFileName = document.getElementById('imageFileName');
const imageFileSize = document.getElementById('imageFileSize');
const removeImageBtn = document.getElementById('removeImageBtn');
const renderedAttachmentPreview = document.getElementById('renderedAttachmentPreview');
const renderedAttachmentName = document.getElementById('renderedAttachmentName');
const renderedAttachmentImage = document.getElementById('renderedAttachmentImage');

let activeInputMode = 'file'; // 'file' or 'notepad'
let currentAttachment = null; // { filename, data, contentType, sizeText, isImage }

const readyToSendCount = document.getElementById('readyToSendCount');
const startSendBtn = document.getElementById('startSendBtn');

const progressSection = document.getElementById('progressSection');
const jobStatusDot = document.getElementById('jobStatusDot');
const jobStatusHeading = document.getElementById('jobStatusHeading');
const stopJobBtn = document.getElementById('stopJobBtn');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const progressBarFill = document.getElementById('progressBarFill');
const progressPercentText = document.getElementById('progressPercentText');
const progressFractionText = document.getElementById('progressFractionText');
const delayNotice = document.getElementById('delayNotice');
const delayCountdownText = document.getElementById('delayCountdownText');
const statTotal = document.getElementById('statTotal');
const statSent = document.getElementById('statSent');
const statFailed = document.getElementById('statFailed');
const activityLogsBox = document.getElementById('activityLogsBox');
const liveStatusBody = document.getElementById('liveStatusBody');

// Confirm / Alert Modal Elements
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const confirmModalDetailsBox = document.getElementById('confirmModalDetailsBox');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalBtnText = document.getElementById('confirmModalBtnText');
const confirmModalIconContainer = document.getElementById('confirmModalIconContainer');

let confirmModalCallback = null;

function showConfirmModal({
  title = 'Confirmation',
  message = '',
  icon = 'send',
  iconBg = 'bg-blue-100 text-blue-600',
  detailsHtml = '',
  confirmText = 'Proceed',
  confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white',
  showCancel = true,
  onConfirm = null
}) {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  confirmModalBtnText.textContent = confirmText;
  confirmModalConfirmBtn.className = `px-5 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm flex items-center space-x-1.5 ${confirmBtnClass}`;
  confirmModalIconContainer.className = `w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-sm ${iconBg}`;
  confirmModalIconContainer.innerHTML = `<i data-lucide="${icon}" class="w-7 h-7"></i>`;
  lucide.createIcons();

  if (detailsHtml) {
    confirmModalDetailsBox.innerHTML = detailsHtml;
    confirmModalDetailsBox.classList.remove('hidden');
  } else {
    confirmModalDetailsBox.innerHTML = '';
    confirmModalDetailsBox.classList.add('hidden');
  }

  confirmModalCancelBtn.style.display = showCancel ? 'inline-block' : 'none';
  confirmModalCallback = onConfirm;

  confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
  confirmModal.classList.add('hidden');
  confirmModalCallback = null;
}

function showAlertModal(title, message, icon = 'alert-circle', iconBg = 'bg-red-100 text-red-600') {
  showConfirmModal({
    title,
    message,
    icon,
    iconBg,
    confirmText: 'Dismiss',
    confirmBtnClass: 'bg-slate-800 hover:bg-slate-900 text-white',
    showCancel: false
  });
}

// Initialize Icons
lucide.createIcons();

// ---------------- INITIALIZATION ---------------- //

async function init() {
  loadStoredCredentials();
  loadStoredTemplates();
  await fetchConfig();
  await fetchLinkedinStatus();
  setupEventListeners();
  setupLinkedinEventListeners();
  updateLiveEmailPreview();
}

function loadStoredCredentials() {
  const savedUser = localStorage.getItem('auto_sender_gmail_user');
  const savedPass = localStorage.getItem('auto_sender_gmail_pass');
  if (savedUser) inputGmailUser.value = savedUser;
  if (savedPass) inputGmailPass.value = savedPass;
}

function loadStoredTemplates() {
  const savedSubject = localStorage.getItem('auto_sender_email_subject');
  const savedBody = localStorage.getItem('auto_sender_email_body');
  if (savedSubject !== null) {
    emailSubject.value = savedSubject;
  }
  if (savedBody !== null) {
    emailBody.value = savedBody;
  }
}

async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    appConfig = data;

    if (data.defaultDelaySeconds) {
      delaySeconds.value = data.defaultDelaySeconds;
      delayBadge.textContent = `${data.defaultDelaySeconds} seconds`;
    }

    updateSmtpStatusUI();
  } catch (err) {
    console.error('Failed to load server config:', err);
  }
}

function updateSmtpStatusUI() {
  const hasLocalCreds = Boolean(inputGmailUser.value.trim() && inputGmailPass.value.trim());

  if (appConfig.hasEnvCredentials) {
    smtpStatusBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
    smtpStatusBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>Gmail Configured (.env)</span>
    `;
    envStatusAlertText.innerHTML = `Connected to Gmail configured in <code class="font-bold">.env</code>: <strong>${appConfig.envUser}</strong>`;
    renderedSenderPreview.textContent = appConfig.envUser;
  } else if (hasLocalCreds) {
    smtpStatusBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
    smtpStatusBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>Gmail Configured</span>
    `;
    renderedSenderPreview.textContent = inputGmailUser.value.trim();
  } else {
    smtpStatusBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
    smtpStatusBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
      <span>Gmail Not Set Up</span>
    `;
    renderedSenderPreview.textContent = 'Not configured yet';
  }
}

// ---------------- EVENT LISTENERS ---------------- //

function setupEventListeners() {
  // Modal toggles
  openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    verifyFeedback.classList.add('hidden');
  });

  closeSettingsModalBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  // Password visibility toggle
  togglePassVisibility.addEventListener('click', () => {
    if (inputGmailPass.type === 'password') {
      inputGmailPass.type = 'text';
      togglePassVisibility.textContent = 'Hide';
    } else {
      inputGmailPass.type = 'password';
      togglePassVisibility.textContent = 'Show';
    }
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('auto_sender_gmail_user', inputGmailUser.value.trim());
    localStorage.setItem('auto_sender_gmail_pass', inputGmailPass.value.trim());
    updateSmtpStatusUI();
    settingsModal.classList.add('hidden');
    checkCanSend();
  });

  // Test SMTP connection
  testSmtpBtn.addEventListener('click', handleTestSmtp);

  // File Upload Drag & Drop
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelected);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-500', 'bg-blue-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50/50');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelected();
    }
  });

  removeFileBtn.addEventListener('click', clearUploadedFile);
  emailColumnSelect.addEventListener('change', handleColumnChange);

  // Delay Slider
  delaySeconds.addEventListener('input', () => {
    delayBadge.textContent = `${delaySeconds.value} seconds`;
  });

  // Step 1: Input Mode Switch (File vs Notepad)
  tabModeFileBtn.addEventListener('click', () => switchInputMode('file'));
  tabModeNotepadBtn.addEventListener('click', () => switchInputMode('notepad'));

  // Notepad Interactions
  notepadTextarea.addEventListener('input', handleNotepadInput);
  notepadPasteBtn.addEventListener('click', handleNotepadPaste);
  notepadCleanBtn.addEventListener('click', handleNotepadClean);
  notepadSampleBtn.addEventListener('click', handleNotepadSample);
  notepadClearBtn.addEventListener('click', handleNotepadClear);

  // Step 2: Attachment Interactions
  imageUploadBox.addEventListener('click', () => imageFileInput.click());
  imageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelected(e.target.files[0]);
    }
  });

  imageUploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadBox.classList.add('border-blue-500', 'bg-blue-50/50');
  });

  imageUploadBox.addEventListener('dragleave', () => {
    imageUploadBox.classList.remove('border-blue-500', 'bg-blue-50/50');
  });

  imageUploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadBox.classList.remove('border-blue-500', 'bg-blue-50/50');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelected(e.dataTransfer.files[0]);
    }
  });

  removeImageBtn.addEventListener('click', removeCurrentAttachment);

  // Edit / Preview Tabs
  tabEditBtn.addEventListener('click', () => {
    tabEditBtn.className = 'px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-sm transition';
    tabPreviewBtn.className = 'px-3 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900 transition';
    editModeContainer.classList.remove('hidden');
    previewModeContainer.classList.add('hidden');
  });

  tabPreviewBtn.addEventListener('click', () => {
    tabPreviewBtn.className = 'px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-sm transition';
    tabEditBtn.className = 'px-3 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900 transition';
    editModeContainer.classList.add('hidden');
    previewModeContainer.classList.remove('hidden');
    updateLiveEmailPreview();
  });

  emailSubject.addEventListener('input', () => {
    localStorage.setItem('auto_sender_email_subject', emailSubject.value);
    updateLiveEmailPreview();
    checkCanSend();
  });

  emailBody.addEventListener('input', () => {
    localStorage.setItem('auto_sender_email_body', emailBody.value);
    updateLiveEmailPreview();
    checkCanSend();
  });

  // Start Sending
  startSendBtn.addEventListener('click', handleStartCampaign);

  // Stop Sending
  stopJobBtn.addEventListener('click', handleStopCampaign);

  // Download Report
  downloadReportBtn.addEventListener('click', handleDownloadReport);

  // Confirm / Alert Modal Buttons
  confirmModalCancelBtn.addEventListener('click', hideConfirmModal);
  confirmModalConfirmBtn.addEventListener('click', () => {
    const cb = confirmModalCallback;
    hideConfirmModal();
    if (cb) cb();
  });
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      hideConfirmModal();
    }
  });
}

// ---------------- SMTP VERIFICATION ---------------- //

async function handleTestSmtp() {
  testSmtpBtn.disabled = true;
  testSmtpBtn.innerHTML = `
    <span class="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
    <span>Verifying...</span>
  `;
  verifyFeedback.classList.add('hidden');

  try {
    const res = await fetch('/api/verify-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmailUser: inputGmailUser.value.trim(),
        gmailAppPassword: inputGmailPass.value.trim()
      })
    });

    const data = await res.json();
    verifyFeedback.classList.remove('hidden');

    if (data.success) {
      verifyFeedback.className = 'p-3 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200';
      verifyFeedback.innerHTML = `<strong>Success!</strong> ${data.message}`;
    } else {
      verifyFeedback.className = 'p-3 rounded-lg text-xs bg-red-50 text-red-800 border border-red-200';
      verifyFeedback.innerHTML = `<strong>Error:</strong> ${data.error}`;
    }
  } catch (err) {
    verifyFeedback.classList.remove('hidden');
    verifyFeedback.className = 'p-3 rounded-lg text-xs bg-red-50 text-red-800 border border-red-200';
    verifyFeedback.innerHTML = `<strong>Request Failed:</strong> ${err.message}`;
  } finally {
    testSmtpBtn.disabled = false;
    testSmtpBtn.innerHTML = `
      <i data-lucide="activity" class="w-3.5 h-3.5 text-slate-500"></i>
      <span>Test Connection</span>
    `;
    lucide.createIcons();
  }
}

// ---------------- INPUT MODE SWITCHING & NOTEPAD ---------------- //

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function switchInputMode(mode) {
  activeInputMode = mode;
  if (mode === 'file') {
    tabModeFileBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-white text-blue-700 shadow-sm border border-slate-200/80';
    tabModeNotepadBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900';
    fileModeContainer.classList.remove('hidden');
    notepadModeContainer.classList.add('hidden');

    if (currentFileData && currentFileData.source === 'file') {
      sharedDataPanel.classList.remove('hidden');
      totalRowsCount.textContent = currentFileData.totalRows;
      validEmailsCount.textContent = currentFileData.validEmailCount;
      readyToSendCount.textContent = currentFileData.validEmailCount;
      renderPreviewTable(currentFileData.sampleRows, currentFileData.columns, currentFileData.detectedEmailColumn);
    } else {
      sharedDataPanel.classList.add('hidden');
      totalRowsCount.textContent = '0';
      validEmailsCount.textContent = '0';
      readyToSendCount.textContent = '0';
    }
  } else {
    tabModeNotepadBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-white text-blue-700 shadow-sm border border-slate-200/80';
    tabModeFileBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900';
    fileModeContainer.classList.add('hidden');
    notepadModeContainer.classList.remove('hidden');

    handleNotepadInput();
  }
  checkCanSend();
}

function parseEmailsFromText(rawText) {
  if (!rawText || !rawText.trim()) {
    return { linesCount: 0, validEmails: [], duplicatesCount: 0, rows: [] };
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const seen = new Set();
  const validEmails = [];
  let duplicatesCount = 0;

  lines.forEach(line => {
    const tokens = line.split(/[,\s;]+/).map(t => t.trim()).filter(Boolean);
    tokens.forEach(tok => {
      if (EMAIL_REGEX.test(tok)) {
        const lower = tok.toLowerCase();
        if (seen.has(lower)) {
          duplicatesCount++;
        } else {
          seen.add(lower);
          validEmails.push(tok);
        }
      }
    });
  });

  const rows = validEmails.map(e => ({ Email: e }));
  return { linesCount: lines.length, validEmails, duplicatesCount, rows };
}

function handleNotepadInput() {
  const text = notepadTextarea.value;
  const { linesCount, validEmails, duplicatesCount, rows } = parseEmailsFromText(text);

  notepadTotalLines.textContent = linesCount;
  notepadValidEmails.textContent = validEmails.length;
  notepadDuplicateEmails.textContent = duplicatesCount;

  if (activeInputMode === 'notepad') {
    if (validEmails.length > 0) {
      currentFileData = {
        source: 'notepad',
        fileName: 'Pasted Emails (Notepad)',
        sheetName: 'Notepad',
        columns: ['Email'],
        detectedEmailColumn: 'Email',
        totalRows: validEmails.length,
        validEmailCount: validEmails.length,
        sampleRows: rows.slice(0, 5),
        rows
      };
      sharedDataPanel.classList.remove('hidden');
      totalRowsCount.textContent = validEmails.length;
      validEmailsCount.textContent = validEmails.length;
      readyToSendCount.textContent = validEmails.length;
      renderPreviewTable(currentFileData.sampleRows, ['Email'], 'Email');
    } else {
      currentFileData = null;
      sharedDataPanel.classList.add('hidden');
      totalRowsCount.textContent = '0';
      validEmailsCount.textContent = '0';
      readyToSendCount.textContent = '0';
    }
  }

  checkCanSend();
}

async function handleNotepadPaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const current = notepadTextarea.value.trim();
      notepadTextarea.value = current ? `${current}\n${text.trim()}` : text.trim();
      handleNotepadInput();
    }
  } catch (err) {
    notepadTextarea.focus();
  }
}

function handleNotepadClean() {
  const { validEmails } = parseEmailsFromText(notepadTextarea.value);
  if (validEmails.length > 0) {
    notepadTextarea.value = validEmails.join('\n');
    handleNotepadInput();
  }
}

function handleNotepadSample() {
  const sample = [
    'recruiter.alex@technova.com',
    'sarah.jenkins@innovatehr.io',
    'talent.acquisition@cloudscale.net',
    'david.miller@apexsystems.dev',
    'hr.careers@nextgensolutions.org'
  ].join('\n');

  notepadTextarea.value = sample;
  handleNotepadInput();
}

function handleNotepadClear() {
  notepadTextarea.value = '';
  notepadTotalLines.textContent = '0';
  notepadValidEmails.textContent = '0';
  notepadDuplicateEmails.textContent = '0';

  if (activeInputMode === 'notepad') {
    currentFileData = null;
    sharedDataPanel.classList.add('hidden');
    totalRowsCount.textContent = '0';
    validEmailsCount.textContent = '0';
    readyToSendCount.textContent = '0';
    checkCanSend();
  }
}

// ---------------- ATTACHMENT HANDLING ---------------- //

function handleImageSelected(file) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showAlertModal('File Too Large', 'Maximum attachment size is 5MB. Please choose a smaller image or document.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const base64Data = dataUrl.split(',')[1];
    const isImage = file.type.startsWith('image/');
    const sizeText = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    currentAttachment = {
      filename: file.name,
      data: base64Data,
      contentType: file.type || 'application/octet-stream',
      sizeText,
      isImage,
      dataUrl
    };

    imageFileName.textContent = file.name;
    imageFileSize.textContent = sizeText;

    if (isImage) {
      imageThumbnail.src = dataUrl;
      imageThumbnail.classList.remove('hidden');
    } else {
      imageThumbnail.classList.add('hidden');
    }

    imageUploadBox.classList.add('hidden');
    imagePreviewChip.classList.remove('hidden');
    updateLiveEmailPreview();
  };

  reader.readAsDataURL(file);
}

function removeCurrentAttachment() {
  currentAttachment = null;
  imageFileInput.value = '';
  imagePreviewChip.classList.add('hidden');
  imageUploadBox.classList.remove('hidden');
  updateLiveEmailPreview();
}

// ---------------- FILE UPLOAD & PARSING ---------------- //

async function handleFileSelected() {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  dropZone.innerHTML = `
    <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
    <p class="text-sm font-semibold text-slate-800">Parsing spreadsheet...</p>
    <p class="text-xs text-slate-500">Scanning columns and verifying email format</p>
  `;

  try {
    const res = await fetch('/api/parse-file', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to parse file');
    }

    currentFileData = data;
    renderFileInfo(data);
    checkCanSend();
  } catch (err) {
    showAlertModal('File Upload Failed', err.message);
    clearUploadedFile();
  }
}

function renderFileInfo(data) {
  data.source = 'file';
  dropZone.classList.add('hidden');
  fileInfoPanel.classList.remove('hidden');
  sharedDataPanel.classList.remove('hidden');

  uploadedFileName.textContent = data.fileName;
  uploadedFileStats.textContent = `${data.totalRows} rows found across ${data.columns.length} columns`;
  totalRowsCount.textContent = data.totalRows;
  validEmailsCount.textContent = data.validEmailCount;
  readyToSendCount.textContent = data.validEmailCount;

  // Populate Column Dropdown
  emailColumnSelect.innerHTML = '';
  data.columns.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = col + (col === data.detectedEmailColumn ? ' (Auto-detected Email)' : '');
    if (col === data.detectedEmailColumn) {
      opt.selected = true;
    }
    emailColumnSelect.appendChild(opt);
  });

  renderPreviewTable(data.sampleRows, data.columns, data.detectedEmailColumn);
}

function handleColumnChange() {
  if (!currentFileData) return;
  const selectedCol = emailColumnSelect.value;
  currentFileData.detectedEmailColumn = selectedCol;

  // Recalculate valid count
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let validCount = 0;
  currentFileData.rows.forEach(r => {
    if (emailRegex.test(String(r[selectedCol] || '').trim())) {
      validCount++;
    }
  });

  currentFileData.validEmailCount = validCount;
  validEmailsCount.textContent = validCount;
  readyToSendCount.textContent = validCount;

  renderPreviewTable(currentFileData.sampleRows, currentFileData.columns, selectedCol);
  checkCanSend();
}

function renderPreviewTable(rows, columns, highlightCol) {
  if (!rows || rows.length === 0) {
    previewTable.innerHTML = '<tr><td class="p-2 text-slate-400">No data to display</td></tr>';
    return;
  }

  let html = '<thead class="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200"><tr>';
  columns.forEach(col => {
    const isHighlight = col === highlightCol;
    html += `<th class="p-2 truncate ${isHighlight ? 'bg-blue-50 text-blue-700 font-bold' : ''}">${col}</th>`;
  });
  html += '</tr></thead><tbody class="divide-y divide-slate-100">';

  rows.forEach(row => {
    html += '<tr class="hover:bg-slate-50">';
    columns.forEach(col => {
      const isHighlight = col === highlightCol;
      const val = row[col] !== undefined ? String(row[col]) : '';
      html += `<td class="p-2 truncate max-w-[150px] ${isHighlight ? 'bg-blue-50/40 text-blue-900 font-medium' : 'text-slate-600'}">${escapeHtml(val)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  previewTable.innerHTML = html;
}

function clearUploadedFile() {
  if (activeInputMode === 'file') {
    currentFileData = null;
    sharedDataPanel.classList.add('hidden');
    totalRowsCount.textContent = '0';
    validEmailsCount.textContent = '0';
    readyToSendCount.textContent = '0';
  }

  fileInput.value = '';
  dropZone.classList.remove('hidden');
  fileInfoPanel.classList.add('hidden');

  dropZone.innerHTML = `
    <input type="file" id="fileInput" accept=".csv, .xlsx, .xls" class="hidden">
    <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
      <i data-lucide="upload-cloud" class="w-6 h-6"></i>
    </div>
    <div>
      <p class="text-sm font-semibold text-slate-800">
        Click to browse or drag & drop file
      </p>
      <p class="text-xs text-slate-500 mt-1">Supports CSV, XLSX, or XLS spreadsheets</p>
    </div>
    <div class="inline-flex items-center space-x-1 text-xs text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
      <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i>
      <span>Auto-detects email column automatically</span>
    </div>
  `;
  document.getElementById('fileInput').addEventListener('change', handleFileSelected);
  lucide.createIcons();
  checkCanSend();
}

// ---------------- EMAIL PREVIEW RENDERING ---------------- //

function updateLiveEmailPreview() {
  const subject = emailSubject.value;
  const body = emailBody.value;

  renderedSubjectPreview.textContent = subject;

  // Hyperlink URLs and format HTML
  const escaped = escapeHtml(body);
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const withLinks = escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-medium hover:text-blue-800">${url}</a>`;
  });

  renderedHtmlBody.innerHTML = withLinks.replace(/\n/g, '<br/>');

  // Attachment preview in email viewer
  if (currentAttachment) {
    renderedAttachmentPreview.classList.remove('hidden');
    renderedAttachmentName.textContent = `${currentAttachment.filename} (${currentAttachment.sizeText})`;
    if (currentAttachment.isImage) {
      renderedAttachmentImage.src = currentAttachment.dataUrl;
      renderedAttachmentImage.classList.remove('hidden');
    } else {
      renderedAttachmentImage.classList.add('hidden');
    }
  } else {
    renderedAttachmentPreview.classList.add('hidden');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function checkCanSend() {
  const hasValidEmails = currentFileData && currentFileData.validEmailCount > 0;
  const hasSubject = Boolean(emailSubject.value.trim());
  const hasBody = Boolean(emailBody.value.trim());

  startSendBtn.disabled = !(hasValidEmails && hasSubject && hasBody);
}

// ---------------- CAMPAIGN EXECUTION & SSE STREAM ---------------- //

function handleStartCampaign() {
  const isDryRun = dryRunCheck ? dryRunCheck.checked : false;
  const hasCredentials = appConfig.hasEnvCredentials || (inputGmailUser.value.trim() && inputGmailPass.value.trim());

  if (!isDryRun && !hasCredentials) {
    settingsModal.classList.remove('hidden');
    verifyFeedback.classList.remove('hidden');
    verifyFeedback.className = 'p-3 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200';
    verifyFeedback.innerHTML = '<strong>SMTP Credentials Required:</strong> Please enter your Gmail and 16-character Google App Password to proceed, or check "Simulation Mode (Dry Run)" to test without credentials.';
    return;
  }

  const emailCol = activeInputMode === 'notepad' ? 'Email' : emailColumnSelect.value;
  const subject = emailSubject.value.trim();
  const body = emailBody.value.trim();
  const delaySec = Number(delaySeconds.value) || 3;
  const skipDuplicates = skipDuplicatesCheck.checked;

  const modeText = isDryRun ? 'SIMULATION (Dry Run)' : 'REAL EMAILS via Gmail SMTP';
  const senderDisplay = isDryRun ? 'Simulation (No real emails)' : (inputGmailUser.value.trim() || appConfig.envUser || 'Configured Gmail');
  const sourceDisplay = activeInputMode === 'notepad' ? 'Email Notepad (Pasted)' : `Spreadsheet (${currentFileData.fileName || 'Uploaded file'})`;
  const attachmentDisplay = currentAttachment ? `${currentAttachment.filename} (${currentAttachment.sizeText})` : 'None';

  const detailsHtml = `
    <div class="space-y-2 text-xs">
      <div class="flex items-center justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500 font-medium">Source</span>
        <span class="font-bold text-slate-800">${sourceDisplay}</span>
      </div>
      <div class="flex items-center justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500 font-medium">Recipients</span>
        <span class="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded">${currentFileData.validEmailCount} valid contacts</span>
      </div>
      <div class="flex items-center justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500 font-medium">Attachment</span>
        <span class="font-bold ${currentAttachment ? 'text-blue-700 bg-blue-50' : 'text-slate-500 bg-slate-50'} px-2 py-0.5 rounded truncate max-w-[200px]">${attachmentDisplay}</span>
      </div>
      <div class="flex items-center justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500 font-medium">Sending Mode</span>
        <span class="font-bold px-2 py-0.5 rounded ${isDryRun ? 'text-amber-800 bg-amber-100' : 'text-blue-800 bg-blue-100'}">${modeText}</span>
      </div>
      <div class="flex items-center justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500 font-medium">Anti-Spam Delay</span>
        <span class="font-bold text-slate-800">${delaySec} seconds between emails</span>
      </div>
      <div class="flex items-center justify-between py-1">
        <span class="text-slate-500 font-medium">Sender Account</span>
        <span class="font-medium text-slate-800 truncate max-w-[210px]">${senderDisplay}</span>
      </div>
    </div>
  `;

  showConfirmModal({
    title: isDryRun ? 'Ready to Start Simulation?' : 'Ready to Launch Campaign?',
    message: isDryRun
      ? `Ready to simulate sending cold emails to ${currentFileData.validEmailCount} recipients with a ${delaySec}s delay. No real emails will be sent.`
      : `Ready to send cold emails to ${currentFileData.validEmailCount} recipients [Mode: ${modeText}] with a ${delaySec}s delay between each email.\n\nDo you want to proceed?`,
    icon: isDryRun ? 'flask-conical' : 'send',
    iconBg: isDryRun ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600',
    detailsHtml,
    confirmText: isDryRun ? 'Start Simulation' : 'Confirm & Send',
    confirmBtnClass: isDryRun ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white',
    onConfirm: () => {
      executeCampaign({
        emailCol,
        subject,
        body,
        delaySec,
        skipDuplicates,
        isDryRun,
        modeText,
        attachment: currentAttachment ? {
          filename: currentAttachment.filename,
          data: currentAttachment.data,
          contentType: currentAttachment.contentType
        } : null
      });
    }
  });
}

async function executeCampaign({ emailCol, subject, body, delaySec, skipDuplicates, isDryRun, modeText, attachment }) {
  // Disable controls while running
  startSendBtn.disabled = true;
  dropZone.style.pointerEvents = 'none';

  // Prepare UI for Progress
  progressSection.classList.remove('hidden');
  progressSection.scrollIntoView({ behavior: 'smooth' });

  jobStatusHeading.textContent = isDryRun ? 'Running simulation campaign...' : 'Initializing campaign...';
  jobStatusDot.className = 'w-3 h-3 rounded-full bg-blue-500 animate-ping';
  stopJobBtn.disabled = false;
  downloadReportBtn.disabled = true;

  statTotal.textContent = currentFileData.validEmailCount;
  statSent.textContent = '0';
  statFailed.textContent = '0';
  progressBarFill.style.width = '0%';
  progressPercentText.textContent = '0% Completed';
  progressFractionText.textContent = `0 / ${currentFileData.validEmailCount}`;

  activityLogsBox.innerHTML = '';
  appendLog(`[${new Date().toLocaleTimeString()}] Campaign initialized [Mode: ${modeText}]. Connecting to server...`, 'text-blue-400');

  try {
    // 1. Create Job on backend
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: currentFileData.rows,
        emailColumn: emailCol,
        subject,
        body,
        delaySeconds: delaySec,
        skipDuplicates,
        isDryRun,
        attachment,
        gmailUser: inputGmailUser.value.trim(),
        gmailAppPassword: inputGmailPass.value.trim()
      })
    });

    const jobData = await res.json();
    if (!res.ok) {
      throw new Error(jobData.error || 'Failed to create job');
    }

    currentJobId = jobData.jobId;

    // 2. Connect to Server-Sent Events (SSE) Stream
    connectJobStream(currentJobId);

  } catch (err) {
    appendLog(`[ERROR] ${err.message}`, 'text-red-400 font-bold');
    jobStatusHeading.textContent = 'Failed to start campaign';
    jobStatusDot.className = 'w-3 h-3 rounded-full bg-red-500';
    startSendBtn.disabled = false;
  }
}

function connectJobStream(jobId) {
  if (activeEventSource) {
    activeEventSource.close();
  }

  const sse = new EventSource(`/api/jobs/${jobId}/stream`);
  activeEventSource = sse;

  sse.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    statTotal.textContent = data.validTotal;
    buildLiveStatusTable(data.items);
  });

  sse.addEventListener('job_start', (e) => {
    const data = JSON.parse(e.data);
    jobStatusHeading.textContent = 'Sending emails...';
    appendLog(`[${new Date().toLocaleTimeString()}] ${data.message}`, 'text-blue-300 font-semibold');
  });

  sse.addEventListener('item_sending', (e) => {
    const data = JSON.parse(e.data);
    updateRowStatus(data.id, 'sending', 'Sending...');
    hideDelayCountdown();
  });

  sse.addEventListener('item_success', (e) => {
    const data = JSON.parse(e.data);
    updateRowStatus(data.id, 'sent', 'Sent');
    statSent.textContent = data.sentCount;
    statFailed.textContent = data.failedCount;
    updateProgressBar(data.sentCount + data.failedCount, parseInt(statTotal.textContent));
    appendLog(`[${new Date().toLocaleTimeString()}] SUCCESS: Sent to ${data.email}`, 'text-emerald-400');
  });

  sse.addEventListener('item_failure', (e) => {
    const data = JSON.parse(e.data);
    updateRowStatus(data.id, 'failed', `Failed: ${data.error}`);
    statSent.textContent = data.sentCount;
    statFailed.textContent = data.failedCount;
    updateProgressBar(data.sentCount + data.failedCount, parseInt(statTotal.textContent));
    appendLog(`[${new Date().toLocaleTimeString()}] FAILED: ${data.email} (${data.error})`, 'text-red-400');
  });

  sse.addEventListener('waiting_delay', (e) => {
    const data = JSON.parse(e.data);
    showDelayCountdown(data.seconds);
  });

  sse.addEventListener('job_completed', (e) => {
    const data = JSON.parse(e.data);
    finishCampaignUI('completed', data.message);
    sse.close();
  });

  sse.addEventListener('job_stopped', (e) => {
    const data = JSON.parse(e.data);
    finishCampaignUI('stopped', data.message);
    sse.close();
  });

  sse.addEventListener('job_error', (e) => {
    const data = JSON.parse(e.data);
    finishCampaignUI('error', data.error);
    sse.close();
  });

  sse.onerror = (err) => {
    console.error('SSE Stream error:', err);
  };
}

function buildLiveStatusTable(items) {
  liveStatusBody.innerHTML = '';
  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.id = `row-item-${item.id}`;
    tr.className = 'hover:bg-slate-50 transition';

    let badgeClass = 'bg-slate-100 text-slate-600 border border-slate-200';
    let badgeText = 'Queued';

    if (!item.isValid) {
      badgeClass = 'bg-slate-100 text-slate-400 line-through';
      badgeText = 'Invalid Email';
    }

    tr.innerHTML = `
      <td class="p-2.5 text-slate-400 font-mono">${item.id}</td>
      <td class="p-2.5 font-medium text-slate-800">${escapeHtml(item.email)}</td>
      <td class="p-2.5 status-cell">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}">
          ${badgeText}
        </span>
      </td>
    `;
    liveStatusBody.appendChild(tr);
  });
}

function updateRowStatus(itemId, status, text) {
  const row = document.getElementById(`row-item-${itemId}`);
  if (!row) return;

  const cell = row.querySelector('.status-cell');
  if (!cell) return;

  let badgeClass = 'bg-slate-100 text-slate-700';
  if (status === 'sending') {
    badgeClass = 'bg-blue-100 text-blue-700 border border-blue-200 animate-pulse';
  } else if (status === 'sent') {
    badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  } else if (status === 'failed') {
    badgeClass = 'bg-red-100 text-red-800 border border-red-200';
  }

  cell.innerHTML = `
    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}">
      ${escapeHtml(text)}
    </span>
  `;
}

function updateProgressBar(processed, total) {
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  progressBarFill.style.width = `${percent}%`;
  progressPercentText.textContent = `${percent}% Completed`;
  progressFractionText.textContent = `${processed} / ${total}`;
}

function showDelayCountdown(seconds) {
  hideDelayCountdown();
  delayNotice.classList.remove('hidden');
  let remaining = seconds;
  delayCountdownText.textContent = `Next email in ${remaining}s`;

  delayTimerInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      delayCountdownText.textContent = `Next email in ${remaining}s`;
    } else {
      hideDelayCountdown();
    }
  }, 1000);
}

function hideDelayCountdown() {
  if (delayTimerInterval) {
    clearInterval(delayTimerInterval);
    delayTimerInterval = null;
  }
  delayNotice.classList.add('hidden');
}

function appendLog(text, colorClass = 'text-slate-300') {
  const div = document.createElement('div');
  div.className = colorClass;
  div.textContent = text;
  activityLogsBox.appendChild(div);
  activityLogsBox.scrollTop = activityLogsBox.scrollHeight;
}

function finishCampaignUI(state, message) {
  hideDelayCountdown();
  stopJobBtn.disabled = true;
  downloadReportBtn.disabled = false;
  startSendBtn.disabled = false;
  dropZone.style.pointerEvents = 'auto';

  if (state === 'completed') {
    jobStatusHeading.textContent = 'Campaign Completed!';
    jobStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-500';
    appendLog(`[${new Date().toLocaleTimeString()}] SUCCESS: ${message}`, 'text-emerald-300 font-bold');
    
    // Auto-wipe recipient data and attachments from browser memory
    currentFileData = null;
    if (fileInput) fileInput.value = '';
    notepadTextarea.value = '';
    notepadTotalLines.textContent = '0';
    notepadValidEmails.textContent = '0';
    notepadDuplicateEmails.textContent = '0';
    removeCurrentAttachment();
    sharedDataPanel.classList.add('hidden');
    checkCanSend();

    appendLog(`[${new Date().toLocaleTimeString()}] PRIVACY: Recipient list and attachments completely purged from memory.`, 'text-blue-300 italic');
  } else if (state === 'stopped') {
    jobStatusHeading.textContent = 'Campaign Stopped';
    jobStatusDot.className = 'w-3 h-3 rounded-full bg-amber-500';
    appendLog(`[${new Date().toLocaleTimeString()}] STOPPED: ${message}`, 'text-amber-300 font-bold');
  } else {
    jobStatusHeading.textContent = 'Campaign Stopped with Error';
    jobStatusDot.className = 'w-3 h-3 rounded-full bg-red-500';
    appendLog(`[${new Date().toLocaleTimeString()}] ERROR: ${message}`, 'text-red-400 font-bold');
  }
}

function handleStopCampaign() {
  if (!currentJobId) return;

  showConfirmModal({
    title: 'Stop Sending Campaign?',
    message: 'Are you sure you want to stop sending remaining emails? Emails that were already sent cannot be unsent.',
    icon: 'alert-triangle',
    iconBg: 'bg-red-100 text-red-600',
    confirmText: 'Yes, Stop Campaign',
    confirmBtnClass: 'bg-red-600 hover:bg-red-700 text-white',
    onConfirm: async () => {
      try {
        await fetch(`/api/jobs/${currentJobId}/stop`, { method: 'POST' });
        appendLog(`[${new Date().toLocaleTimeString()}] Stop signal sent to server...`, 'text-amber-400');
      } catch (err) {
        console.error('Stop error:', err);
      }
    }
  });
}

async function handleDownloadReport() {
  if (!currentJobId) return;

  try {
    const res = await fetch(`/api/jobs/${currentJobId}/report`);
    const data = await res.json();

    // Generate CSV
    let csvContent = 'ID,Email,Status,Error,MessageID\n';
    data.items.forEach(it => {
      const escapedErr = (it.error || '').replace(/"/g, '""');
      csvContent += `${it.id},"${it.email}","${it.status}","${escapedErr}","${it.messageId || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cold_email_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    showAlertModal('Report Export Failed', `Failed to export report: ${err.message}`);
  }
}

// ================================================================
// LINKEDIN POST SCRAPER MODULE
// ================================================================

// Views
const viewEmailSenderBtn = document.getElementById('viewEmailSenderBtn');
const viewLinkedinScraperBtn = document.getElementById('viewLinkedinScraperBtn');
const emailSenderView = document.getElementById('emailSenderView');
const linkedinScraperView = document.getElementById('linkedinScraperView');

// Header Status
const linkedinHeaderBadge = document.getElementById('linkedinHeaderBadge');
const linkedinHeaderDot = document.getElementById('linkedinHeaderDot');
const linkedinHeaderStatusText = document.getElementById('linkedinHeaderStatusText');

// LinkedIn Auth Controls
const linkedinStatusPill = document.getElementById('linkedinStatusPill');
const linkedinStatusSubtitle = document.getElementById('linkedinStatusSubtitle');
const linkedinLoggedInActions = document.getElementById('linkedinLoggedInActions');
const linkedinAccountName = document.getElementById('linkedinAccountName');
const linkedinLogoutBtn = document.getElementById('linkedinLogoutBtn');
const linkedinLoginControls = document.getElementById('linkedinLoginControls');

const linkedinInteractiveLoginBtn = document.getElementById('linkedinInteractiveLoginBtn');
const linkedinCancelLoginBtn = document.getElementById('linkedinCancelLoginBtn');
const interactiveLoginStatus = document.getElementById('interactiveLoginStatus');
const interactiveLoginStatusText = document.getElementById('interactiveLoginStatusText');

const linkedinCookieInput = document.getElementById('linkedinCookieInput');
const linkedinSaveCookieBtn = document.getElementById('linkedinSaveCookieBtn');
const cookieFeedbackMsg = document.getElementById('cookieFeedbackMsg');

// Scraper Inputs & Controls
const presetQuerySelect = document.getElementById('presetQuerySelect');
const linkedinSearchQuery = document.getElementById('linkedinSearchQuery');
const linkedinPostLimit = document.getElementById('linkedinPostLimit');
const startLinkedinScrapeBtn = document.getElementById('startLinkedinScrapeBtn');

const scrapingProgressBanner = document.getElementById('scrapingProgressBanner');
const scrapingStatusText = document.getElementById('scrapingStatusText');
const scrapingProgressCount = document.getElementById('scrapingProgressCount');
const scrapingProgressBar = document.getElementById('scrapingProgressBar');

// Scraper Results
const linkedinResultsSection = document.getElementById('linkedinResultsSection');
const resultsCountBadge = document.getElementById('resultsCountBadge');
const emailsCountBadge = document.getElementById('emailsCountBadge');
const resultsTargetLabel = document.getElementById('resultsTargetLabel');

const sendToColdEmailBtn = document.getElementById('sendToColdEmailBtn');
const copyEmailsBtn = document.getElementById('copyEmailsBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');

const filterAllPostsBtn = document.getElementById('filterAllPostsBtn');
const filterWithEmailsBtn = document.getElementById('filterWithEmailsBtn');
const countAllFilter = document.getElementById('countAllFilter');
const countEmailsFilter = document.getElementById('countEmailsFilter');

const linkedinPostsTableBody = document.getElementById('linkedinPostsTableBody');

let linkedinSession = { loggedIn: false, profileName: '' };
let currentScrapedPosts = [];
let currentUniqueEmails = [];
let currentTableFilter = 'all'; // 'all' or 'emails_only'

// 1. View Switching (Cold Email vs LinkedIn Scraper)
function switchMainView(view) {
  if (view === 'email') {
    viewEmailSenderBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-white text-blue-700 shadow-sm border border-slate-200/80';
    viewLinkedinScraperBtn.className = 'px-4 py-2 rounded-lg text-xs font-medium transition flex items-center space-x-2 text-slate-600 hover:text-slate-900';
    emailSenderView.classList.remove('hidden');
    linkedinScraperView.classList.add('hidden');
  } else {
    viewLinkedinScraperBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-white text-blue-700 shadow-sm border border-slate-200/80';
    viewEmailSenderBtn.className = 'px-4 py-2 rounded-lg text-xs font-medium transition flex items-center space-x-2 text-slate-600 hover:text-slate-900';
    emailSenderView.classList.add('hidden');
    linkedinScraperView.classList.remove('hidden');
    fetchLinkedinStatus();
  }
}

// 2. Fetch LinkedIn Auth Status
async function fetchLinkedinStatus() {
  try {
    const res = await fetch('/api/linkedin/status');
    const data = await res.json();
    linkedinSession = data;
    updateLinkedinStatusUI(data);
  } catch (err) {
    console.error('Failed to fetch LinkedIn status:', err);
  }
}

function updateLinkedinStatusUI(data) {
  if (data.loggedIn) {
    // Header Badge
    linkedinHeaderDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    linkedinHeaderStatusText.textContent = `LinkedIn: ${data.profileName || 'Connected'}`;
    linkedinHeaderBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';

    // Status Pill
    linkedinStatusPill.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1';
    linkedinStatusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1"></span>Connected';
    linkedinStatusSubtitle.textContent = `Authenticated as ${data.profileName || 'Active Session'}. Public and private/connection posts accessible.`;

    // Controls
    linkedinLoggedInActions.classList.remove('hidden');
    linkedinAccountName.textContent = data.profileName || 'Active Session';
    linkedinLoginControls.classList.add('hidden');
  } else {
    // Header Badge
    linkedinHeaderDot.className = 'w-2 h-2 rounded-full bg-slate-400';
    linkedinHeaderStatusText.textContent = 'LinkedIn: Not Logged In';
    linkedinHeaderBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200';

    // Status Pill
    linkedinStatusPill.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200';
    linkedinStatusPill.textContent = 'Not Logged In';
    linkedinStatusSubtitle.textContent = 'Log in once to access both public and connection/private posts securely';

    // Controls
    linkedinLoggedInActions.classList.add('hidden');
    linkedinLoginControls.classList.remove('hidden');
  }
}

// 3. Interactive Browser Login
async function handleInteractiveLogin() {
  linkedinInteractiveLoginBtn.disabled = true;
  interactiveLoginStatus.classList.remove('hidden');
  linkedinCancelLoginBtn.classList.remove('hidden');
  interactiveLoginStatusText.textContent = 'Opening browser on your desktop... Please log in (2FA/OTP supported)';

  try {
    const res = await fetch('/api/linkedin/login-interactive', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showConfirmModal({
        title: 'LinkedIn Authenticated!',
        message: data.message || `Successfully logged in as ${data.profileName}!`,
        icon: 'check-circle',
        iconBg: 'bg-emerald-100 text-emerald-600',
        confirmText: 'Great, Let\'s Scrape',
        showCancel: false,
        onConfirm: () => {}
      });
      await fetchLinkedinStatus();
    } else {
      showAlertModal('Login Cancelled / Incomplete', data.message || 'Interactive login was not completed.');
    }
  } catch (err) {
    showAlertModal('Interactive Login Error', err.message);
  } finally {
    linkedinInteractiveLoginBtn.disabled = false;
    interactiveLoginStatus.classList.add('hidden');
    linkedinCancelLoginBtn.classList.add('hidden');
  }
}

async function handleCancelInteractiveLogin() {
  try {
    await fetch('/api/linkedin/login-cancel', { method: 'POST' });
    interactiveLoginStatus.classList.add('hidden');
    linkedinCancelLoginBtn.classList.add('hidden');
    linkedinInteractiveLoginBtn.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

// 4. Manual Cookie (li_at) Login
async function handleManualCookieLogin() {
  const cookieVal = linkedinCookieInput.value.trim();
  if (!cookieVal) {
    showAlertModal('Missing Cookie', 'Please paste your li_at session cookie string from LinkedIn.');
    return;
  }

  linkedinSaveCookieBtn.disabled = true;
  linkedinSaveCookieBtn.innerHTML = `
    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
    <span>Verifying...</span>
  `;
  cookieFeedbackMsg.classList.add('hidden');

  try {
    const res = await fetch('/api/linkedin/save-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liAtCookie: cookieVal })
    });
    const data = await res.json();

    if (data.success) {
      cookieFeedbackMsg.className = 'p-2 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200';
      cookieFeedbackMsg.textContent = data.message;
      cookieFeedbackMsg.classList.remove('hidden');
      linkedinCookieInput.value = '';
      await fetchLinkedinStatus();
    } else {
      cookieFeedbackMsg.className = 'p-2 rounded-lg text-xs bg-red-50 text-red-800 border border-red-200';
      cookieFeedbackMsg.textContent = data.error || 'Failed to authenticate cookie.';
      cookieFeedbackMsg.classList.remove('hidden');
    }
  } catch (err) {
    cookieFeedbackMsg.className = 'p-2 rounded-lg text-xs bg-red-50 text-red-800 border border-red-200';
    cookieFeedbackMsg.textContent = err.message;
    cookieFeedbackMsg.classList.remove('hidden');
  } finally {
    linkedinSaveCookieBtn.disabled = false;
    linkedinSaveCookieBtn.innerHTML = `
      <i data-lucide="key" class="w-3.5 h-3.5"></i>
      <span>Connect</span>
    `;
    lucide.createIcons();
  }
}

// 5. Logout
function handleLinkedinLogout() {
  showConfirmModal({
    title: 'Log out of LinkedIn?',
    message: 'This will remove your stored session cookies. You can log back in at any time.',
    icon: 'log-out',
    iconBg: 'bg-red-100 text-red-600',
    confirmText: 'Log Out',
    confirmBtnClass: 'bg-red-600 hover:bg-red-700 text-white',
    onConfirm: async () => {
      try {
        await fetch('/api/linkedin/logout', { method: 'POST' });
        await fetchLinkedinStatus();
        linkedinResultsSection.classList.add('hidden');
        currentScrapedPosts = [];
        currentUniqueEmails = [];
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
  });
}

// 6. Start Scraping (Hiring Searches & 24h filter)
async function handleStartLinkedinScrape() {
  if (!linkedinSession.loggedIn) {
    showAlertModal('Authentication Required', 'Please log in to LinkedIn first using either "Open Browser to Login" or "Paste Session Cookie".', 'lock', 'bg-amber-100 text-amber-700');
    return;
  }

  const query = linkedinSearchQuery.value.trim();
  if (!query) {
    showAlertModal('Missing Query', 'Please select or enter a hiring search query.');
    linkedinSearchQuery.focus();
    return;
  }

  const postLimit = parseInt(linkedinPostLimit.value) || 20;

  startLinkedinScrapeBtn.disabled = true;
  scrapingProgressBanner.classList.remove('hidden');
  scrapingStatusText.textContent = `Searching hiring posts (Past 24 Hours)...`;
  scrapingProgressCount.textContent = `0 / ${postLimit} posts`;
  scrapingProgressBar.style.width = '15%';

  try {
    const res = await fetch('/api/linkedin/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQuery: query,
        datePosted: 'past-24h',
        postLimit
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to scrape posts from LinkedIn');
    }

    currentScrapedPosts = data.posts || [];
    currentUniqueEmails = data.uniqueEmails || [];

    resultsCountBadge.textContent = `${currentScrapedPosts.length} Posts Scraped`;
    emailsCountBadge.textContent = `${currentUniqueEmails.length} Recruiter Emails Found`;
    resultsTargetLabel.textContent = `Search: "${query}" • Filter: Past 24 Hours`;

    countAllFilter.textContent = currentScrapedPosts.length;
    const withEmailCount = currentScrapedPosts.filter(p => p.hasEmails).length;
    countEmailsFilter.textContent = withEmailCount;

    currentTableFilter = 'all';
    applyTableFilter();

    linkedinResultsSection.classList.remove('hidden');
    linkedinResultsSection.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    showAlertModal('Scraping Error', err.message);
  } finally {
    startLinkedinScrapeBtn.disabled = false;
    scrapingProgressBanner.classList.add('hidden');
  }
}

// 7. Filtering Posts
function applyTableFilter() {
  if (currentTableFilter === 'all') {
    filterAllPostsBtn.className = 'px-3 py-1 rounded-md font-bold bg-slate-200 text-slate-800';
    filterWithEmailsBtn.className = 'px-3 py-1 rounded-md font-semibold text-slate-600 hover:text-slate-900';
    renderLinkedinPostsTable(currentScrapedPosts);
  } else {
    filterWithEmailsBtn.className = 'px-3 py-1 rounded-md font-bold bg-blue-100 text-blue-800';
    filterAllPostsBtn.className = 'px-3 py-1 rounded-md font-semibold text-slate-600 hover:text-slate-900';
    const filtered = currentScrapedPosts.filter(p => p.hasEmails);
    renderLinkedinPostsTable(filtered);
  }
}

// 8. Render Posts Table (with Extracted Email Badges)
function renderLinkedinPostsTable(posts) {
  linkedinPostsTableBody.innerHTML = '';

  if (!posts || posts.length === 0) {
    linkedinPostsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p class="font-medium text-slate-600">No posts match this filter.</p>
          <p class="text-xs text-slate-400 mt-0.5">Try running another search query or view all scraped posts.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  posts.forEach((post, idx) => {
    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition align-top ${post.hasEmails ? 'bg-blue-50/20' : ''}`;

    const shortContent = post.content.length > 200
      ? post.content.slice(0, 200) + '...'
      : post.content;
    const isTruncated = post.content.length > 200;

    // Build email badges HTML
    let emailHtml = '';
    if (post.extractedEmails && post.extractedEmails.length > 0) {
      emailHtml = post.extractedEmails.map(em => `
        <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 font-mono text-[11px] font-semibold">
          <i data-lucide="mail" class="w-3 h-3 text-blue-600"></i>
          <span>${escapeHtml(em)}</span>
          <button type="button" class="copy-single-email-btn text-blue-600 hover:text-blue-900 ml-1" data-email="${escapeHtml(em)}" title="Copy email">
            <i data-lucide="copy" class="w-3 h-3"></i>
          </button>
        </div>
      `).join('');
    } else {
      emailHtml = '<span class="text-slate-400 text-[11px] italic">No email found in text</span>';
    }

    tr.innerHTML = `
      <td class="p-3 text-center font-mono text-slate-400 font-semibold">${idx + 1}</td>
      <td class="p-3">
        <div class="font-bold text-slate-900">${escapeHtml(post.authorName)}</div>
        <div class="text-[11px] text-slate-500 line-clamp-2">${escapeHtml(post.authorHeadline)}</div>
        ${post.authorUrl ? `<a href="${post.authorUrl}" target="_blank" class="text-[11px] text-blue-600 hover:underline inline-flex items-center space-x-0.5 mt-0.5"><span>View Profile</span><i data-lucide="external-link" class="w-2.5 h-2.5"></i></a>` : ''}
      </td>
      <td class="p-3">
        <div class="space-y-1">
          ${emailHtml}
        </div>
      </td>
      <td class="p-3">
        <div class="text-slate-800 leading-relaxed font-sans text-xs whitespace-pre-line" id="post-text-${idx}">
          ${escapeHtml(shortContent)}
        </div>
        ${isTruncated ? `
          <button type="button" class="mt-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium expand-toggle-btn" data-idx="${idx}">
            Show full post (${post.content.length} chars)
          </button>
        ` : ''}
      </td>
      <td class="p-3 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <i data-lucide="clock" class="w-3 h-3 mr-1 text-emerald-600"></i>
          ${escapeHtml(post.timestamp)}
        </span>
      </td>
      <td class="p-3 whitespace-nowrap">
        <div class="space-y-0.5 text-[11px] text-slate-600">
          <div class="flex items-center space-x-1">
            <span class="text-blue-600 font-bold">👍</span>
            <span>${escapeHtml(post.likes)} reactions</span>
          </div>
          <div class="flex items-center space-x-1 text-slate-500">
            <span>💬</span>
            <span>${escapeHtml(post.comments)} comments</span>
          </div>
        </div>
      </td>
      <td class="p-3 text-right whitespace-nowrap">
        <div class="flex items-center justify-end space-x-1.5">
          ${post.postUrl ? `
            <a href="${post.postUrl}" target="_blank" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition" title="Open Post on LinkedIn">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          ` : ''}
          <button type="button" class="copy-post-btn p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition" data-idx="${idx}" title="Copy Post Text">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          ${post.hasEmails ? `
            <button type="button" class="transfer-single-btn p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition" data-idx="${idx}" title="Transfer this email to outreach queue">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;

    linkedinPostsTableBody.appendChild(tr);
  });

  // Attach expand handlers
  document.querySelectorAll('.expand-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-idx');
      const textDiv = document.getElementById(`post-text-${idx}`);
      const isExpanded = e.target.getAttribute('data-expanded') === 'true';

      if (isExpanded) {
        textDiv.textContent = posts[idx].content.slice(0, 200) + '...';
        e.target.textContent = `Show full post (${posts[idx].content.length} chars)`;
        e.target.setAttribute('data-expanded', 'false');
      } else {
        textDiv.textContent = posts[idx].content;
        e.target.textContent = 'Show less';
        e.target.setAttribute('data-expanded', 'true');
      }
    });
  });

  // Attach post text copy handlers
  document.querySelectorAll('.copy-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetBtn = e.target.closest('button');
      const idx = targetBtn.getAttribute('data-idx');
      const post = posts[idx];
      try {
        await navigator.clipboard.writeText(post.content);
        targetBtn.classList.remove('bg-slate-100', 'text-slate-700');
        targetBtn.classList.add('bg-emerald-50', 'text-emerald-700');
        targetBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
        lucide.createIcons();
        setTimeout(() => {
          targetBtn.classList.remove('bg-emerald-50', 'text-emerald-700');
          targetBtn.classList.add('bg-slate-100', 'text-slate-700');
          targetBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i>';
          lucide.createIcons();
        }, 1500);
      } catch (err) {}
    });
  });

  // Attach single email copy handlers
  document.querySelectorAll('.copy-single-email-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetBtn = e.target.closest('button');
      const email = targetBtn.getAttribute('data-email');
      try {
        await navigator.clipboard.writeText(email);
        targetBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>';
        lucide.createIcons();
        setTimeout(() => {
          targetBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i>';
          lucide.createIcons();
        }, 1500);
      } catch (err) {}
    });
  });

  // Attach single post email transfer handler
  document.querySelectorAll('.transfer-single-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('button');
      const idx = targetBtn.getAttribute('data-idx');
      const post = posts[idx];
      if (post && post.extractedEmails && post.extractedEmails.length > 0) {
        transferEmailsToColdEmail(post.extractedEmails);
      }
    });
  });

  lucide.createIcons();
}

// 9. Transfer Extracted Emails to Cold Email Outreach Queue
function transferEmailsToColdEmail(emailsToTransfer) {
  if (!emailsToTransfer || emailsToTransfer.length === 0) {
    showAlertModal('No Emails Found', 'There are no email addresses to transfer from these posts.');
    return;
  }

  // Deduplicate
  const uniqueList = Array.from(new Set(emailsToTransfer.map(e => e.trim().toLowerCase())));

  // Switch to Email Sender View
  switchMainView('email');

  // Switch Step 1 Mode to Notepad
  switchInputMode('notepad');

  // Append or set emails in notepadTextarea
  const existing = notepadTextarea.value.trim();
  const existingLines = existing ? existing.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
  const combinedSet = new Set([...existingLines, ...uniqueList]);
  notepadTextarea.value = Array.from(combinedSet).join('\n');

  // Trigger notepad input parser
  handleNotepadInput();

  showConfirmModal({
    title: 'Recruiter Emails Transferred!',
    message: `Transferred ${uniqueList.length} recruiter emails into your Cold Email Queue. Your email template is ready for review.`,
    icon: 'send',
    iconBg: 'bg-emerald-100 text-emerald-600',
    confirmText: 'Review & Send Cold Emails',
    showCancel: false,
    onConfirm: () => {
      document.getElementById('editModeContainer').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// 10. Copy All Extracted Emails to Clipboard
function handleCopyAllEmails() {
  if (!currentUniqueEmails || currentUniqueEmails.length === 0) {
    showAlertModal('No Emails to Copy', 'No email addresses were found in the scraped posts.');
    return;
  }

  const text = currentUniqueEmails.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    copyEmailsBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Copied!</span>';
    lucide.createIcons();
    setTimeout(() => {
      copyEmailsBtn.innerHTML = '<i data-lucide="clipboard" class="w-3.5 h-3.5"></i><span>Copy Emails</span>';
      lucide.createIcons();
    }, 2000);
  });
}

// 11. Exports (CSV & JSON with extracted emails)
function handleExportLinkedinCsv() {
  if (!currentScrapedPosts || currentScrapedPosts.length === 0) return;

  let csv = 'ID,Author,Headline,ExtractedEmails,Timestamp,Likes,Comments,PostURL,Content\n';
  currentScrapedPosts.forEach(p => {
    const esc = (t) => `"${String(t || '').replace(/"/g, '""')}"`;
    const emailsStr = (p.extractedEmails || []).join('; ');
    csv += `${p.id},${esc(p.authorName)},${esc(p.authorHeadline)},${esc(emailsStr)},${esc(p.timestamp)},${esc(p.likes)},${esc(p.comments)},${esc(p.postUrl)},${esc(p.content)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `linkedin_hiring_posts_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function handleExportLinkedinJson() {
  if (!currentScrapedPosts || currentScrapedPosts.length === 0) return;

  const exportData = {
    searchQuery: linkedinSearchQuery.value.trim(),
    filter: 'past-24h',
    scrapedAt: new Date().toISOString(),
    totalPosts: currentScrapedPosts.length,
    totalEmailsFound: currentUniqueEmails.length,
    uniqueEmails: currentUniqueEmails,
    posts: currentScrapedPosts
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `linkedin_hiring_posts_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 12. Event Listeners Setup
function setupLinkedinEventListeners() {
  viewEmailSenderBtn.addEventListener('click', () => switchMainView('email'));
  viewLinkedinScraperBtn.addEventListener('click', () => switchMainView('linkedin'));

  linkedinInteractiveLoginBtn.addEventListener('click', handleInteractiveLogin);
  linkedinCancelLoginBtn.addEventListener('click', handleCancelInteractiveLogin);
  linkedinSaveCookieBtn.addEventListener('click', handleManualCookieLogin);
  linkedinLogoutBtn.addEventListener('click', handleLinkedinLogout);

  // Preset hiring queries dropdown change
  presetQuerySelect.addEventListener('change', () => {
    if (presetQuerySelect.value !== 'custom') {
      linkedinSearchQuery.value = presetQuerySelect.value;
    } else {
      linkedinSearchQuery.value = '';
      linkedinSearchQuery.focus();
    }
  });

  startLinkedinScrapeBtn.addEventListener('click', handleStartLinkedinScrape);

  // 1-Click Send All to Cold Email Queue
  sendToColdEmailBtn.addEventListener('click', () => {
    transferEmailsToColdEmail(currentUniqueEmails);
  });

  // Copy emails
  copyEmailsBtn.addEventListener('click', handleCopyAllEmails);

  // Filter tabs
  filterAllPostsBtn.addEventListener('click', () => {
    currentTableFilter = 'all';
    applyTableFilter();
  });

  filterWithEmailsBtn.addEventListener('click', () => {
    currentTableFilter = 'emails_only';
    applyTableFilter();
  });

  exportCsvBtn.addEventListener('click', handleExportLinkedinCsv);
  exportJsonBtn.addEventListener('click', handleExportLinkedinJson);
}

// Kick off
init();

