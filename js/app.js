import { LAYOUTS, layoutsForCount, getLayoutCells } from './layouts.js';
import { TARGETS, findTarget } from './targets.js';
import {
  buildCollageCanvas,
  computeCollageGeometry,
  computePanLimits,
  upscaleForExport,
} from './collage.js';
import { initPreviewEditor } from './preview-editor.js';

/** @typedef {{ id: string, url: string, image: HTMLImageElement, transform: { panX: number, panY: number, zoom: number } }} ImageItem */

/** @type {ImageItem[]} */
let images = [];
let selectedLayoutId = 'grid-auto';
let selectedTargetId = 'free';
/** @type {HTMLCanvasElement | null} */
let lastExportCanvas = null;
let previewRetryTimer = 0;

const fileInput = document.getElementById('file-input');
const imageList = document.getElementById('image-list');
const targetGrid = document.getElementById('target-grid');
const layoutGrid = document.getElementById('layout-grid');
const gapSlider = document.getElementById('gap-slider');
const gapValue = document.getElementById('gap-value');
const bgColor = document.getElementById('bg-color');
const previewWrap = document.getElementById('preview-wrap');
const previewStage = document.getElementById('preview-stage');
const previewCanvas = document.getElementById('preview-canvas');
const previewOverlay = document.getElementById('preview-overlay');
const previewSlotBar = document.getElementById('preview-slot-bar');
const previewPlaceholder = document.getElementById('preview-placeholder');
const saveBtn = document.getElementById('save-btn');
const shareBtn = document.getElementById('share-btn');
const statusMsg = document.getElementById('status-msg');
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('install-btn');
const dismissInstall = document.getElementById('dismiss-install');

/** @type {BeforeInstallPromptEvent | null} */
let deferredInstallPrompt = null;

/** @type {ReturnType<typeof initPreviewEditor> | null} */
let previewEditor = null;

function defaultTransform() {
  return { panX: 0, panY: 0, zoom: 1 };
}

function createImageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setStatus(text, type = '') {
  statusMsg.textContent = text;
  statusMsg.className = 'status-msg' + (type ? ` ${type}` : '');
}

function setPreviewVisible(visible) {
  previewWrap?.classList.toggle('has-preview', visible);
}

function getOptions(previewMax = 900) {
  return {
    layoutId: selectedLayoutId,
    gap: Number(gapSlider.value),
    background: bgColor.value,
    targetId: selectedTargetId,
    previewMax,
  };
}

function getExportOptions() {
  const target = findTarget(selectedTargetId);
  if (target.width && target.height) {
    return getOptions(Math.max(target.width, target.height));
  }
  return getOptions(2400);
}

function getTransforms() {
  return images.map((i) => i.transform);
}

