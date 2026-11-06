/**
 * DebtRead – Background Service Worker
 * Version 1.1.0
 * All data remains on the device.
 */

const DB_NAME = 'DebtReadDB';
const DB_VERSION = 1;
const STORE_ARTICLES = 'articles';
const STORE_HIGHLIGHTS = 'highlights';
const STORE_SETTINGS = 'settings';

const DEFAULT_SETTINGS = {
  wordsPerMinute: 200,
  debtWarningMinutes: 30,
  autoArchiveDays: 0,
  theme: 'system'
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_ARTICLES)) {
        const store = database.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
        store.createIndex('by_url', 'url', { unique: true });
        store.createIndex('by_created', 'createdAt', { unique: false });
        store.createIndex('by_read', 'isRead', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE_HIGHLIGHTS)) {
        const hStore = database.createObjectStore(STORE_HIGHLIGHTS, { keyPath: 'id' });
        hStore.createIndex('by_article', 'articleId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
        database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      const database = event.target.result;
      database.onclose = () => {};
      resolve(database);
    };

    request.onerror = () => reject(request.error);
  });
}

async function getSettings() {
  try {
    const database = await openDatabase();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get('main');
      req.onsuccess = () => {
        resolve({ ...DEFAULT_SETTINGS, ...(req.result?.value || {}) });
      };
      req.onerror = () => resolve({ ...DEFAULT_SETTINGS });
    });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key: 'main', value: settings });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function estimateReadingTime(wordCount, wpm) {
  const count = Number(wordCount) || 0;
  if (count < 30) return 0;
  return Math.max(1, Math.round(count / (wpm || 200)));
}

