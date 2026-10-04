/**
 * ZenDoc — Main application (100% client-side)
 *
 * FIXES / IMPROVEMENTS in this version:
 *  - All previously nested functions (initDashboard, showDashboard, initNav,
 *    addFiles, updateFileUI, loadPageThumbs, runTool, executeTool,
 *    bindToolSpecificOptions) are now TOP-LEVEL (bug: they were defined
 *    inside switchTool and were unreachable from DOMContentLoaded).
 *  - Removed duplicate initNav.
 *  - Options panel is now populated via buildOptionsHTML(toolId) and
 *    bindRangeLabels() on every tool switch.
 *  - File input `accept` and `multiple` now update per tool.
 *  - Tool title, description, upload hint, and drop-zone visibility update.
 *  - Null-safe DOM access everywhere.
 *  - resetSubUI() centralises clearing the workspace between tools.
 */

import {
  formatBytes, downloadBlob, getAcceptForTool, parsePageRanges, warnLargeFile,
} from './utils.js';
import {
  showToast, setProgress, openModal, closeModal, handleError,
  renderFileList, buildOptionsHTML, bindRangeLabels,
} from './ui.js';
import * as PDF from './tools/pdf-tools.js';
import * as IMG from './tools/image-tools.js';
import * as UTIL from './tools/utility-tools.js';

/* ------------------------------------------------------------------ */
/* Tool metadata                                                       */
/* ------------------------------------------------------------------ */
const TOOL_META = {
  merge: { title: 'Merge PDFs', desc: 'Combine multiple PDFs into a single document. Files never leave your browser.', multi: true, minFiles: 2, accept: 'pdf' },
  split: { title: 'Split PDF', desc: 'Divide a PDF into multiple parts by page ranges.', multi: false, minFiles: 1, accept: 'pdf' },
  'compress-pdf': { title: 'Compress PDF', desc: 'Reduce PDF size by rasterizing pages. Text will no longer be searchable.', multi: false, minFiles: 1, accept: 'pdf' },
  'delete-pages': { title: 'Delete Pages', desc: 'Remove specific pages from a PDF.', multi: false, minFiles: 1, accept: 'pdf' },
  'extract-pages': { title: 'Extract Pages', desc: 'Extract selected pages into a new PDF.', multi: false, minFiles: 1, accept: 'pdf' },
  rotate: { title: 'Rotate Pages', desc: 'Rotate pages 90°, 180°, or 270°.', multi: false, minFiles: 1, accept: 'pdf' },
  reorder: { title: 'Reorder Pages', desc: 'Drag pages to change their order.', multi: false, minFiles: 1, accept: 'pdf' },
  'watermark-pdf': { title: 'Watermark PDF', desc: 'Add a text watermark to every page.', multi: false, minFiles: 1, accept: 'pdf' },
  'page-numbers': { title: 'Page Numbers', desc: 'Add page numbers to your PDF.', multi: false, minFiles: 1, accept: 'pdf' },
  'remove-meta': { title: 'Remove Metadata', desc: 'Strip author, title, and other PDF metadata.', multi: false, minFiles: 1, accept: 'pdf' },
  protect: { title: 'Password Protect', desc: 'Lock a PDF with a password (full AES needs pdf-lib-encrypt).', multi: false, minFiles: 1, accept: 'pdf' },
  unlock: { title: 'Unlock PDF', desc: 'Decrypt a password-protected PDF when you know the password.', multi: false, minFiles: 1, accept: 'pdf' },
  'extract-text': { title: 'Extract Text', desc: 'Pull text content from the PDF text layer.', multi: false, minFiles: 1, accept: 'pdf' },
  'images-to-pdf': { title: 'Images → PDF', desc: 'Combine images into a single PDF.', multi: true, minFiles: 1, accept: 'image' },
  'pdf-to-images': { title: 'PDF → Images', desc: 'Convert each PDF page to an image.', multi: false, minFiles: 1, accept: 'pdf' },
  'compress-img': { title: 'Compress Image', desc: 'Reduce image file size with quality control.', multi: false, minFiles: 1, accept: 'image' },
  resize: { title: 'Resize Image', desc: 'Change image dimensions.', multi: false, minFiles: 1, accept: 'image' },
  'convert-img': { title: 'Convert Format', desc: 'Convert between JPEG, PNG, and WebP.', multi: false, minFiles: 1, accept: 'image' },
  crop: { title: 'Crop Image', desc: 'Extract a rectangular region from an image.', multi: false, minFiles: 1, accept: 'image' },
  'rotate-img': { title: 'Rotate / Flip', desc: 'Rotate or flip an image.', multi: false, minFiles: 1, accept: 'image' },
  'remove-exif': { title: 'Remove EXIF', desc: 'Strip camera, GPS, and timestamp metadata.', multi: false, minFiles: 1, accept: 'image' },
  'watermark-img': { title: 'Watermark Image', desc: 'Overlay text watermark on an image.', multi: false, minFiles: 1, accept: 'image' },
  'file-info': { title: 'File Info', desc: 'Display file metadata, dimensions, and page count.', multi: false, minFiles: 1, accept: 'both' },
  'blank-pdf': { title: 'Blank PDF', desc: 'Create an empty PDF with a given page count and size.', multi: false, minFiles: 0, accept: 'none' },
  zip: { title: 'ZIP Files', desc: 'Bundle multiple files into a ZIP archive.', multi: true, minFiles: 1, accept: 'both' },
  hash: { title: 'Hash Generator', desc: 'Generate SHA-256 / SHA-1 / SHA-512 hash of a file.', multi: false, minFiles: 1, accept: 'both' },
  base64: { title: 'Base64 Converter', desc: 'Encode a file to Base64 or decode Base64 to a file.', multi: false, minFiles: 0, accept: 'both' },
};

