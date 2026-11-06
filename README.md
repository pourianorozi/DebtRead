# DebtRead

**Local reading debt tracker for Google Chrome.**

Save articles, estimate how long they take to read, highlight important passages, tag items, and keep a clear view of how much unread material you have left — entirely on your device.

No accounts. No servers. No paid APIs. No tracking.

---

## Why DebtRead?

Most “read later” tools either shut down, lock your data in the cloud, or charge a subscription. DebtRead is a local alternative focused on one useful idea:

> **Reading debt** — the total estimated time still sitting in your queue.

When you open the popup you immediately see something like:

**2h 15m reading debt · 12 unread articles**

That number turns an endless pile of tabs into something you can manage.

---

## Features

| Feature | Description |
|--------|-------------|
| **One-click save** | Capture the current page from the toolbar |
| **Smart extraction** | Uses Mozilla Readability when possible, with a strong fallback for complex / SPA pages |
| **Reading time** | Estimated from word count (configurable WPM) |
| **Reading debt badge** | Toolbar badge shows total unread minutes |
| **Clean reader** | Distraction-free internal reading view |
| **Highlights** | Select text, choose a color; highlights are restored on reopen |
| **Tags** | Add / remove tags per article |
| **Fuzzy search** | Search titles and excerpts with Fuse.js |
| **“What fits in 10 minutes?”** | Filter short articles for spare moments |
| **Decision Mode** | Surface old unread items so you can mark read or delete |
| **Export** | Full JSON backup, or highlights as Markdown |
| **100% local** | IndexedDB only — nothing leaves the browser |

---

## Install (Developer mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the project folder (the one that contains `manifest.json`).

The DebtRead icon appears in the toolbar.

---

## How to use

1. Open any article or page worth reading later.
2. Click the DebtRead icon → **ذخیره این صفحه** (Save this page).
3. Watch your reading debt update in the popup and on the badge.
4. Open an item from the priority list to read it in the clean viewer.
5. Select text in the reader to highlight it; add tags from the sidebar.
6. Use **خروجی** to export JSON or Markdown highlights.

---

## Project structure

```
DebtRead/
├── manifest.json          # Manifest V3
├── popup.html             # Toolbar popup
├── options.html           # Settings & About
├── reader/
│   └── reader.html        # Clean reading view
├── src/
│   ├── background.js      # Service worker, IndexedDB, extraction
│   ├── popup.js
│   ├── reader.js
│   └── options.js
├── styles/
│   ├── popup.css
│   └── reader.css
├── libs/
│   ├── Readability.js     # Mozilla Readability (local)
│   └── fuse.min.js        # Fuzzy search (local)
└── icons/
    └── icon16/32/48/128.png
```

---

## Permissions

| Permission | Reason |
|-----------|--------|
| `activeTab` | Access the page you choose to save |
| `scripting` | Run extraction on that page when you click Save |
| `storage` | Not used for sync; data lives in IndexedDB |
| `tabs` | Open the reader and query the active tab |

No broad permanent host access is required beyond what is needed at save time. All processing stays on your machine.

---

## Privacy

- Data is stored only in the browser’s **IndexedDB**.
- No analytics, no telemetry, no remote calls for core features.
- Export gives you a portable JSON of articles and highlights whenever you want.

---

## Tech notes

- **Manifest V3** service worker
- **Mozilla Readability** for article extraction (bundled)
- Fallback text walker for chat / SPA pages when Readability returns little content
- Basic HTML sanitization before storage
- Highlight positions stored as character offsets (with text fallback on restore)

---

## Roadmap (ideas)

- Tag filter in the popup
- Stronger sanitization (e.g. local DOMPurify)
- Import from Pocket HTML/CSV exports
- Optional auto-archive rules

---

## License

MIT — use, modify, and share freely.

---

## Author

**پوریا نوروزی (Pooriya Norouzi)**  
GitHub: [github.com/pourianorozi](https://github.com/pourianorozi)

Built for personal productivity. Feedback and contributions are welcome.