function getGeometry(previewMax = 900) {
  if (!canRender()) return null;
  return computeCollageGeometry(
    images.map((i) => i.image),
    getOptions(previewMax)
  );
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

function targetPreviewSvg(target) {
  if (!target.width || !target.height) {
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="28" text-anchor="middle" font-size="14" fill="currentColor">∿</text></svg>';
  }
  const max = 36;
  const scale = max / Math.max(target.width, target.height);
  const w = target.width * scale;
  const h = target.height * scale;
  const x = (48 - w) / 2;
  const y = (48 - h) / 2;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="currentColor"/></svg>`;
}

function renderTargetButtons() {
  targetGrid.innerHTML = '';
  TARGETS.forEach((target) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'target-btn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(target.id === selectedTargetId));
    btn.setAttribute('aria-label', `${target.label}, ${target.hint}`);
    btn.title = target.hint;

    const icon = document.createElement('span');
    icon.className = 'target-btn-icon';
    icon.innerHTML = targetPreviewSvg(target);

    const label = document.createElement('span');
    label.className = 'target-btn-label';
    label.textContent = target.label;

    const hint = document.createElement('span');
    hint.className = 'target-btn-hint';
    hint.textContent = target.hint;

    btn.appendChild(icon);
    btn.appendChild(label);
    btn.appendChild(hint);

    btn.addEventListener('click', () => {
      selectedTargetId = target.id;
      renderTargetButtons();
      refreshPreview();
    });
    targetGrid.appendChild(btn);
  });
}

function layoutPreviewSvg(layout, imageCount) {
  const count = imageCount >= layout.minImages ? imageCount : layout.maxImages;
  const cells = getLayoutCells(layout, count);
  const rects = cells
    .map(
      (c) =>
        `<rect x="${c.x * 88 + 4}" y="${c.y * 88 + 4}" width="${Math.max(2, c.w * 88 - 2)}" height="${Math.max(2, c.h * 88 - 2)}" rx="1" fill="currentColor"/>`
    )
    .join('');
  return `<svg viewBox="0 0 96 96" aria-hidden="true" style="color:#9898b0">${rects}</svg>`;
}

function renderLayoutButtons() {
  const available = layoutsForCount(images.length);
  const list = available.length > 0 ? available : LAYOUTS.filter((l) => l.minImages <= 2);

  if (!list.some((l) => l.id === selectedLayoutId)) {
    selectedLayoutId = list.find((l) => l.id === 'grid-auto')?.id ?? list[0]?.id ?? 'grid-auto';
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
    btn.innerHTML = layoutPreviewSvg(layout, images.length);
    btn.addEventListener('click', () => {
      selectedLayoutId = layout.id;
      renderLayoutButtons();
      refreshPreview();
    });
    layoutGrid.appendChild(btn);
  });
}

/**
 * @param {number} fromSlot
 * @param {number} toSlot
 */
function swapSlots(fromSlot, toSlot) {
  if (fromSlot === toSlot) return;
  if (fromSlot < 0 || toSlot < 0) return;
  if (fromSlot >= images.length || toSlot >= images.length) return;

  const a = images[fromSlot];
  const b = images[toSlot];
  images[fromSlot] = b;
  images[toSlot] = a;

  renderThumbnails();

  const canvas = drawPreviewCanvas();
  if (canvas) paintPreviewCanvas(canvas);

  lastExportCanvas = buildCollageCanvas(
    images.map((i) => i.image),
    getExportOptions(),
    getTransforms()
  );

  previewEditor?.update();
  updateActionButtons();
  setStatus(`Position ${fromSlot + 1} ↔ ${toSlot + 1} getauscht`, 'success');
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

function drawPreviewCanvas() {
  return buildCollageCanvas(
    images.map((i) => i.image),
    getOptions(900),
    getTransforms()
  );
}

function paintPreviewCanvas(canvas) {
  if (!previewCanvas || !canvas) return false;

  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  return canvas.width > 0 && canvas.height > 0;
}

async function ensureImagesReady() {
  for (const item of images) {
    if (item.image.complete && item.image.naturalWidth > 0) continue;
    try {
      if (item.image.decode) {
        await item.image.decode();
      }
    } catch {
      await new Promise((resolve, reject) => {
        item.image.onload = () => resolve();
        item.image.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      });
    }
  }
}

function schedulePreviewRetry() {
  if (previewRetryTimer) return;
  previewRetryTimer = window.setTimeout(() => {
    previewRetryTimer = 0;
    refreshPreview();
  }, 120);
}

async function refreshPreview() {
  if (!canRender()) {
    setPreviewVisible(false);
    lastExportCanvas = null;
    previewEditor?.update();
    updateActionButtons();
    return;
  }

  try {
    await ensureImagesReady();
  } catch {
    setPreviewVisible(false);
    setStatus('Mindestens ein Bild konnte nicht geladen werden.', 'error');
    updateActionButtons();
    schedulePreviewRetry();
    return;
  }

  const canvas = drawPreviewCanvas();
  if (!canvas || !paintPreviewCanvas(canvas)) {
    setPreviewVisible(false);
    lastExportCanvas = null;
    updateActionButtons();
    schedulePreviewRetry();
    return;
  }

  setPreviewVisible(true);

  lastExportCanvas = buildCollageCanvas(
    images.map((i) => i.image),
    getExportOptions(),
    getTransforms()
  );

  previewEditor?.update();
  updateActionButtons();

  requestAnimationFrame(() => {
    const again = drawPreviewCanvas();
    if (again) paintPreviewCanvas(again);
  });
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
  if (!file.type.startsWith('image/')) return Promise.resolve();

  const url = URL.createObjectURL(file);
  const image = new Image();
  const id = createImageId();

  return new Promise((resolve) => {
    image.onload = () => {
      images.push({ id, url, image, transform: defaultTransform() });
      onImagesChanged();
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus('Ein Bild konnte nicht geladen werden.', 'error');
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

async function getExportBlob() {
  if (!lastExportCanvas) throw new Error('Keine Collage');
  const exportCanvas = upscaleForExport(lastExportCanvas, { targetId: selectedTargetId });
  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export fehlgeschlagen'))),
      'image/jpeg',
      0.92
    );
  });
}

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

if (previewStage && previewCanvas && previewOverlay) {
  previewEditor = initPreviewEditor(previewStage, previewCanvas, previewOverlay, previewSlotBar, {
    getGeometry: () => getGeometry(900),
    getTransform: (imageIndex) => images[imageIndex]?.transform ?? defaultTransform(),
    getPanLimits: (imageIndex, cellW, cellH) => {
      const item = images[imageIndex];
      if (!item?.image?.naturalWidth) return { maxPanX: 0, maxPanY: 0 };
      return computePanLimits(item.image, cellW, cellH, item.transform);
    },
    onSwapSlots: swapSlots,
    onSwapArm: (slot) => {
      if (slot === null) {
        setStatus('');
      } else {
        setStatus(`Position ${slot + 1} gewählt – andere Nummer antippen`, 'success');
      }
    },
    onTransform: (imageIndex, transform) => {
      if (!images[imageIndex]) return;
      images[imageIndex].transform = transform;
      const canvas = drawPreviewCanvas();
      if (canvas) paintPreviewCanvas(canvas);
    },
    onInteractionEnd: () => {
      lastExportCanvas = buildCollageCanvas(
        images.map((i) => i.image),
        getExportOptions(),
        getTransforms()
      );
      updateActionButtons();
    },
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
renderTargetButtons();
renderLayoutButtons();
setPreviewVisible(false);
updateActionButtons();