/* Tools that render a page-thumbnail grid */
const PAGE_TOOLS = ['delete-pages', 'extract-pages', 'rotate', 'reorder'];

/* ------------------------------------------------------------------ */
/* Global state                                                        */
/* ------------------------------------------------------------------ */
const state = {
  tool: 'home',
  files: [],
  selectedPages: new Set(),
  pageOrder: [],
  processing: false,
};

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initUpload();
  initActions();
  initModal();
  initSearch();

  initDashboard();
  showDashboard();

  setupPdfJs();
});

async function setupPdfJs() {
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
    window.pdfjsLib = mod;
    mod.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  } catch (e) {
    console.warn('pdf.js preload failed', e);
  }
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */
function initTheme() {
  const stored = localStorage.getItem('zendoc-theme') || 'light';
  document.documentElement.setAttribute('data-theme', stored);
  document.getElementById('darkModeBtn')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('zendoc-theme', next);
  });
}

/* ------------------------------------------------------------------ */
/* Navigation / sidebar / modals / search                              */
/* ------------------------------------------------------------------ */
function initNav() {
  // Sidebar tool buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool) switchTool(tool);
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarToggle')?.setAttribute('aria-expanded', 'false');
    });
  });

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    const open = sb?.classList.toggle('open');
    document.getElementById('sidebarToggle')?.setAttribute('aria-expanded', String(!!open));
  });

  // Logo → back to dashboard
  document.getElementById('logoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    showDashboard();
  });

  // Privacy modal
  document.getElementById('privacyLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const tpl = document.getElementById('privacyTemplate');
    openModal(
      'Privacy',
      tpl?.innerHTML || '',
      '<button type="button" class="btn btn-primary" id="modalOk">OK</button>'
    );
    document.getElementById('modalOk')?.addEventListener('click', closeModal);
  });
}

function initSearch() {
  const input = document.getElementById('toolSearch');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('.nav-item').forEach(btn => {
      const text = btn.textContent.toLowerCase();
      btn.classList.toggle('hidden-search', !!q && !text.includes(q));
    });
  });
}

function initModal() {
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

/* ------------------------------------------------------------------ */
/* Upload + actions                                                    */
/* ------------------------------------------------------------------ */
function initUpload() {
  const zone = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  const chooseBtn = document.getElementById('chooseFilesBtn');

  chooseBtn?.addEventListener('click', (e) => { e.stopPropagation(); input?.click(); });
  zone?.addEventListener('click', () => input?.click());
  zone?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input?.click(); }
  });
  zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  input?.addEventListener('change', () => {
    if (input.files?.length) addFiles(input.files);
    input.value = '';
  });

  document.getElementById('clearFilesBtn')?.addEventListener('click', () => {
    state.files = [];
    state.selectedPages.clear();
    state.pageOrder = [];
    updateFileUI();
    const grid = document.getElementById('pageGrid');
    if (grid) grid.innerHTML = '';
  });
}

