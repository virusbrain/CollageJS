import { LAYOUTS, layoutsForCount } from './layouts.js';
import { buildCollageCanvas, upscaleForExport } from './collage.js';

/** @type {{ id: string, url: string, image: HTMLImageElement }[]} */
let images = [];
let selectedLayoutId = 'row-2';
/** @type {ReturnType<typeof buildCollageCanvas>} */
let lastExportCanvas = null;

const fileInput = document.getElementById('file-input');
const imageList = document.getElementById('image-list');
const layoutGrid = document.getElementById('layout-grid');
const gapSlider = document.getElementById('gap-slider');
const gapValue = document.getElementById('gap-value');
const bgColor = document.getElementById('bg-color');
const previewCanvas = document.getElementById('preview-canvas');
const previewPlaceholder = document.getElementById('preview-placeholder');
const saveBtn = document.getElementById('save-btn');
const shareBtn = document.getElementById('share-btn');
const statusMsg = document.getElementById('status-msg');
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('install-btn');
const dismissInstall = document.getElementById('dismiss-install');

/** @type {BeforeInstallPromptEvent | null} */
let deferredInstallPrompt = null;

function setStatus(text, type = '') {
  statusMsg.textContent = text;
  statusMsg.className = 'status-msg' + (type ? ` ${type}` : '');
}

function getOptions() {
  return {
    layoutId: selectedLayoutId,
    gap: Number(gapSlider.value),
    background: bgColor.value,
    previewMax: 900,
  };
}

function canRender() {
  return images.length >= 2;
}

function updateActionButtons() {
  const ready = canRender() && lastExportCanvas;
  saveBtn.disabled = !ready;
  const canShare = ready && typeof navigator.share === 'function';
  shareBtn.hidden = !canShare;
  shareBtn.disabled = !canShare;
}

function layoutPreviewSvg(layout) {
  const rects = layout.cells
    .map(
      (c) =>
        `<rect x="${c.x * 88 + 4}" y="${c.y * 88 + 4}" width="${c.w * 88 - 2}" height="${c.h * 88 - 2}" rx="2" fill="currentColor"/>`
    )
    .join('');
  return `<svg viewBox="0 0 96 96" aria-hidden="true" style="color:#9898b0">${rects}</svg>`;
}

function renderLayoutButtons() {
  const available = layoutsForCount(images.length);
  const list = available.length > 0 ? available : LAYOUTS.filter((l) => l.minImages <= 2);

  if (!list.some((l) => l.id === selectedLayoutId)) {
    selectedLayoutId = list[0]?.id ?? 'row-2';
  }

  layoutGrid.innerHTML = '';
  list.forEach((layout) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(layout.id === selectedLayoutId));
    btn.setAttribute('aria-label', layout.label);
    btn.title = layout.label;
    btn.innerHTML = layoutPreviewSvg(layout);
    btn.addEventListener('click', () => {
      selectedLayoutId = layout.id;
      renderLayoutButtons();
      refreshPreview();
    });
    layoutGrid.appendChild(btn);
  });
}

function renderThumbnails() {
  imageList.innerHTML = '';
  images.forEach((item, index) => {
    const li = document.createElement('div');
    li.className = 'thumb';
    li.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = `Bild ${index + 1}`;

    const order = document.createElement('span');
    order.className = 'order';
    order.textContent = String(index + 1);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', `Bild ${index + 1} entfernen`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(item.url);
      images.splice(index, 1);
      onImagesChanged();
    });

    li.appendChild(img);
    li.appendChild(order);
    li.appendChild(remove);
    imageList.appendChild(li);
  });
}

function refreshPreview() {
  if (!canRender()) {
    previewCanvas.hidden = true;
    previewPlaceholder.hidden = false;
    lastExportCanvas = null;
    updateActionButtons();
    return;
  }

  const loaded = images.map((i) => i.image).filter((img) => img.complete && img.naturalWidth);
  if (loaded.length < images.length) {
    return;
  }

  const canvas = buildCollageCanvas(
    images.map((i) => i.image),
    getOptions()
  );

  if (!canvas) {
    previewCanvas.hidden = true;
    previewPlaceholder.hidden = false;
    lastExportCanvas = null;
    updateActionButtons();
    return;
  }

  previewPlaceholder.hidden = true;
  previewCanvas.hidden = false;
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext('2d');
  ctx?.drawImage(canvas, 0, 0);

  lastExportCanvas = buildCollageCanvas(
    images.map((i) => i.image),
    { ...getOptions(), previewMax: 2400 }
  );

  updateActionButtons();
}

function onImagesChanged() {
  renderThumbnails();
  renderLayoutButtons();
  refreshPreview();
}

/**
 * @param {File} file
 * @returns {Promise<void>}
 */
function addImageFile(file) {
  if (!file.type.startsWith('image/')) return;

  const url = URL.createObjectURL(file);
  const image = new Image();
  const id = crypto.randomUUID();

  return new Promise((resolve) => {
    image.onload = () => {
      images.push({ id, url, image });
      onImagesChanged();
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    image.src = url;
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    await addImageFile(file);
  }
}

/**
 * @returns {Promise<Blob>}
 */
async function getExportBlob() {
  if (!lastExportCanvas) throw new Error('Keine Collage');
  const exportCanvas = upscaleForExport(lastExportCanvas);
  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export fehlgeschlagen'))),
      'image/jpeg',
      0.92
    );
  });
}

/**
 * @param {Blob} blob
 * @returns {File}
 */
function blobToFile(blob) {
  const name = `collage-${Date.now()}.jpg`;
  return new File([blob], name, { type: 'image/jpeg' });
}

async function saveToGallery() {
  if (!canRender()) return;

  setStatus('Collage wird vorbereitet…');
  saveBtn.disabled = true;

  try {
    const blob = await getExportBlob();
    const file = blobToFile(blob);

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'CollageJS',
        text: 'Collage speichern',
      });
      setStatus('Teilen-Dialog geöffnet — „Bild speichern“ oder Fotos wählen.', 'success');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setStatus('Bild geöffnet — lange drücken → „In Fotos sichern“.', 'success');
    } else {
      setStatus('Download gestartet — in der Galerie unter Downloads finden.', 'success');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('Abgebrochen.');
    } else {
      setStatus(err.message || 'Speichern fehlgeschlagen.', 'error');
    }
  } finally {
    updateActionButtons();
  }
}

async function shareCollage() {
  try {
    const blob = await getExportBlob();
    const file = blobToFile(blob);
    await navigator.share({ files: [file], title: 'CollageJS' });
    setStatus('Geteilt.', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus('Teilen fehlgeschlagen.', 'error');
    }
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const base = new URL('.', window.location.href);
  const swUrl = new URL('sw.js', base).href;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: base.pathname }).catch(() => {});
  });
}

fileInput?.addEventListener('change', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  if (input.files?.length) handleFiles(input.files);
  input.value = '';
});

gapSlider?.addEventListener('input', () => {
  gapValue.textContent = gapSlider.value;
  refreshPreview();
});

bgColor?.addEventListener('input', refreshPreview);

saveBtn?.addEventListener('click', saveToGallery);
shareBtn?.addEventListener('click', shareCollage);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('install-dismissed')) {
    installBanner.hidden = false;
  }
});

installBtn?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.hidden = true;
});

dismissInstall?.addEventListener('click', () => {
  installBanner.hidden = true;
  localStorage.setItem('install-dismissed', '1');
});

registerServiceWorker();
renderLayoutButtons();
updateActionButtons();
