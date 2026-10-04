# ZenDoc — Client-Side Document Processing

**100% client-side.** Files never leave your browser.

Built from the ZenDoc technical blueprint (2026). Privacy-first PDF and image tools with no backend.

## Features (27 tools)

### PDF
- Merge, Split, Compress (rasterize), Delete / Extract pages
- Rotate, Reorder (drag-drop), Watermark, Page numbers
- Remove metadata, Password protect / Unlock (limited without pdf-lib-encrypt)
- Extract text

### Convert
- Images → PDF, PDF → Images (ZIP)

### Image
- Compress, Resize, Convert (JPEG/PNG/WebP), Crop
- Rotate/Flip, Remove EXIF, Watermark

### Utils
- File info, Blank PDF, ZIP, SHA hash, Base64

## Quick start

No build step required. Serve the folder over HTTP (ES modules + CORS for workers).

```bash
# Python
cd ZenDoc
python3 -m http.server 8080

# Node
npx serve .

# VS Code Live Server, etc.
```

Open `http://localhost:8080`.

Libraries load from jsDelivr CDN (pdf-lib, pdf.js, jsPDF, browser-image-compression, JSZip, FileSaver, SortableJS).

## Stack note

The blueprint targets a static SPA. This implementation follows that architecture for reliability and offline-friendly hosting (GitHub Pages, Netlify, Vercel static).

If you need Next.js 14 App Router + Tailwind + Framer Motion as a wrapper, the same tool modules can be imported into client components (`'use client'`) with dynamic imports for heavy libraries.

## Project structure

```
ZenDoc/
├── index.html
├── manifest.json
├── css/style.css
├── js/
│   ├── app.js          # Router, state, tool orchestration
│   ├── ui.js           # Toasts, modals, options templates
│   ├── utils.js        # Formatters, hashes, helpers
│   └── tools/
│       ├── pdf-tools.js
│       ├── image-tools.js
│       └── utility-tools.js
└── README.md
```

## Assumptions

1. **Password encryption**: Stock pdf-lib has no AES. UI is present; full encryption needs `pdf-lib-encrypt` vendored. Unlock uses pdf-lib password option where supported.
2. **pdf.js version**: Blueprint listed 6.x; CDN uses 4.4.x (stable, widely available). API compatible for rendering/text.
3. **Crop UI**: Numeric crop rect (not interactive drag handles) for first version; coordinates match blueprint API.
4. **Next.js requirement**: Delivered as static client app matching blueprint §1–§5; same logic ports to Next client components.
5. **Hindi/Arabic watermarks**: Standard fonts only (Latin); custom font embed path documented in blueprint.

## Self-check vs blueprint

| Area | Status |
|------|--------|
| Layout (navbar, sidebar, upload, options, progress, footer) | Complete |
| Design tokens / dark mode | Complete |
| PDF merge/split/delete/extract/rotate/reorder | Complete |
| PDF compress (rasterize) | Complete |
| Watermark, page numbers, remove metadata | Complete |
| Images↔PDF | Complete |
| Image compress/resize/convert/crop/rotate/EXIF/watermark | Complete |
| ZIP, hash, base64, file info, blank PDF | Complete |
| Protect/Unlock | UI + best-effort (encrypt package optional) |
| PWA manifest | Present (service worker optional) |
| Responsive (360 / 768 / 1440) | Complete |
| Accessibility (ARIA, focus, keyboard) | Basic complete |
| Drag-drop reorder (SortableJS) | Complete |

## License

MIT — libraries retain their own licenses (MIT / Apache-2.0).