function initActions() {
  document.getElementById('processBtn')?.addEventListener('click', runTool);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */
function initDashboard() {
  const grid = document.getElementById('toolGrid');
  if (!grid) return;

  grid.innerHTML = '';
  Object.keys(TOOL_META).forEach(key => {
    const meta = TOOL_META[key];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'dashboard-card';

    const icon = meta.accept === 'pdf' ? '📄'
      : meta.accept === 'image' ? '🖼️'
      : '🔧';

    card.innerHTML =
      '<div class="card-icon">' + icon + '</div>' +
      '<h3 class="card-title">' + meta.title + '</h3>' +
      '<p class="card-desc">' + meta.desc + '</p>';

    card.addEventListener('click', () => switchTool(key));
    grid.appendChild(card);
  });
}

function showDashboard() {
  state.tool = 'home';
  document.getElementById('homeDashboard').hidden = false;
  document.getElementById('toolWorkspace').hidden = true;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
}

/* ------------------------------------------------------------------ */
/* Tool switching                                                      */
/* ------------------------------------------------------------------ */
function switchTool(toolId) {
  const meta = TOOL_META[toolId];
  if (!meta) return;

  // 1) View toggle
  document.getElementById('homeDashboard').hidden = true;
  document.getElementById('toolWorkspace').hidden = false;

  // 2) Reset state
  state.tool = toolId;
  state.files = [];
  state.selectedPages.clear();
  state.pageOrder = [];
  state.processing = false;

  // 3) Sidebar active highlight
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === toolId);
  });

  // 4) Header text
  const titleEl = document.getElementById('toolTitle');
  const descEl = document.getElementById('toolDesc');
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;

  // 5) Upload hint + drop-zone visibility
  const hint = document.getElementById('uploadHint');
  if (hint) {
    if (meta.accept === 'pdf') hint.textContent = 'PDF files · Max 50MB each';
    else if (meta.accept === 'image') hint.textContent = 'Image files · Max 50MB each';
    else if (meta.accept === 'none') hint.textContent = 'No file upload needed';
    else hint.textContent = 'PDF or image files · Max 50MB each';
  }
  const dz = document.getElementById('dropZone');
  if (dz) dz.hidden = meta.accept === 'none';

  // 6) File input accept + multiple
  const input = document.getElementById('fileInput');
  if (input) {
    input.accept = getAcceptForTool(toolId);
    input.multiple = !!meta.multi;
  }

  // 7) Options panel (dynamic per-tool HTML)
  const optionsPanel = document.getElementById('optionsPanel');
  const optionsHtml = buildOptionsHTML(toolId);
  if (optionsPanel) {
    if (optionsHtml && optionsHtml.trim()) {
      optionsPanel.innerHTML = optionsHtml;
      optionsPanel.hidden = false;
      bindRangeLabels(optionsPanel);
      bindToolSpecificOptions(toolId);
    } else {
      optionsPanel.innerHTML = '';
      optionsPanel.hidden = true;
    }
  }

  // 8) Reset sub-UI (files list, actions, progress, results, page grid)
  resetSubUI();

  // 9) Update file UI (handles minFiles = 0 for blank-pdf / base64)
  updateFileUI();
}

function resetSubUI() {
  const wrap = document.getElementById('fileListWrap');
  if (wrap) wrap.hidden = true;
  const list = document.getElementById('fileList');
  if (list) list.innerHTML = '';
  const actions = document.getElementById('actionsBar');
  if (actions) actions.hidden = true;
  const result = document.getElementById('resultArea');
  if (result) { result.hidden = true; result.innerHTML = ''; }
  const grid = document.getElementById('pageGrid');
  if (grid) grid.innerHTML = '';
  setProgress(false);
}

/**
 * Bind tool-specific option handlers that depend on the current tool.
 * Called once per switchTool() after the options panel is rendered.
 */
