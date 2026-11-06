/**
 * DebtRead popup logic
 */

const debtMinutesEl = document.getElementById('debtMinutes');
const debtCountEl = document.getElementById('debtCount');
const articleListEl = document.getElementById('articleList');
const saveBtn = document.getElementById('saveBtn');
const quickBtn = document.getElementById('quickBtn');
const refreshBtn = document.getElementById('refreshBtn');
const optionsBtn = document.getElementById('optionsBtn');
const exportBtn = document.getElementById('exportBtn');
const searchInput = document.getElementById('searchInput');

let currentFilter = 'all';
let allUnread = [];
let fuse = null;

function formatMinutes(m) {
  if (m < 60) return String(m);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min === 0 ? `${h}س` : `${h}س ${min}د`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFuse(articles) {
  if (typeof Fuse === 'undefined') return null;
  return new Fuse(articles, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'excerpt', weight: 0.3 },
      { name: 'domain', weight: 0.1 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  });
}

function getFilteredArticles() {
  let list = allUnread;

  if (currentFilter === 'short') {
    list = list.filter((a) => (a.readingTimeMinutes || 0) <= 10);
  }

  const query = (searchInput.value || '').trim();
  if (query && fuse) {
    list = fuse.search(query).map((r) => r.item);
  }

  list = [...list].sort((a, b) => {
    const ageA = Date.now() - a.createdAt;
    const ageB = Date.now() - b.createdAt;
    const month = 1000 * 60 * 60 * 24 * 30;
    if (ageA > month && ageB <= month) return -1;
    if (ageB > month && ageA <= month) return 1;
    return (a.readingTimeMinutes || 0) - (b.readingTimeMinutes || 0);
  });

  return list;
}

function renderList(articles) {
  if (!articles.length) {
    const msg =
      (searchInput.value || '').trim()
        ? 'نتیجه‌ای پیدا نشد.'
        : currentFilter === 'short'
          ? 'مقاله کوتاهی در صف نیست.'
          : 'هنوز مقاله‌ای ذخیره نشده است.<br>یک مقاله باز کنید و دکمه ذخیره را بزنید.';
    articleListEl.innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }

  articleListEl.innerHTML = articles
    .slice(0, 20)
    .map(
      (a) => `
    <div class="article-item" data-id="${a.id}">
      <div class="article-info">
        <div class="article-title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>
        <div class="article-meta">
          <span>${escapeHtml(a.domain || '')}</span>
          <span>${formatDate(a.createdAt)}</span>
        </div>
      </div>
      <span class="time-badge">${a.readingTimeMinutes || 0}د</span>
    </div>
  `
    )
    .join('');

  articleListEl.querySelectorAll('.article-item').forEach((el) => {
    el.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL(`reader/reader.html?id=${el.dataset.id}`)
      });
    });
  });
}

async function loadDebt() {
  try {
    const debt = await chrome.runtime.sendMessage({ type: 'GET_DEBT' });
    if (!debt) throw new Error('No response');

    debtMinutesEl.textContent = formatMinutes(debt.totalMinutes || 0);
    debtCountEl.textContent = `${(debt.count || 0).toLocaleString('fa-IR')} مقاله خوانده‌نشده`;

    allUnread = debt.articles || [];
    fuse = buildFuse(allUnread);
    renderList(getFilteredArticles());
  } catch (e) {
    debtMinutesEl.textContent = '—';
    debtCountEl.textContent = 'خطا در بارگذاری';
    articleListEl.innerHTML =
      '<div class="empty">خطا در بارگذاری داده‌ها. اکستنشن را Refresh کنید.</div>';
  }
}

