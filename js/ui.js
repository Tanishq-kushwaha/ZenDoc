/** ZenDoc UI helpers */

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

export function setProgress(visible, percent = 0, text = 'Processing...') {
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressText');
  if (!container) return;
  if (visible) {
    container.hidden = false;
    if (bar) bar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (label) label.textContent = text;
  } else {
    container.hidden = true;
    if (bar) bar.style.width = '0%';
  }
}

export function openModal(title, bodyHtml, footerHtml = '') {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');
  if (!overlay) return;
  titleEl.textContent = title;
  body.innerHTML = bodyHtml;
  footer.innerHTML = footerHtml;
  overlay.hidden = false;
  document.getElementById('modalClose')?.focus();
}

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.hidden = true;
}

export function handleError(err) {
  console.error(err);
  const message = err?.message || String(err) || 'Unknown error';
  if (/encrypt|password/i.test(message)) {
    showToast('This PDF is password protected. Use Unlock PDF first.', 'error');
  } else if (/memory|allocation|out of memory/i.test(message)) {
    showToast('File too large. Try a smaller file or reduce quality.', 'error');
  } else if (err?.name === 'NotSupportedError') {
    showToast('This file format is not supported in your browser.', 'error');
  } else if (/corrupt|invalid/i.test(message)) {
    showToast('File appears to be corrupted or invalid.', 'error');
  } else {
    showToast('Processing failed: ' + message.slice(0, 120), 'error');
  }
}

export function renderFileList(files, { onRemove, sortable = false, listEl }) {
  const el = listEl || document.getElementById('fileList');
  if (!el) return;
  el.innerHTML = '';
  files.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.setAttribute('role', 'listitem');
    item.dataset.index = String(i);

    const thumb = document.createElement('div');
    thumb.className = 'file-thumb';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = '';
      img.className = 'file-thumb';
      img.onload = () => URL.revokeObjectURL(img.src);
      thumb.replaceWith(img);
      item.appendChild(img);
    } else {
      thumb.textContent = file.type === 'application/pdf' ? '📄' : '📎';
      item.appendChild(thumb);
    }

    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    meta.textContent = formatBytesLocal(file.size);
    info.appendChild(name);
    info.appendChild(meta);
    item.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-remove';
    removeBtn.setAttribute('aria-label', 'Remove ' + file.name);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove?.(i);
    });
    item.appendChild(removeBtn);
    el.appendChild(item);
  });

  if (sortable && window.Sortable && files.length > 1) {
    if (el._sortable) el._sortable.destroy();
    el._sortable = Sortable.create(el, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        if (evt.oldIndex !== evt.newIndex && el._onReorder) {
          el._onReorder(evt.oldIndex, evt.newIndex);
        }
      },
    });
  }
}

