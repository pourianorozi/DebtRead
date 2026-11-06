/**
 * DebtRead reader page – v1.3
 */

const params = new URLSearchParams(location.search);
const articleId = params.get('id');

const titleEl = document.getElementById('title');
const metaEl = document.getElementById('meta');
const contentEl = document.getElementById('content');
const highlightListEl = document.getElementById('highlightList');
const tagListEl = document.getElementById('tagList');
const tagInput = document.getElementById('tagInput');
const addTagBtn = document.getElementById('addTagBtn');
const markReadBtn = document.getElementById('markReadBtn');
const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');
const highlightMenu = document.getElementById('highlightMenu');

let currentArticle = null;
let pendingSelection = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTextOffset(root, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function applyHighlights(highlights) {
  // Remove previous marks so offsets match the original stored HTML
  contentEl.querySelectorAll('mark[data-hl]').forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });

  const list = (highlights || []).slice().sort((a, b) => {
    const ai = typeof a.startIndex === 'number' ? a.startIndex : -1;
    const bi = typeof b.startIndex === 'number' ? b.startIndex : -1;
    return bi - ai; // from end to start
  });

  for (const h of list) {
    const color = h.color || 'yellow';
    let applied = false;

    if (typeof h.startIndex === 'number' && typeof h.endIndex === 'number') {
      applied = wrapRange(contentEl, h.startIndex, h.endIndex, color, h.id);
    }

    // Fallback: locate by exact text snippet if offset-based wrap failed
    if (!applied && h.text && h.text.length >= 3) {
      applied = wrapByText(contentEl, h.text, color, h.id);
    }
  }
}

function wrapByText(root, needle, color, hlId) {
  const full = root.textContent || '';
  const idx = full.indexOf(needle);
  if (idx < 0) return false;
  return wrapRange(root, idx, idx + needle.length, color, hlId);
}

function wrapRange(root, startIndex, endIndex, color, hlId) {
  if (endIndex <= startIndex) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current = 0;
  let startNode = null;
  let startOff = 0;
  let endNode = null;
  let endOff = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const len = node.textContent.length;
    const next = current + len;

    if (startNode === null && startIndex >= current && startIndex <= next) {
      startNode = node;
      startOff = startIndex - current;
    }
    if (endIndex >= current && endIndex <= next) {
      endNode = node;
      endOff = endIndex - current;
      break;
    }
    current = next;
  }

  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);

    // Works across nested tags (unlike surroundContents)
    const fragment = range.extractContents();
    const mark = document.createElement('mark');
    mark.className = `hl-${color}`;
    mark.dataset.hl = hlId || '';
    mark.appendChild(fragment);
    range.insertNode(mark);
    return true;
  } catch (e) {
    console.warn('Highlight failed:', e);
    return false;
  }
}

async function loadArticle() {
  if (!articleId) {
    titleEl.textContent = 'مقاله یافت نشد';
    return;
  }

  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_ARTICLE', id: articleId });
    currentArticle = res?.article;

    if (!currentArticle) {
      titleEl.textContent = 'مقاله یافت نشد';
      return;
    }

    document.title = currentArticle.title;
    titleEl.textContent = currentArticle.title;
    metaEl.innerHTML = `
      <span>${escapeHtml(currentArticle.domain || '')}</span>
      ·
      <span>${currentArticle.readingTimeMinutes || 0} دقیقه مطالعه</span>
      ·
      <span>${new Date(currentArticle.createdAt).toLocaleDateString('fa-IR')}</span>
    `;

    contentEl.innerHTML =
      currentArticle.content || `<p>${escapeHtml(currentArticle.excerpt || '')}</p>`;

    if (currentArticle.isRead) {
      markReadBtn.textContent = 'خوانده‌شده';
      markReadBtn.disabled = true;
    }

    renderTags(currentArticle.tags || []);
    await loadHighlights();
  } catch {
    titleEl.textContent = 'خطا در بارگذاری مقاله';
    contentEl.innerHTML =
      '<p>ارتباط با اکستنشن برقرار نشد. صفحه extensions را باز کنید و اکستنشن را Refresh کنید.</p>';
  }
}

