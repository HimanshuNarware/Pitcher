const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '.linkedin-session.json');
const CHROME_PATH = '/usr/bin/google-chrome';

let activeLoginBrowser = null;
let activeLoginPage = null;

// Helper: Read saved session cookies from disk
function getStoredSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      return data;
    }
  } catch (err) {
    console.error('[LinkedIn] Error reading session file:', err);
  }
  return null;
}

// Helper: Save session cookies to disk
function saveStoredSession(sessionData) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[LinkedIn] Error saving session file:', err);
    return false;
  }
}

// Helper: Clear stored session
function clearStoredSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
    return true;
  } catch (err) {
    console.error('[LinkedIn] Error clearing session file:', err);
    return false;
  }
}

// Helper: Verify session cookies with LinkedIn
async function verifySession(cookies) {
  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
    return { loggedIn: false, error: 'No cookies provided' };
  }

  const liAtCookie = cookies.find(c => c.name === 'li_at');
  if (!liAtCookie || !liAtCookie.value) {
    return { loggedIn: false, error: 'Missing li_at authentication cookie' };
  }

  let browser = null;
  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    await context.addCookies(cookies);
    const page = await context.newPage();

    // Check if feed loads or if redirected to login/authwall
    const res = await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/checkpoint')) {
      await browser.close();
      return { loggedIn: false, error: 'Session expired or blocked by login wall' };
    }

    // Attempt to extract profile identity name
    let profileName = 'LinkedIn User';
    try {
      const nameEl = await page.locator('.feed-identity-module__actor-meta a, .profile-rail-card__actor-link, h3.feed-identity-module__name').first();
      if (await nameEl.isVisible({ timeout: 4000 })) {
        const text = await nameEl.innerText();
        if (text && text.trim()) profileName = text.trim();
      }
    } catch (e) {
      // Non-critical, fallback to default name
    }

    await browser.close();
    return { loggedIn: true, profileName };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { loggedIn: false, error: `Verification failed: ${err.message}` };
  }
}

// 1. Get current session status
async function getSessionStatus() {
  const session = getStoredSession();
  if (!session || !session.cookies) {
    return { loggedIn: false };
  }

  const liAt = session.cookies.find(c => c.name === 'li_at');
  if (!liAt) {
    return { loggedIn: false };
  }

  return {
    loggedIn: true,
    profileName: session.profileName || 'Active Session',
    lastVerified: session.lastVerified || null,
    method: session.method || 'cookie'
  };
}

// 2. Interactive Browser Login Flow
async function startInteractiveLogin() {
  if (activeLoginBrowser) {
    throw new Error('An interactive login window is already open. Please complete login or cancel it.');
  }

  return new Promise(async (resolve, reject) => {
    let checkInterval = null;
    let isFinished = false;

    try {
      activeLoginBrowser = await chromium.launch({
        executablePath: CHROME_PATH,
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900'
        ]
      });

      const context = await activeLoginBrowser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 850 }
      });

      activeLoginPage = await context.newPage();

      activeLoginPage.on('close', () => {
        if (!isFinished) {
          cleanup();
          resolve({ success: false, message: 'Login window was closed by the user.' });
        }
      });

      activeLoginBrowser.on('disconnected', () => {
        if (!isFinished) {
          cleanup();
          resolve({ success: false, message: 'Login browser was closed.' });
        }
      });

      await activeLoginPage.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      // Polling loop: check if user reached feed or li_at cookie is present
      checkInterval = setInterval(async () => {
        try {
          if (!activeLoginPage || activeLoginPage.isClosed()) {
            cleanup();
            return;
          }

          const cookies = await context.cookies();
          const liAt = cookies.find(c => c.name === 'li_at');
          const currentUrl = activeLoginPage.url();

          // User is authenticated when li_at is set and URL is away from /login
          const isAuthenticated = liAt && liAt.value && (
            currentUrl.includes('/feed') ||
            currentUrl.includes('/in/') ||
            currentUrl.includes('/mynetwork') ||
            (!currentUrl.includes('/login') && !currentUrl.includes('/checkpoint'))
          );

          if (isAuthenticated) {
            isFinished = true;
            clearInterval(checkInterval);

            // Wait a brief moment to extract user name
            let profileName = 'LinkedIn Member';
            try {
              await activeLoginPage.waitForTimeout(2000);
              const nameEl = await activeLoginPage.locator('.feed-identity-module__actor-meta a, .profile-rail-card__actor-link, h3.feed-identity-module__name').first();
              if (await nameEl.isVisible({ timeout: 3000 })) {
                const txt = await nameEl.innerText();
                if (txt && txt.trim()) profileName = txt.trim();
              }
            } catch (e) {}

            saveStoredSession({
              cookies,
              profileName,
              lastVerified: new Date().toISOString(),
              method: 'interactive'
            });

            await activeLoginBrowser.close().catch(() => {});
            cleanup();

            resolve({
              success: true,
              profileName,
              message: `Successfully authenticated as ${profileName}!`
            });
          }
        } catch (err) {
          console.error('[LinkedIn Interactive Login Poll Error]', err);
        }
      }, 1500);

      // Auto-timeout after 4 minutes
      setTimeout(() => {
        if (!isFinished) {
          isFinished = true;
          cleanup();
          if (activeLoginBrowser) activeLoginBrowser.close().catch(() => {});
          resolve({ success: false, message: 'Interactive login timed out after 4 minutes.' });
        }
      }, 240000);

    } catch (err) {
      cleanup();
      reject(new Error(`Failed to launch login browser: ${err.message}`));
    }

    function cleanup() {
      if (checkInterval) clearInterval(checkInterval);
      activeLoginBrowser = null;
      activeLoginPage = null;
    }
  });
}