function bindToolSpecificOptions(toolId) {
  if (toolId === 'protect') {
    document.getElementById('showPass')?.addEventListener('change', (e) => {
      const t = e.target.checked ? 'text' : 'password';
      const u = document.getElementById('userPass');
      const o = document.getElementById('ownerPass');
      if (u) u.type = t;
      if (o) o.type = t;
    });
  }

  if (toolId === 'resize') {
    document.getElementById('resizePreset')?.addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v || v.endsWith('%')) return; // % handled at process time
      const parts = v.split('x').map(Number);
      const tw = document.getElementById('targetW');
      const th = document.getElementById('targetH');
      if (tw && parts[0]) tw.value = parts[0];
      if (th && parts[1]) th.value = parts[1];
    });
  }
}

/* ------------------------------------------------------------------ */
/* File handling                                                       */
/* ------------------------------------------------------------------ */
function addFiles(fileList) {
  const meta = TOOL_META[state.tool];
  if (!meta) return;

  const arr = Array.from(fileList);
  for (const f of arr) {
    if (warnLargeFile(f)) {
      showToast('Large file: ' + f.name + '. Processing may be slow.', 'warning');
    }

    // Type validation per tool
    if (meta.accept === 'pdf'
      && f.type !== 'application/pdf'
      && !f.name.toLowerCase().endsWith('.pdf')) {
      showToast('Skipped non-PDF: ' + f.name, 'warning');
      continue;
    }
    if (meta.accept === 'image' && !f.type.startsWith('image/')) {
      showToast('Skipped non-image: ' + f.name, 'warning');
      continue;
    }

    if (!meta.multi) state.files = [f];
    else state.files.push(f);
  }

  updateFileUI();

  // Auto-render page thumbnails for page-level PDF tools
  if (PAGE_TOOLS.includes(state.tool) && state.files[0]) {
    loadPageThumbs(state.files[0]);
  }
}

function updateFileUI() {
  const meta = TOOL_META[state.tool];
  if (!meta) return;

  const wrap = document.getElementById('fileListWrap');
  const count = document.getElementById('fileCount');
  const actions = document.getElementById('actionsBar');
  const processBtn = document.getElementById('processBtn');

  // File list rendering
  if (state.files.length === 0) {
    if (wrap) wrap.hidden = true;
  } else {
    if (wrap) wrap.hidden = false;
    if (count) {
      count.textContent = state.files.length + ' file' + (state.files.length !== 1 ? 's' : '');
    }

    renderFileList(state.files, {
      onRemove: (i) => {
        state.files.splice(i, 1);
        updateFileUI();
      },
      sortable: !!meta.multi,
    });

    // Attach reorder callback AFTER renderFileList wires up Sortable
    const listEl = document.getElementById('fileList');
    if (listEl) {
      listEl._onReorder = (oldI, newI) => {
        if (oldI === newI) return;
        const item = state.files.splice(oldI, 1)[0];
        state.files.splice(newI, 0, item);
        updateFileUI();
      };
    }
  }

  // Actions bar + process button
  const needsFiles = meta.minFiles > 0;
  const hasEnough = state.files.length >= meta.minFiles;

  if (actions) actions.hidden = needsFiles ? !hasEnough : false;
  if (processBtn) {
    processBtn.disabled = state.processing || (needsFiles && !hasEnough);
    processBtn.textContent = state.processing ? 'Processing…' : 'Process';
  }
}

/* ------------------------------------------------------------------ */
/* Page thumbnail grid (for delete / extract / rotate / reorder)       */
/* ------------------------------------------------------------------ */
async function loadPageThumbs(file) {
  const grid = document.getElementById('pageGrid');
  if (!grid) return;

  grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Loading pages…</p>';

  try {
    const result = await PDF.renderPageThumbnails(file, 80);
    const thumbs = result.thumbs;
    const totalPages = result.totalPages;

    state.pageOrder = thumbs.map(t => t.index);
    state.selectedPages.clear();
    grid.innerHTML = '';

    thumbs.forEach(t => {
      const div = document.createElement('div');
      div.className = 'page-thumb';
      div.dataset.index = String(t.index);
      div.appendChild(t.canvas);

      const num = document.createElement('span');
      num.className = 'page-num';
      num.textContent = String(t.pageNum);
      div.appendChild(num);

      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '\u2713';
      div.appendChild(check);

      div.addEventListener('click', () => {
        if (state.tool === 'reorder') return; // reorder uses drag only
        if (state.selectedPages.has(t.index)) {
          state.selectedPages.delete(t.index);
          div.classList.remove('selected');
        } else {
          state.selectedPages.add(t.index);
          div.classList.add('selected');
        }
      });

      grid.appendChild(div);
    });

    if (totalPages > 80) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size:0.8rem;color:var(--text-muted);grid-column:1/-1';
      note.textContent = 'Showing first 80 of ' + totalPages + ' pages.';
      grid.appendChild(note);
    }

    // Select all / deselect all
    document.getElementById('selectAllPages')?.addEventListener('click', () => {
      thumbs.forEach(t => {
        state.selectedPages.add(t.index);
        grid.querySelector('[data-index="' + t.index + '"]')?.classList.add('selected');
      });
    });
    document.getElementById('deselectAllPages')?.addEventListener('click', () => {
      state.selectedPages.clear();
      grid.querySelectorAll('.page-thumb').forEach(el => el.classList.remove('selected'));
    });

    // Drag-drop reorder
    if (state.tool === 'reorder' && window.Sortable) {
      Sortable.create(grid, {
        animation: 150,
        onEnd: () => {
          state.pageOrder = Array.from(grid.querySelectorAll('.page-thumb'))
            .map(el => +el.dataset.index);
        },
      });
    }
  } catch (e) {
    handleError(e);
    grid.innerHTML = '<p style="color:var(--error)">Failed to load page previews.</p>';
  }
}