function renderTags(tags) {
  if (!tags.length) {
    tagListEl.innerHTML = '<span style="color:var(--muted);font-size:12px">بدون تگ</span>';
    return;
  }
  tagListEl.innerHTML = tags
    .map(
      (t) => `
    <span class="tag-chip">
      ${escapeHtml(t)}
      <button data-tag="${escapeHtml(t)}" title="حذف">×</button>
    </span>
  `
    )
    .join('');

  tagListEl.querySelectorAll('button[data-tag]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'REMOVE_TAG',
          articleId,
          tag: btn.dataset.tag
        });
        if (res?.article) {
          currentArticle = res.article;
          renderTags(res.article.tags || []);
        }
      } catch {
        alert('حذف تگ ناموفق بود.');
      }
    });
  });
}

async function loadHighlights() {
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS',
      articleId
    });
    const highlights = res?.highlights || [];

    applyHighlights(highlights);

    if (!highlights.length) {
      highlightListEl.innerHTML =
        '<p class="empty-side">متنی را انتخاب کنید تا هایلایت شود.</p>';
      return;
    }

    highlightListEl.innerHTML = highlights
      .map(
        (h) => `
      <div class="highlight-item ${h.color || 'yellow'}">
        <div class="text">${escapeHtml(h.text)}</div>
        ${
          h.note
            ? `<div style="margin-top:6px;color:var(--muted);font-size:12px">${escapeHtml(h.note)}</div>`
            : ''
        }
      </div>
    `
      )
      .join('');
  } catch {
    highlightListEl.innerHTML = '<p class="empty-side">خطا در بارگذاری هایلایت‌ها</p>';
  }
}

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (!text || text.length < 3 || !contentEl.contains(selection.anchorNode)) {
    highlightMenu.classList.add('hidden');
    pendingSelection = null;
    return;
  }

  try {
    const range = selection.getRangeAt(0);
    const startIndex = getTextOffset(contentEl, range.startContainer, range.startOffset);
    const endIndex = startIndex + text.length;

    pendingSelection = { text, startIndex, endIndex };

    const rect = range.getBoundingClientRect();
    const menuWidth = 180;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    highlightMenu.style.top = `${window.scrollY + rect.bottom + 8}px`;
    highlightMenu.style.left = `${left}px`;
    highlightMenu.classList.remove('hidden');
  } catch {
    highlightMenu.classList.add('hidden');
  }
});

highlightMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn || !currentArticle || !pendingSelection) return;

  const color = btn.dataset.color;

  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      payload: {
        articleId: currentArticle.id,
        text: pendingSelection.text,
        color,
        note: '',
        startIndex: pendingSelection.startIndex,
        endIndex: pendingSelection.endIndex
      }
    });
    highlightMenu.classList.add('hidden');
    window.getSelection()?.removeAllRanges();
    pendingSelection = null;
    await loadHighlights();
  } catch {
    alert('ذخیره هایلایت ناموفق بود.');
  }
});

document.addEventListener('mousedown', (e) => {
  if (!highlightMenu.contains(e.target)) {
    highlightMenu.classList.add('hidden');
  }
});

addTagBtn.addEventListener('click', async () => {
  const tag = (tagInput.value || '').trim();
  if (!tag || !currentArticle) return;
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'ADD_TAG',
      articleId,
      tag
    });
    if (res?.article) {
      currentArticle = res.article;
      renderTags(res.article.tags || []);
      tagInput.value = '';
    } else if (res?.error) {
      alert(res.error);
    }
  } catch {
    alert('افزودن تگ ناموفق بود.');
  }
});

tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTagBtn.click();
});

markReadBtn.addEventListener('click', async () => {
  if (!currentArticle) return;
  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ARTICLE',
      id: currentArticle.id,
      updates: { isRead: true }
    });
    markReadBtn.textContent = 'خوانده‌شده';
    markReadBtn.disabled = true;
    currentArticle.isRead = true;
  } catch {
    alert('به‌روزرسانی وضعیت ناموفق بود.');
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!currentArticle) return;
  if (!confirm('این مقاله حذف شود؟')) return;
  try {
    await chrome.runtime.sendMessage({ type: 'DELETE_ARTICLE', id: currentArticle.id });
    window.close();
  } catch {
    alert('حذف ناموفق بود.');
  }
});

backBtn.addEventListener('click', () => window.close());

loadArticle();