/**
 * Basic HTML sanitizer – removes scripts, event handlers and dangerous tags.
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/expression\s*\(/gi, '');

  return clean;
}

async function saveArticle(data) {
  const database = await openDatabase();
  const settings = await getSettings();

  const safeContent = sanitizeHtml(data.content || '');
  const wordCount = Number(data.wordCount) || 0;

  const article = {
    id: generateId(),
    url: data.url,
    title: (data.title || 'Untitled').slice(0, 500),
    domain: data.domain || '',
    favicon: data.favicon || '',
    excerpt: (data.excerpt || '').slice(0, 400),
    content: safeContent,
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount, settings.wordsPerMinute),
    isRead: false,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Check for existing URL first (readonly)
  const existing = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_ARTICLES, 'readonly');
    const req = tx.objectStore(STORE_ARTICLES).index('by_url').get(article.url);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (existing) {
    return { exists: true, article: existing };
  }

  // Insert in a separate write transaction
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).add(article);
    tx.oncomplete = () => resolve({ exists: false, article });
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllArticles() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_ARTICLES, 'readonly');
    const req = tx.objectStore(STORE_ARTICLES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getArticle(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_ARTICLES, 'readonly');
    const req = tx.objectStore(STORE_ARTICLES).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function updateArticle(id, updates) {
  const article = await getArticle(id);
  if (!article) return null;

  const updated = { ...article, ...updates, updatedAt: Date.now() };
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).put(updated);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteArticle(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_ARTICLES, STORE_HIGHLIGHTS], 'readwrite');
    tx.objectStore(STORE_ARTICLES).delete(id);

    const hIndex = tx.objectStore(STORE_HIGHLIGHTS).index('by_article');
    const cursorReq = hIndex.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function calculateDebt() {
  const articles = await getAllArticles();
  const unread = articles.filter((a) => !a.isRead && (a.readingTimeMinutes || 0) > 0);
  const totalMinutes = unread.reduce((sum, a) => sum + (a.readingTimeMinutes || 0), 0);
  return {
    totalMinutes,
    count: unread.length,
    articles: unread
  };
}

async function getHighlights(articleId) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_HIGHLIGHTS, 'readonly');
    const req = tx.objectStore(STORE_HIGHLIGHTS).index('by_article').getAll(articleId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveHighlight(highlight) {
  const database = await openDatabase();
  const item = {
    id: generateId(),
    articleId: highlight.articleId,
    text: String(highlight.text || '').slice(0, 2000),
    note: String(highlight.note || '').slice(0, 1000),
    color: highlight.color || 'yellow',
    startIndex: typeof highlight.startIndex === 'number' ? highlight.startIndex : null,
    endIndex: typeof highlight.endIndex === 'number' ? highlight.endIndex : null,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_HIGHLIGHTS, 'readwrite');
    tx.objectStore(STORE_HIGHLIGHTS).add(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function exportAll() {
  const articles = await getAllArticles();
  const database = await openDatabase();
  const highlights = await new Promise((resolve) => {
    const tx = database.transaction(STORE_HIGHLIGHTS, 'readonly');
    const req = tx.objectStore(STORE_HIGHLIGHTS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    articles,
    highlights
  };
}

async function updateBadge() {
  try {
    const debt = await calculateDebt();
    const settings = await getSettings();
    const total = debt.totalMinutes || 0;
    if (total <= 0) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    const label = total > 99 ? '99+' : String(total);
    await chrome.action.setBadgeText({ text: label });
    const warning = settings.debtWarningMinutes || 30;
    await chrome.action.setBadgeBackgroundColor({
      color: total >= warning ? '#E07A5F' : '#2D6A4F'
    });
  } catch (err) {
    console.warn('Badge update failed', err);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'SAVE_ARTICLE': {
          const result = await saveArticle(message.payload);
          await updateBadge();
          sendResponse(result);
          break;
        }
        case 'GET_DEBT': {
          sendResponse(await calculateDebt());
          break;
        }
        case 'GET_ARTICLES': {
          sendResponse({ articles: await getAllArticles() });
          break;
        }
        case 'GET_ARTICLE': {
          sendResponse({ article: await getArticle(message.id) });
          break;
        }
        case 'UPDATE_ARTICLE': {
          const updated = await updateArticle(message.id, message.updates);
          await updateBadge();
          sendResponse({ article: updated });
          break;
        }
        case 'DELETE_ARTICLE': {
          await deleteArticle(message.id);
          await updateBadge();
          sendResponse({ ok: true });
          break;
        }
        case 'GET_HIGHLIGHTS': {
          sendResponse({ highlights: await getHighlights(message.articleId) });
          break;
        }
        case 'SAVE_HIGHLIGHT': {
          sendResponse({ highlight: await saveHighlight(message.payload) });
          break;
        }
        case 'GET_SETTINGS': {
          sendResponse({ settings: await getSettings() });
          break;
        }
        case 'SAVE_SETTINGS': {
          await saveSettings(message.settings);
          await updateBadge();
          sendResponse({ ok: true });
          break;
        }
        case 'EXPORT_DATA': {
          sendResponse({ data: await exportAll() });
          break;
        }
        case 'EXTRACT_AND_SAVE': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) {
            sendResponse({ error: 'هیچ تب فعالی پیدا نشد.' });
            break;
          }

          const url = tab.url || '';
          if (
            url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('about:') ||
            url.startsWith('https://chrome.google.com/webstore') ||
            url.startsWith('https://chromewebstore.google.com')
          ) {
            sendResponse({
              error: 'روی این نوع صفحه نمی‌توان مقاله ذخیره کرد. یک صفحه وب معمولی باز کنید.'
            });
            break;
          }

          try {
            // Inject Mozilla Readability first
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['libs/Readability.js']
            });

            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                function getDomain(u) {
                  try {
                    return new URL(u).hostname.replace(/^www\./, '');
                  } catch {
                    return '';
                  }
                }

                const pageUrl = location.href;
                let favicon = '';
                const iconLink =
                  document.querySelector('link[rel="icon"]') ||
                  document.querySelector('link[rel="shortcut icon"]');
                if (iconLink) favicon = iconLink.href;

                // Prefer Readability when available
                if (typeof Readability !== 'undefined') {
                  try {
                    const docClone = document.cloneNode(true);
                    const reader = new Readability(docClone);
                    const article = reader.parse();
                    if (article && article.textContent) {
                      const text = (article.textContent || '').replace(/\s+/g, ' ').trim();
                      const wordCount = text.split(/\s+/).filter(Boolean).length;
                      if (wordCount >= 30) {
                        return {
                          title: article.title || document.title || 'Untitled',
                          url: pageUrl,
                          domain: getDomain(pageUrl),
                          favicon,
                          excerpt: article.excerpt || text.slice(0, 280),
                          content: article.content || '',
                          wordCount,
                          textContent: text
                        };
                      }
                    }
                  } catch (e) {
                    // fall through to simple extractor
                  }
                }

                // Fallback for complex / SPA / chat pages
                const candidates = [
                  document.querySelector('article'),
                  document.querySelector('[role="main"]'),
                  document.querySelector('main'),
                  document.querySelector('.post-content, .article-content, .entry-content'),
                  document.querySelector('#content, #main-content'),
                  document.body
                ].filter(Boolean);

                let bestText = '';
                let bestHtml = '';

                for (const el of candidates) {
                  const clone = el.cloneNode(true);
                  clone
                    .querySelectorAll(
                      'script, style, nav, footer, aside, iframe, noscript, form, .ads, .advertisement, .sidebar, .menu, .comments, .related, button'
                    )
                    .forEach((n) => n.remove());
                  const text = (clone.innerText || '').replace(/\s+/g, ' ').trim();
                  if (text.length > bestText.length) {
                    bestText = text;
                    bestHtml = clone.innerHTML;
                  }
                }

                // Stronger fallback for chat / SPA sites (DeepSeek, ChatGPT, etc.)
                if (bestText.split(/\s+/).filter(Boolean).length < 30) {
                  const parts = [];
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    {
                      acceptNode(node) {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        if (parent.closest('script, style, noscript, button, nav, footer, header, svg, [aria-hidden="true"]')) {
                          return NodeFilter.FILTER_REJECT;
                        }
                        const t = (node.nodeValue || '').trim();
                        if (t.length < 12) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                      }
                    }
                  );
                  let n;
                  while ((n = walker.nextNode())) {
                    parts.push(n.nodeValue.trim());
                  }
                  // dedupe consecutive identical lines
                  const unique = [];
                  for (const p of parts) {
                    if (unique.length === 0 || unique[unique.length - 1] !== p) {
                      unique.push(p);
                    }
                  }
                  bestText = unique.join('\n\n');
                  bestHtml = `<div class="debtread-plain" style="white-space:pre-wrap;line-height:1.7">${bestText
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')}</div>`;
                }

                const wordCount = bestText.split(/\s+/).filter(Boolean).length;
                return {
                  title: document.title || 'Untitled',
                  url: pageUrl,
                  domain: getDomain(pageUrl),
                  favicon,
                  excerpt: bestText.slice(0, 280) + (bestText.length > 280 ? '…' : ''),
                  content: bestHtml,
                  wordCount,
                  textContent: bestText
                };
              }
            });

            const data = results?.[0]?.result;
            if (!data) {
              sendResponse({ error: 'استخراج محتوا ناموفق بود.' });
              break;
            }
            if (!data.wordCount || data.wordCount < 30) {
              sendResponse({ error: 'محتوای معناداری از این صفحه استخراج نشد.' });
              break;
            }

            const result = await saveArticle(data);
            await updateBadge();
            sendResponse(result);
          } catch (err) {
            sendResponse({
              error:
                'ارتباط با صفحه برقرار نشد. صفحه را یک‌بار رفرش کنید و دوباره تلاش کنید.'
            });
          }
          break;
        }
        case 'ADD_TAG': {
          const article = await getArticle(message.articleId);
          if (!article) {
            sendResponse({ error: 'Article not found' });
            break;
          }
          const tag = String(message.tag || '').trim().toLowerCase().slice(0, 40);
          if (!tag) {
            sendResponse({ error: 'Empty tag' });
            break;
          }
          const tags = Array.isArray(article.tags) ? [...article.tags] : [];
          if (!tags.includes(tag)) tags.push(tag);
          const updated = await updateArticle(message.articleId, { tags });
          sendResponse({ article: updated });
          break;
        }
        case 'REMOVE_TAG': {
          const article = await getArticle(message.articleId);
          if (!article) {
            sendResponse({ error: 'Article not found' });
            break;
          }
          const tag = String(message.tag || '').trim().toLowerCase();
          const tags = (Array.isArray(article.tags) ? article.tags : []).filter((t) => t !== tag);
          const updated = await updateArticle(message.articleId, { tags });
          sendResponse({ article: updated });
          break;
        }
        case 'GET_STALE': {
          const days = Number(message.days) || 90;
          const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
          const articles = await getAllArticles();
          const stale = articles
            .filter((a) => !a.isRead && a.createdAt < cutoff)
            .sort((a, b) => a.createdAt - b.createdAt);
          sendResponse({ articles: stale });
          break;
        }
        case 'GET_ALL_TAGS': {
          const articles = await getAllArticles();
          const set = new Set();
          articles.forEach((a) => {
            (a.tags || []).forEach((t) => set.add(t));
          });
          sendResponse({ tags: [...set].sort() });
          break;
        }
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ error: err.message || 'Unexpected error' });
    }
  })();
  return true;
});

(async () => {
  try {
    await openDatabase();
    await updateBadge();
  } catch {
    // Startup failures are non-fatal
  }
})();