/* ------------------------------------------------------------------ */
/* Run tool                                                            */
/* ------------------------------------------------------------------ */
async function runTool() {
  if (state.processing) return;
  state.processing = true;

  const processBtn = document.getElementById('processBtn');
  if (processBtn) {
    processBtn.disabled = true;
    processBtn.textContent = 'Processing…';
  }
  setProgress(true, 5, 'Starting…');

  const resultArea = document.getElementById('resultArea');
  if (resultArea) resultArea.hidden = true;

  try {
    await executeTool(state.tool);
  } catch (err) {
    handleError(err);
  } finally {
    state.processing = false;
    setProgress(false);
    updateFileUI();
  }
}

/* ------------------------------------------------------------------ */
/* Execute tool dispatcher                                             */
/* ------------------------------------------------------------------ */
async function executeTool(tool) {
  const files = state.files;
  const onProg = (p, t) => setProgress(true, p, t);
  const resultArea = document.getElementById('resultArea');

  /* ---------- PDF tools ---------- */
  if (tool === 'merge') {
    const blob = await PDF.mergePDFs(files, onProg);
    downloadBlob(blob, 'merged.pdf');
    showToast('PDF merged successfully!', 'success');
    return;
  }

  if (tool === 'split') {
    const every = document.getElementById('everyPage')?.checked;
    const rangeStr = document.getElementById('pageRanges')?.value || '';
    const bytes = await files[0].arrayBuffer();
    const doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = doc.getPageCount();

    let ranges = [];
    if (!every) {
      const indices = parsePageRanges(rangeStr, total);
      if (!indices.length) throw new Error('Enter valid page ranges (e.g. 1-3, 5)');

      // Collapse contiguous indices into range arrays
      let start = indices[0], prev = indices[0];
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] === prev + 1) { prev = indices[i]; continue; }
        ranges.push(Array.from({ length: prev - start + 1 }, (_, k) => start + k));
        start = prev = indices[i];
      }
      ranges.push(Array.from({ length: prev - start + 1 }, (_, k) => start + k));
    }

    const results = await PDF.splitPDF(files[0], ranges, every);
    if (results.length === 1) {
      downloadBlob(results[0], 'split.pdf');
    } else {
      const zipFiles = results.map((b, i) =>
        new File([b], 'part-' + (i + 1) + '.pdf', { type: 'application/pdf' })
      );
      await UTIL.createZip(zipFiles, 'split-pages.zip');
    }
    showToast('Split into ' + results.length + ' file(s)', 'success');
    return;
  }

  if (tool === 'compress-pdf') {
    const quality = parseFloat(document.getElementById('pdfQuality')?.value || '0.7');
    const scale = parseFloat(document.getElementById('pdfScale')?.value || '1.5');
    const blob = await PDF.compressPDF(files[0], quality, scale, onProg);
    downloadBlob(blob, 'compressed.pdf');
    showToast('Compressed: ' + formatBytes(files[0].size) + ' → ' + formatBytes(blob.size), 'success');
    return;
  }

  if (tool === 'delete-pages') {
    const pages = Array.from(state.selectedPages);
    if (!pages.length) throw new Error('Select at least one page to delete');
    const blob = await PDF.deletePages(files[0], pages);
    downloadBlob(blob, 'pages-deleted.pdf');
    showToast('Deleted ' + pages.length + ' page(s)', 'success');
    return;
  }

  if (tool === 'extract-pages') {
    const pages = Array.from(state.selectedPages).sort((a, b) => a - b);
    if (!pages.length) throw new Error('Select at least one page to extract');
    const blob = await PDF.extractPages(files[0], pages);
    downloadBlob(blob, 'extracted.pdf');
    showToast('Extracted ' + pages.length + ' page(s)', 'success');
    return;
  }

  if (tool === 'rotate') {
    const angle = parseInt(document.getElementById('rotateAngle')?.value || '90', 10);
    const scope = document.getElementById('rotateScope')?.value || 'all';
    const indices = scope === 'selected' ? Array.from(state.selectedPages) : null;
    if (scope === 'selected' && (!indices || !indices.length)) {
      throw new Error('Select pages or choose All pages');
    }
    const blob = await PDF.rotatePages(files[0], angle, indices);
    downloadBlob(blob, 'rotated.pdf');
    showToast('Pages rotated', 'success');
    return;
  }

  if (tool === 'reorder') {
    const order = state.pageOrder.length ? state.pageOrder : null;
    if (!order) throw new Error('Load pages first');
    const blob = await PDF.reorderPages(files[0], order);
    downloadBlob(blob, 'reordered.pdf');
    showToast('Pages reordered', 'success');
    return;
  }

  if (tool === 'watermark-pdf') {
    const text = document.getElementById('wmText')?.value || 'CONFIDENTIAL';
    const fontSize = parseInt(document.getElementById('wmSize')?.value || '48', 10);
    const opacity = parseFloat(document.getElementById('wmOpacity')?.value || '0.3');
    const angle = parseInt(document.getElementById('wmAngle')?.value || '45', 10);
    const hex = document.getElementById('wmColor')?.value || '#808080';
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const blob = await PDF.addWatermark(files[0], text, {
      fontSize, opacity, angle, color: { r, g, b },
    });
    downloadBlob(blob, 'watermarked.pdf');
    showToast('Watermark added', 'success');
    return;
  }

  if (tool === 'page-numbers') {
    const format = document.getElementById('pnFormat')?.value || 'Page {n} of {total}';
    const startNumber = parseInt(document.getElementById('pnStart')?.value || '1', 10);
    const position = document.getElementById('pnPos')?.value || 'bottom-center';
    const blob = await PDF.addPageNumbers(files[0], { format, startNumber, position });
    downloadBlob(blob, 'numbered.pdf');
    showToast('Page numbers added', 'success');
    return;
  }

  if (tool === 'remove-meta') {
    const blob = await PDF.removeMetadata(files[0]);
    downloadBlob(blob, 'no-metadata.pdf');
    showToast('Metadata removed', 'success');
    return;
  }

  if (tool === 'protect') {
    const userPass = document.getElementById('userPass')?.value || '';
    const ownerPass = document.getElementById('ownerPass')?.value || '';
    if (!userPass && !ownerPass) throw new Error('Enter at least one password');
    const blob = await PDF.tryProtectPDF(files[0], userPass, ownerPass);
    downloadBlob(blob, 'protected.pdf');
    return;
  }

  if (tool === 'unlock') {
    const pass = document.getElementById('unlockPass')?.value || '';
    if (!pass) throw new Error('Enter the password');
    const blob = await PDF.tryUnlockPDF(files[0], pass);
    downloadBlob(blob, 'unlocked.pdf');
    showToast('PDF unlocked', 'success');
    return;
  }

  if (tool === 'extract-text') {
    const text = await PDF.extractText(files[0], onProg);
    if (resultArea) {
      resultArea.hidden = false;
      resultArea.innerHTML =
        '<div class="result-meta">Extracted text · ' +
        '<button type="button" class="btn btn-secondary btn-sm" id="copyText">Copy</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm" id="dlText">Download TXT</button></div>' +
        '<pre class="text-output" id="textOut"></pre>';
      document.getElementById('textOut').textContent = text || '(No text found)';
      document.getElementById('copyText')?.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
      });
      document.getElementById('dlText')?.addEventListener('click', () => {
        downloadBlob(new Blob([text], { type: 'text/plain' }), 'extracted.txt');
      });
    }
    showToast('Text extracted', 'success');
    return;
  }

  /* ---------- Convert ---------- */
  if (tool === 'images-to-pdf') {
    const sizeKey = document.getElementById('pageSize')?.value || 'a4';
    const orient = document.getElementById('pageOrient')?.value || 'portrait';
    const blob = await PDF.imagesToPDF(files, sizeKey, orient, onProg);
    downloadBlob(blob, 'images.pdf');
    showToast('PDF created from images', 'success');
    return;
  }

  if (tool === 'pdf-to-images') {
    const format = document.getElementById('imgFormat')?.value || 'png';
    const scale = parseFloat(document.getElementById('imgScale')?.value || '2');
    const quality = parseFloat(document.getElementById('imgQuality')?.value || '0.92');
    const images = await PDF.pdfToImages(files[0], format, scale, quality, onProg);
    const ext = format === 'jpeg' ? 'jpg' : format;
    if (images.length === 1) {
      downloadBlob(images[0], 'page-1.' + ext);
    } else {
      const zipFiles = images.map((b, i) =>
        new File([b], 'page-' + (i + 1) + '.' + ext, { type: b.type })
      );
      await UTIL.createZip(zipFiles, 'pdf-pages.zip');
    }
    showToast('Exported ' + images.length + ' image(s)', 'success');
    return;
  }

  /* ---------- Image tools ---------- */
  if (tool === 'compress-img') {
    const maxSizeMB = parseFloat(document.getElementById('maxSizeMB')?.value || '1');
    const maxWidthOrHeight = parseInt(document.getElementById('maxDim')?.value || '1920', 10);
    const initialQuality = parseFloat(document.getElementById('imgInitQ')?.value || '0.8');
    const out = await IMG.compressImage(files[0], {
      maxSizeMB, maxWidthOrHeight, initialQuality,
    });
    downloadBlob(out, 'compressed-' + files[0].name);
    showToast(formatBytes(files[0].size) + ' → ' + formatBytes(out.size), 'success');
    return;
  }

  if (tool === 'resize') {
    let w = parseInt(document.getElementById('targetW')?.value || '800', 10);
    let h = parseInt(document.getElementById('targetH')?.value || '600', 10);
    const preset = document.getElementById('resizePreset')?.value || '';
    if (preset.endsWith('%')) {
      const dims = await IMG.getImageDimensions(files[0]);
      const pct = parseInt(preset, 10) / 100;
      w = Math.round(dims.width * pct);
      h = Math.round(dims.height * pct);
    } else if (document.getElementById('lockAspect')?.checked && !preset) {
      const dims = await IMG.getImageDimensions(files[0]);
      h = Math.round(w / (dims.width / dims.height));
    }
    const out = await IMG.resizeImage(files[0], w, h);
    downloadBlob(out, 'resized-' + w + 'x' + h + '-' + files[0].name);
    showToast('Resized to ' + w + '×' + h, 'success');
    return;
  }

  if (tool === 'convert-img') {
    const format = document.getElementById('targetFormat')?.value || 'jpeg';
    const quality = parseFloat(document.getElementById('convQuality')?.value || '0.92');
    const out = await IMG.convertImage(files[0], format, quality);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const base = files[0].name.replace(/\.[^.]+$/, '');
    downloadBlob(out, base + '.' + ext);
    showToast('Converted to ' + format.toUpperCase(), 'success');
    return;
  }

  if (tool === 'crop') {
    const x = parseInt(document.getElementById('cropX')?.value || '0', 10);
    const y = parseInt(document.getElementById('cropY')?.value || '0', 10);
    const width = parseInt(document.getElementById('cropW')?.value || '100', 10);
    const height = parseInt(document.getElementById('cropH')?.value || '100', 10);
    const out = await IMG.cropImage(files[0], { x, y, width, height });
    downloadBlob(out, 'cropped-' + files[0].name);
    showToast('Image cropped', 'success');
    return;
  }

  if (tool === 'rotate-img') {
    const angle = parseInt(document.getElementById('imgAngle')?.value || '90', 10);
    const flipH = document.getElementById('flipH')?.checked || false;
    const flipV = document.getElementById('flipV')?.checked || false;
    const out = await IMG.rotateImage(files[0], angle, flipH, flipV);
    downloadBlob(out, 'rotated-' + files[0].name);
    showToast('Image transformed', 'success');
    return;
  }

  if (tool === 'remove-exif') {
    const out = await IMG.removeExif(files[0]);
    downloadBlob(out, 'no-exif-' + files[0].name);
    showToast('EXIF removed', 'success');
    return;
  }

  if (tool === 'watermark-img') {
    const text = document.getElementById('iwmText')?.value || '\u00A9';
    const fontSize = parseInt(document.getElementById('iwmSize')?.value || '36', 10);
    const opacity = parseFloat(document.getElementById('iwmOpacity')?.value || '0.5');
    const color = document.getElementById('iwmColor')?.value || '#ffffff';
    const position = document.getElementById('iwmPos')?.value || 'center';
    const out = await IMG.watermarkImage(files[0], text, {
      fontSize, opacity, color, position,
    });
    downloadBlob(out, 'watermarked-' + files[0].name);
    showToast('Watermark applied', 'success');
    return;
  }

  /* ---------- Utility tools ---------- */
  if (tool === 'file-info') {
    const info = await UTIL.getFileInfo(files[0]);
    if (resultArea) {
      resultArea.hidden = false;
      let rows = '';
      Object.keys(info).forEach(k => {
        rows +=
          '<tr>' +
          '<td style="padding:6px 8px;color:var(--text-muted);width:40%">' + k + '</td>' +
          '<td style="padding:6px 8px;font-weight:500">' + info[k] + '</td>' +
          '</tr>';
      });
      resultArea.innerHTML =
        '<h3 style="margin-bottom:12px">File information</h3>' +
        '<table style="width:100%;font-size:0.9rem;border-collapse:collapse">' + rows + '</table>';
    }
    showToast('Info loaded', 'success');
    return;
  }

  if (tool === 'blank-pdf') {
    const count = parseInt(document.getElementById('blankCount')?.value || '1', 10);
    const size = document.getElementById('blankSize')?.value || 'a4';
    const orient = document.getElementById('blankOrient')?.value || 'portrait';
    const blob = await PDF.createBlankPDF(count, size, orient);
    downloadBlob(blob, 'blank.pdf');
    showToast('Created ' + count + '-page blank PDF', 'success');
    return;
  }

  if (tool === 'zip') {
    await UTIL.createZip(files);
    showToast('ZIP created', 'success');
    return;
  }

  if (tool === 'hash') {
    const algo = document.getElementById('hashAlgo')?.value || 'SHA-256';
    const hash = await UTIL.generateHash(files[0], algo);
    if (resultArea) {
      resultArea.hidden = false;
      resultArea.innerHTML =
        '<div class="result-meta">' + algo + ' · ' +
        '<button type="button" class="btn btn-secondary btn-sm" id="copyHash">Copy</button></div>' +
        '<pre class="text-output" id="hashOut" style="word-break:break-all"></pre>';
      document.getElementById('hashOut').textContent = hash;
      document.getElementById('copyHash')?.addEventListener('click', () => {
        navigator.clipboard.writeText(hash);
        showToast('Hash copied', 'success');
      });
    }
    showToast('Hash generated', 'success');
    return;
  }

  if (tool === 'base64') {
    const pasted = document.getElementById('b64Input')?.value?.trim();
    if (pasted) {
      const blob = UTIL.base64ToBlob(pasted);
      downloadBlob(blob, 'decoded-file');
      showToast('Decoded and downloaded', 'success');
    } else if (files[0]) {
      const dataUrl = await UTIL.imageToBase64(files[0]);
      if (resultArea) {
        resultArea.hidden = false;
        resultArea.innerHTML =
          '<div class="result-meta">Base64 · ' +
          '<button type="button" class="btn btn-secondary btn-sm" id="copyB64">Copy</button></div>' +
          '<textarea class="text-output" id="b64Out" rows="8" readonly style="width:100%"></textarea>';
        document.getElementById('b64Out').value = dataUrl;
        document.getElementById('copyB64')?.addEventListener('click', () => {
          navigator.clipboard.writeText(dataUrl);
          showToast('Copied', 'success');
        });
      }
      showToast('Encoded to Base64', 'success');
    } else {
      throw new Error('Upload a file or paste Base64 to decode');
    }
    return;
  }

  throw new Error('Unknown tool: ' + tool);
}