async function loadStale() {
  const section = document.getElementById('staleSection');
  const list = document.getElementById('staleList');
  if (!section || !list) return;

  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_STALE', days: 90 });
    const articles = res?.articles || [];
    if (!articles.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    list.innerHTML = articles
      .slice(0, 5)
      .map(
        (a) => `
      <div class="article-item" data-id="${a.id}">
        <div class="article-info">
          <div class="article-title">${escapeHtml(a.title)}</div>
          <div class="article-meta">
            <span>${escapeHtml(a.domain || '')}</span>
            <span>${formatDate(a.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="stale-btn" data-action="read" data-id="${a.id}" style="font-size:10px;padding:2px 6px;cursor:pointer;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text)">خواندم</button>
          <button class="stale-btn" data-action="delete" data-id="${a.id}" style="font-size:10px;padding:2px 6px;cursor:pointer;border-radius:4px;border:1px solid rgba(224,122,95,0.4);background:transparent;color:var(--accent)">حذف</button>
        </div>
      </div>
    `
      )
      .join('');

    list.querySelectorAll('.stale-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        try {
          if (action === 'read') {
            await chrome.runtime.sendMessage({
              type: 'UPDATE_ARTICLE',
              id,
              updates: { isRead: true }
            });
          } else if (action === 'delete') {
            await chrome.runtime.sendMessage({ type: 'DELETE_ARTICLE', id });
          }
          await loadDebt();
          await loadStale();
        } catch {
          alert('عملیات ناموفق بود');
        }
      });
    });

    list.querySelectorAll('.article-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.stale-btn')) return;
        chrome.tabs.create({
          url: chrome.runtime.getURL(`reader/reader.html?id=${el.dataset.id}`)
        });
      });
    });
  } catch {
    section.style.display = 'none';
  }
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'در حال ذخیره...';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'EXTRACT_AND_SAVE' });

    if (!result) {
      alert('پاسخی از اکستنشن دریافت نشد. صفحه extensions را Refresh کنید.');
      return;
    }
    if (result.error) {
      alert(result.error);
      return;
    }
    if (result.exists) {
      alert('این صفحه قبلاً ذخیره شده است.');
      return;
    }
    await loadDebt();
    await loadStale();
  } catch (e) {
    alert(
      'خطا در ارتباط با اکستنشن. صفحه extensions را باز کنید، روی Refresh اکستنشن کلیک کنید و دوباره تلاش کنید.'
    );
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'ذخیره این صفحه';
  }
});

quickBtn.addEventListener('click', () => {
  currentFilter = currentFilter === 'short' ? 'all' : 'short';
  quickBtn.textContent = currentFilter === 'short' ? 'نمایش همه' : '۱۰ دقیقه چیه؟';
  renderList(getFilteredArticles());
});

searchInput.addEventListener('input', () => {
  renderList(getFilteredArticles());
});

refreshBtn.addEventListener('click', () => {
  loadDebt();
  loadStale();
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

exportBtn.addEventListener('click', async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
    if (!res?.data) {
      alert('خروجی ناموفق بود.');
      return;
    }

    const choice = confirm(
      'خروجی JSON کامل؟\n\nOK = JSON کامل\nCancel = فقط هایلایت‌ها به صورت Markdown'
    );

    if (choice) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debtread-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const { articles = [], highlights = [] } = res.data;
      const byArticle = {};
      highlights.forEach((h) => {
        if (!byArticle[h.articleId]) byArticle[h.articleId] = [];
        byArticle[h.articleId].push(h);
      });

      let md = `# DebtRead Highlights\n\nExported: ${new Date().toISOString()}\n\n`;
      articles.forEach((a) => {
        const hs = byArticle[a.id] || [];
        if (!hs.length) return;
        md += `## ${a.title}\n`;
        md += `Source: ${a.url}\n\n`;
        hs.forEach((h) => {
          md += `> ${h.text.replace(/\n/g, ' ')}\n`;
          if (h.note) md += `\n*Note: ${h.note}*\n`;
          md += `\n`;
        });
        md += `---\n\n`;
      });

      if (md.length < 80) {
        alert('هیچ هایلایتی برای خروجی وجود ندارد.');
        return;
      }

      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debtread-highlights-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error(e);
    alert('خطا در خروجی گرفتن');
  }
});

// شروع برنامه
loadDebt();
loadStale();