function formatBytesLocal(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function buildOptionsHTML(toolId) {
  const templates = {
    merge: '',
    split: `
      <h3>Split options</h3>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label for="pageRanges">Page ranges (e.g. 1-5, 8, 10-12)</label>
          <input type="text" id="pageRanges" placeholder="1-3, 5, 7-10" />
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="everyPage" />
        <label for="everyPage">Every page as separate PDF</label>
      </div>
    `,
    'compress-pdf': `
      <h3>Compression options</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">
        ⚠️ Text will not be searchable after compression (pages are rasterized).
      </p>
      <div class="form-row">
        <div class="form-group">
          <label for="pdfQuality">JPEG quality <span class="range-value" id="pdfQualityVal">0.7</span></label>
          <input type="range" id="pdfQuality" min="0.4" max="1" step="0.05" value="0.7" />
        </div>
        <div class="form-group">
          <label for="pdfScale">Render scale</label>
          <select id="pdfScale">
            <option value="1">1× (fast)</option>
            <option value="1.5" selected>1.5×</option>
            <option value="2">2× (sharp)</option>
          </select>
        </div>
      </div>
    `,
    'delete-pages': `
      <h3>Select pages to delete</h3>
      <div class="form-row">
        <button type="button" class="btn btn-secondary btn-sm" id="selectAllPages">Select all</button>
        <button type="button" class="btn btn-secondary btn-sm" id="deselectAllPages">Deselect all</button>
      </div>
      <div class="page-grid" id="pageGrid"></div>
    `,
    'extract-pages': `
      <h3>Select pages to extract</h3>
      <div class="form-row">
        <button type="button" class="btn btn-secondary btn-sm" id="selectAllPages">Select all</button>
        <button type="button" class="btn btn-secondary btn-sm" id="deselectAllPages">Deselect all</button>
      </div>
      <div class="page-grid" id="pageGrid"></div>
    `,
    rotate: `
      <h3>Rotation</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="rotateAngle">Angle</label>
          <select id="rotateAngle">
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">270° clockwise</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rotateScope">Apply to</label>
          <select id="rotateScope">
            <option value="all">All pages</option>
            <option value="selected">Selected pages</option>
          </select>
        </div>
      </div>
      <div class="page-grid" id="pageGrid"></div>
    `,
    reorder: `
      <h3>Drag pages to reorder</h3>
      <div class="page-grid" id="pageGrid"></div>
    `,
    'watermark-pdf': `
      <h3>Watermark text</h3>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label for="wmText">Text</label>
          <input type="text" id="wmText" value="CONFIDENTIAL" />
        </div>
        <div class="form-group">
          <label for="wmSize">Font size <span class="range-value" id="wmSizeVal">48</span></label>
          <input type="range" id="wmSize" min="12" max="96" value="48" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="wmOpacity">Opacity <span class="range-value" id="wmOpacityVal">0.3</span></label>
          <input type="range" id="wmOpacity" min="0.1" max="1" step="0.05" value="0.3" />
        </div>
        <div class="form-group">
          <label for="wmAngle">Angle</label>
          <input type="number" id="wmAngle" value="45" min="-90" max="90" />
        </div>
        <div class="form-group">
          <label for="wmColor">Color</label>
          <input type="color" id="wmColor" value="#808080" />
        </div>
      </div>
    `,
    'page-numbers': `
      <h3>Page numbers</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="pnFormat">Format</label>
          <select id="pnFormat">
            <option value="Page {n} of {total}">Page X of Y</option>
            <option value="{n} / {total}">X / Y</option>
            <option value="- {n} -">- X -</option>
            <option value="{n}">X only</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pnStart">Start number</label>
          <input type="number" id="pnStart" value="1" min="1" />
        </div>
        <div class="form-group">
          <label for="pnPos">Position</label>
          <select id="pnPos">
            <option value="bottom-center">Bottom center</option>
            <option value="bottom-right">Bottom right</option>
            <option value="top-center">Top center</option>
          </select>
        </div>
      </div>
    `,
    'remove-meta': `<p style="font-size:0.9rem;color:var(--text-muted)">Removes title, author, subject, keywords, creator, and producer metadata.</p>`,
    protect: `
      <h3>Password protection</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">
        Note: Full AES encryption requires pdf-lib-encrypt. This demo applies a simple owner-style restriction via metadata when the encrypt package is unavailable; for production use pdf-lib-encrypt.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label for="userPass">User password (open)</label>
          <input type="password" id="userPass" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label for="ownerPass">Owner password</label>
          <input type="password" id="ownerPass" autocomplete="new-password" />
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="showPass" />
        <label for="showPass">Show passwords</label>
      </div>
    `,
    unlock: `
      <h3>Unlock PDF</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="unlockPass">Password</label>
          <input type="password" id="unlockPass" autocomplete="current-password" />
        </div>
      </div>
      <p style="font-size:0.85rem;color:var(--text-muted)">If the password is unknown, client-side unlock is not possible.</p>
    `,
    'extract-text': `<p style="font-size:0.9rem;color:var(--text-muted)">Extracts text layer from PDF (not OCR for scanned pages).</p>`,
    'images-to-pdf': `
      <h3>PDF page options</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="pageSize">Page size</label>
          <select id="pageSize">
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
            <option value="fit">Fit to image</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pageOrient">Orientation</label>
          <select id="pageOrient">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>
    `,
    'pdf-to-images': `
      <h3>Export options</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="imgFormat">Format</label>
          <select id="imgFormat">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div class="form-group">
          <label for="imgScale">Scale</label>
          <select id="imgScale">
            <option value="1">1×</option>
            <option value="2" selected>2×</option>
            <option value="3">3×</option>
          </select>
        </div>
        <div class="form-group">
          <label for="imgQuality">Quality <span class="range-value" id="imgQualityVal">0.92</span></label>
          <input type="range" id="imgQuality" min="0.5" max="1" step="0.02" value="0.92" />
        </div>
      </div>
    `,
    'compress-img': `
      <h3>Compression</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="maxSizeMB">Max size (MB)</label>
          <input type="number" id="maxSizeMB" value="1" min="0.1" step="0.1" />
        </div>
        <div class="form-group">
          <label for="maxDim">Max width/height</label>
          <input type="number" id="maxDim" value="1920" min="100" step="10" />
        </div>
        <div class="form-group">
          <label for="imgInitQ">Quality <span class="range-value" id="imgInitQVal">0.8</span></label>
          <input type="range" id="imgInitQ" min="0.3" max="1" step="0.05" value="0.8" />
        </div>
      </div>
    `,
    resize: `
      <h3>Resize</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="targetW">Width (px)</label>
          <input type="number" id="targetW" value="800" min="1" />
        </div>
        <div class="form-group">
          <label for="targetH">Height (px)</label>
          <input type="number" id="targetH" value="600" min="1" />
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="lockAspect" checked />
        <label for="lockAspect">Lock aspect ratio</label>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="resizePreset">Preset</label>
          <select id="resizePreset">
            <option value="">Custom</option>
            <option value="800x600">800×600</option>
            <option value="1280x720">1280×720</option>
            <option value="1920x1080">1920×1080</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
          </select>
        </div>
      </div>
    `,
    'convert-img': `
      <h3>Convert format</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="targetFormat">Target format</label>
          <select id="targetFormat">
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div class="form-group">
          <label for="convQuality">Quality <span class="range-value" id="convQualityVal">0.92</span></label>
          <input type="range" id="convQuality" min="0.5" max="1" step="0.02" value="0.92" />
        </div>
      </div>
    `,
    crop: `
      <h3>Crop</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Enter crop rectangle (pixels from top-left).</p>
      <div class="form-row">
        <div class="form-group"><label for="cropX">X</label><input type="number" id="cropX" value="0" min="0" /></div>
        <div class="form-group"><label for="cropY">Y</label><input type="number" id="cropY" value="0" min="0" /></div>
        <div class="form-group"><label for="cropW">Width</label><input type="number" id="cropW" value="400" min="1" /></div>
        <div class="form-group"><label for="cropH">Height</label><input type="number" id="cropH" value="300" min="1" /></div>
      </div>
      <div id="cropPreview"></div>
    `,
    'rotate-img': `
      <h3>Rotate / Flip</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="imgAngle">Angle</label>
          <select id="imgAngle">
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
            <option value="0">0° (flip only)</option>
          </select>
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="flipH" />
        <label for="flipH">Flip horizontal</label>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="flipV" />
        <label for="flipV">Flip vertical</label>
      </div>
    `,
    'remove-exif': `<p style="font-size:0.9rem;color:var(--text-muted)">Strips EXIF, GPS, and camera metadata by redrawing on canvas.</p>`,
    'watermark-img': `
      <h3>Image watermark</h3>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label for="iwmText">Text</label>
          <input type="text" id="iwmText" value="© ZenDoc" />
        </div>
        <div class="form-group">
          <label for="iwmSize">Font size <span class="range-value" id="iwmSizeVal">36</span></label>
          <input type="range" id="iwmSize" min="12" max="120" value="36" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="iwmOpacity">Opacity <span class="range-value" id="iwmOpacityVal">0.5</span></label>
          <input type="range" id="iwmOpacity" min="0.1" max="1" step="0.05" value="0.5" />
        </div>
        <div class="form-group">
          <label for="iwmColor">Color</label>
          <input type="color" id="iwmColor" value="#ffffff" />
        </div>
        <div class="form-group">
          <label for="iwmPos">Position</label>
          <select id="iwmPos">
            <option value="center">Center</option>
            <option value="tile">Tile</option>
            <option value="bottom-right">Bottom right</option>
          </select>
        </div>
      </div>
    `,
    'file-info': `<p style="font-size:0.9rem;color:var(--text-muted)">Shows file metadata and dimensions/pages.</p>`,
    'blank-pdf': `
      <h3>Blank PDF</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="blankCount">Page count</label>
          <input type="number" id="blankCount" value="1" min="1" max="100" />
        </div>
        <div class="form-group">
          <label for="blankSize">Page size</label>
          <select id="blankSize">
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>
        <div class="form-group">
          <label for="blankOrient">Orientation</label>
          <select id="blankOrient">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>
    `,
    zip: `<p style="font-size:0.9rem;color:var(--text-muted)">Bundle selected files into a ZIP archive.</p>`,
    hash: `
      <h3>Hash</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="hashAlgo">Algorithm</label>
          <select id="hashAlgo">
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </div>
      </div>
    `,
    base64: `
      <h3>Base64</h3>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label for="b64Input">Or paste Base64 to decode</label>
          <textarea id="b64Input" rows="3" placeholder="data:image/png;base64,..."></textarea>
        </div>
      </div>
    `,
  };
  return templates[toolId] ?? '';
}

export function bindRangeLabels(root = document) {
  const pairs = [
    ['pdfQuality', 'pdfQualityVal'],
    ['wmSize', 'wmSizeVal'],
    ['wmOpacity', 'wmOpacityVal'],
    ['imgQuality', 'imgQualityVal'],
    ['imgInitQ', 'imgInitQVal'],
    ['convQuality', 'convQualityVal'],
    ['iwmSize', 'iwmSizeVal'],
    ['iwmOpacity', 'iwmOpacityVal'],
  ];
  pairs.forEach(([id, labelId]) => {
    const input = root.getElementById?.(id) || document.getElementById(id);
    const label = document.getElementById(labelId);
    if (input && label) {
      input.addEventListener('input', () => { label.textContent = input.value; });
    }
  });
}
