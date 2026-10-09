# ZenDoc — Free Private PDF & Image Tools

**Merge, split, compress, protect, and convert PDFs and images — 100% in your browser.**

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://tanishq-kushwaha.github.io/ZenDoc/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Offline](https://img.shields.io/badge/offline-ready-brightgreen)](#)
[![Client-Side](https://img.shields.io/badge/100%25-client--side-purple)](#)
[![PWA](https://img.shields.io/badge/PWA-installable-orange)](#)
[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/tanishq-kushwaha/zendoc?utm_source=readme&utm_medium=badge)

**Live app:** [https://tanishq-kushwaha.github.io/ZenDoc/](https://tanishq-kushwaha.github.io/ZenDoc/)


---

## Why ZenDoc?

| Feature | Description |
|--------|-------------|
| 🔒 **Private** | Files never leave your browser. No uploads, no servers, no accounts. |
| ⚡ **Fast** | All processing runs on your device. |
| 📴 **Offline** | Works without internet after the first load (PWA-ready). |
| 💸 **Free** | 27 tools — no ads, no signup, no usage limits. |
| 🔐 **Secure** | Real **AES-256** encryption for PDF password protection. |
| 🌙 **Dark mode** | Built-in light/dark theme toggle. |

---

## 27 Tools

### 📄 PDF (13)

| Tool | Description |
|------|-------------|
| **Merge** | Combine multiple PDFs into one |
| **Split** | Divide a PDF by page ranges |
| **Compress** | Reduce PDF size |
| **Delete Pages** | Remove specific pages |
| **Extract Pages** | Extract selected pages into a new PDF |
| **Rotate** | Rotate pages 90° / 180° / 270° |
| **Reorder** | Drag-and-drop page reordering |
| **Watermark** | Add a text watermark to every page |
| **Page Numbers** | Add page numbers |
| **Remove Metadata** | Strip author, title, and other metadata |
| **Password Protect** | Lock PDFs with **AES-256** encryption |
| **Unlock** | Remove password protection (if you know the password) |
| **Extract Text** | Pull text content from a PDF |

### 🔄 Convert (2)

| Tool | Description |
|------|-------------|
| **Images → PDF** | Turn one or more images into a PDF |
| **PDF → Images** | Export PDF pages as images |

### 🖼️ Image (7)

| Tool | Description |
|------|-------------|
| **Compress** | Reduce image file size |
| **Resize** | Change dimensions |
| **Convert Format** | Switch between common image formats |
| **Crop** | Crop to a custom region |
| **Rotate / Flip** | Rotate or flip images |
| **Remove EXIF** | Strip metadata from images |
| **Watermark** | Add a text watermark |

### 🔧 Utils (5)

| Tool | Description |
|------|-------------|
| **File Info** | View size, type, and basic details |
| **Blank PDF** | Generate an empty PDF |
| **ZIP** | Create ZIP archives |
| **Hash** | Compute SHA-1 / SHA-256 / SHA-512 |
| **Base64** | Encode / decode Base64 |

---

## How it works

1. Open the [live app](https://tanishq-kushwaha.github.io/ZenDoc/).
2. Pick a tool from the grid (or use the search bar).
3. Drop or select your file(s) — processing stays **entirely in the browser**.
4. Download the result. Nothing is uploaded or stored on any server.

After the first visit, ZenDoc can work **offline** (service worker / PWA).

---

## Tech stack

- **Vanilla HTML, CSS, JavaScript** (ES modules)
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF create / edit / encrypt
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF generation helpers
- **[JSZip](https://stuk.github.io/jszip/)** — ZIP creation
- **FileSaver.js** — reliable downloads
- **SortableJS** — drag-and-drop page reorder
- **Buffer polyfill** — Node-style `Buffer` for browser crypto / PDF libs
- **Font Awesome** — icons
- **PWA** — `manifest.json` + offline-friendly design

No backend. No analytics. No tracking scripts.


---
[![Architecture diagram of tanishq-kushwaha/zendoc](https://gitdiagram.com/tanishq-kushwaha/zendoc/diagram.png)](https://gitdiagram.com/tanishq-kushwaha/zendoc?utm_source=readme&utm_medium=picture)
---

## Project structure

```
ZenDoc/
├── index.html          # App shell + SEO meta
├── css/
│   └── style.css       # Styles (incl. dark mode)
├── js/
│   ├── app.js          # Main application logic
│   ├── ui.js           # UI helpers (toasts, modals, progress)
│   ├── utils.js        # Shared utilities
│   ├── tools/
│   │   ├── pdf-tools.js
│   │   ├── image-tools.js
│   │   └── utility-tools.js
│   └── lib/            # Vendored client-side libraries
├── manifest.json       # PWA manifest
├── robots.txt
├── sitemap.xml
├── LICENSE             # MIT
└── README.md
```

---

## Local development

```bash
# Clone the repo
git clone https://github.com/Tanishq-kushwaha/ZenDoc.git
cd ZenDoc

# Serve with any static server (example with Python)
python -m http.server 8080

# Or with Node
npx serve .
```

Open `http://localhost:8080` in your browser.

> **Note:** Some browsers restrict certain APIs on `file://`. Always use a local HTTP server.

---

## Browser support

Modern browsers with ES module support (Chrome, Firefox, Edge, Safari — recent versions).  
Best experience on desktop; mobile is fully usable for lighter tasks.

---

## Privacy

- **Zero upload** — files are processed only in memory on your device.
- **Zero accounts** — no sign-up, no cookies for identity.
- **Zero tracking** — no analytics or third-party trackers in the app logic.
- **Offline-capable** — after first load, core tools work without a network.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Tanishq Kushwaha

---

## Author

**Tanishq Kushwaha**  
IT Diploma student · Web development & C · Junior SDE certified  

- Portfolio: [tanishq-kushwaha.github.io/tanishq-portfolio](https://tanishq-kushwaha.github.io/tanishq-portfolio/)  
- GitHub: [github.com/Tanishq-kushwaha](https://github.com/Tanishq-kushwaha)

---

## Contributing

Issues and pull requests are welcome. If you add a tool or fix a bug:

1. Fork the repo  
2. Create a feature branch  
3. Open a PR with a clear description  

Keep everything **client-side** — no backend dependencies.

---

<p align="center">
  <strong>ZenDoc</strong> — private document tools, free forever.
  <br />
  <a href="https://tanishq-kushwaha.github.io/ZenDoc/">Open the app →</a>
</p>
