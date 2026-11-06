/**
 * DebtRead options page
 */

const wpmInput = document.getElementById('wpm');
const warningInput = document.getElementById('warningMinutes');
const archiveInput = document.getElementById('autoArchiveDays');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
}

async function load() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const s = res?.settings || {};
    wpmInput.value = s.wordsPerMinute ?? 200;
    warningInput.value = s.debtWarningMinutes ?? 30;
    if (archiveInput) archiveInput.value = s.autoArchiveDays ?? 90;
  } catch (e) {
    showStatus('خطا در بارگذاری');
  }
}

saveBtn.addEventListener('click', async () => {
  const settings = {
    wordsPerMinute: Number(wpmInput.value) || 200,
    debtWarningMinutes: Number(warningInput.value) || 30,
    autoArchiveDays: archiveInput ? (Number(archiveInput.value) || 90) : 90
  };
  try {
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
    showStatus('تنظیمات ذخیره شد');
  } catch (e) {
    showStatus('خطا در ذخیره');
  }
});

resetBtn.addEventListener('click', async () => {
  wpmInput.value = 200;
  warningInput.value = 30;
  if (archiveInput) archiveInput.value = 90;
  await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { wordsPerMinute: 200, debtWarningMinutes: 30, autoArchiveDays: 90 }
  });
  showStatus('به حالت پیش‌فرض بازگشت');
});

load();
