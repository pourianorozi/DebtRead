# DebtRead

Local reading debt tracker for Chrome.

Save articles, estimate reading time, manage your queue, highlight text and keep everything on your device. No accounts, no servers, no paid APIs.

## Features

- One-click save of the current page
- Automatic reading time estimation
- Live reading debt counter
- Priority queue with “what can I read in 10 minutes?” filter
- Clean internal reader
- Local highlights
- JSON export
- Fully offline after installation

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `debtread` folder

## Usage

1. Open any article
2. Click the DebtRead icon → **ذخیره این صفحه**
3. Watch your reading debt update
4. Open items from the priority list to read in the clean viewer
5. Select text in the reader to highlight

## Technical notes

- Manifest V3
- IndexedDB for storage
- Simple content extraction (works on most article pages)
- All processing happens locally

## License

Personal use. Modify freely.