// 3. Cancel active interactive login
async function cancelInteractiveLogin() {
  if (activeLoginBrowser) {
    try {
      await activeLoginBrowser.close();
    } catch (e) {}
    activeLoginBrowser = null;
    activeLoginPage = null;
    return { success: true, message: 'Interactive login cancelled.' };
  }
  return { success: false, message: 'No active login window to cancel.' };
}

// 4. Manual Cookie (li_at) Login
async function saveManualCookie(liAtValue) {
  const cleanVal = (liAtValue || '').trim().replace(/^li_at=/, '').trim();
  if (!cleanVal) {
    throw new Error('Please enter a valid li_at cookie string.');
  }

  const cookie = {
    name: 'li_at',
    value: cleanVal,
    domain: '.www.linkedin.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  };

  const verification = await verifySession([cookie]);
  if (!verification.loggedIn) {
    throw new Error(verification.error || 'Failed to authenticate with the provided li_at cookie.');
  }

  saveStoredSession({
    cookies: [cookie],
    profileName: verification.profileName || 'LinkedIn User',
    lastVerified: new Date().toISOString(),
    method: 'manual_cookie'
  });

  return {
    success: true,
    profileName: verification.profileName,
    message: `Connected successfully! Session verified for ${verification.profileName}.`
  };
}

// 5. Normalizer for Target URLs
function normalizeTargetUrl(rawUrl) {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  url = url.split('?')[0].replace(/\/+$/, '');

  // If already pointing to posts or activity, preserve it
  if (url.includes('/recent-activity/') || url.endsWith('/posts')) {
    return url;
  }

  // Profile URL (e.g. linkedin.com/in/username)
  if (url.includes('/in/')) {
    return `${url}/recent-activity/all/`;
  }

  // Company Page URL (e.g. linkedin.com/company/companyname)
  if (url.includes('/company/')) {
    return `${url}/posts/`;
  }

  return url;
}

// 6. Scrape LinkedIn Posts
async function scrapeLinkedInPosts({ targetUrl, postLimit = 10, onProgress = () => {} }) {
  const session = getStoredSession();
  if (!session || !session.cookies) {
    throw new Error('You are not logged in. Please log in to LinkedIn first before scraping.');
  }

  const formattedUrl = normalizeTargetUrl(targetUrl);
  if (!formattedUrl || !formattedUrl.includes('linkedin.com')) {
    throw new Error('Please enter a valid LinkedIn Profile or Company Page URL.');
  }

  const limit = Math.min(50, Math.max(1, Number(postLimit) || 10));

  onProgress({ stage: 'init', message: `Initializing browser with authenticated session...`, current: 0, total: limit });

  let browser = null;
  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 }
    });

    await context.addCookies(session.cookies);
    const page = await context.newPage();

    onProgress({ stage: 'navigating', message: `Navigating to ${formattedUrl}...`, current: 0, total: limit });

    await page.goto(formattedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 35000
    });

    await page.waitForTimeout(2500);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/checkpoint')) {
      throw new Error('LinkedIn detected an unauthenticated session or presented a checkpoint. Please log in again.');
    }

    // Try to extract page author title from top header
    let pageAuthorName = '';
    let pageAuthorHeadline = '';
    try {
      const headerTitle = await page.locator('h1.org-top-card-summary__title, h1.top-card-layout__title, .ph5 h1, h1').first();
      if (await headerTitle.isVisible({ timeout: 2000 })) {
        pageAuthorName = (await headerTitle.innerText()).trim();
      }
    } catch (e) {}

    onProgress({ stage: 'scraping', message: `Page loaded. Extracting recent posts...`, current: 0, total: limit });

    const postsMap = new Map();
    let scrollAttempts = 0;
    const maxScrolls = limit * 3 + 5;

    while (postsMap.size < limit && scrollAttempts < maxScrolls) {
      scrollAttempts++;

      // Click any visible "see more" buttons to expand truncated text
      try {
        const seeMoreButtons = page.locator('button.feed-shared-inline-show-more-text__see-more-less-toggle, button.see-more, [aria-label*="see more" i]');
        const btnCount = await seeMoreButtons.count();
        for (let i = 0; i < Math.min(btnCount, 5); i++) {
          try {
            await seeMoreButtons.nth(i).click({ timeout: 500 }).catch(() => {});
          } catch (e) {}
        }
      } catch (e) {}

      // Extract all currently visible post cards
      const extractedBatch = await page.evaluate(() => {
        const results = [];
        // Post cards selectors
        const cards = document.querySelectorAll(
          'div.feed-shared-update-v2, div[data-urn*="activity"], div[data-urn*="share"], li.feed-shared-update-v2'
        );

        cards.forEach(card => {
          const urn = card.getAttribute('data-urn') || '';

          // Text content
          const textEl = card.querySelector(
            '.feed-shared-update-v2__description, .update-components-text, span.break-words, .feed-shared-text'
          );
          let content = textEl ? textEl.innerText.trim() : '';

          // Remove trailing "...see more" if still present
          content = content.replace(/\s*\.\.\.see more$/i, '').trim();

          // Author details
          const nameEl = card.querySelector(
            '.feed-shared-actor__name, .update-components-actor__name, span[dir="ltr"] span'
          );
          const authorName = nameEl ? nameEl.innerText.trim() : '';

          const headlineEl = card.querySelector(
            '.feed-shared-actor__description, .update-components-actor__description'
          );
          const authorHeadline = headlineEl ? headlineEl.innerText.trim() : '';

          const authorLinkEl = card.querySelector(
            'a.feed-shared-actor__container-link, a.app-aware-link[href*="/in/"], a.app-aware-link[href*="/company/"]'
          );
          const authorUrl = authorLinkEl ? authorLinkEl.href.split('?')[0] : '';

          // Timestamp
          const timeEl = card.querySelector(
            '.feed-shared-actor__sub-description, .update-components-actor__sub-description, time'
          );
          const timestamp = timeEl ? timeEl.innerText.replace(/\n.*$/g, '').trim() : '';

          // Engagement
          const likesEl = card.querySelector(
            '.social-details-social-counts__reactions-count, [aria-label*="reactions" i], .reactions-count'
          );
          const likes = likesEl ? likesEl.innerText.trim() : '0';

          const commentsEl = card.querySelector(
            'button[aria-label*="comment" i], .social-details-social-counts__comments'
          );
          const comments = commentsEl ? commentsEl.innerText.replace(/[^\d]/g, '').trim() : '0';

          // Post URL
          let postUrl = '';
          if (urn) {
            postUrl = `https://www.linkedin.com/feed/update/${urn}/`;
          } else {
            const linkEl = card.querySelector('a.feed-shared-actor__sub-description-link, a[href*="/feed/update/"]');
            if (linkEl) postUrl = linkEl.href.split('?')[0];
          }

          if (content || postUrl) {
            results.push({
              urn: urn || postUrl,
              postUrl,
              authorName,
              authorHeadline,
              authorUrl,
              content,
              timestamp,
              likes,
              comments
            });
          }
        });

        return results;
      });

      // Add to unique map
      for (const item of extractedBatch) {
        const key = item.urn || item.content.slice(0, 40);
        if (!postsMap.has(key)) {
          if (!item.authorName && pageAuthorName) {
            item.authorName = pageAuthorName;
          }
          postsMap.set(key, item);
          onProgress({
            stage: 'scraping',
            message: `Extracted post ${postsMap.size} of ${limit}`,
            current: postsMap.size,
            total: limit
          });
          if (postsMap.size >= limit) break;
        }
      }

      if (postsMap.size >= limit) break;

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(1600);
    }

    await browser.close();

    const finalPosts = Array.from(postsMap.values()).slice(0, limit).map((post, idx) => ({
      id: idx + 1,
      authorName: post.authorName || pageAuthorName || 'Unknown Author',
      authorHeadline: post.authorHeadline || pageAuthorHeadline || '',
      authorUrl: post.authorUrl || formattedUrl,
      postUrl: post.postUrl || formattedUrl,
      content: post.content || '(No text content / media only)',
      timestamp: post.timestamp || 'Recent',
      likes: post.likes || '0',
      comments: post.comments || '0',
      scrapedAt: new Date().toISOString()
    }));

    return {
      success: true,
      targetUrl: formattedUrl,
      totalScraped: finalPosts.length,
      posts: finalPosts
    };

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

module.exports = {
  getSessionStatus,
  startInteractiveLogin,
  cancelInteractiveLogin,
  saveManualCookie,
  clearStoredSession,
  scrapeLinkedInPosts
};
