import { findLayout } from './layouts.js';
import { findTarget } from './targets.js';

const EXPORT_MAX = 2400;

/** @typedef {{ panX: number, panY: number, zoom: number }} ImageTransform */

/**
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageTransform} [transform]
 */
/**
 * @param {HTMLImageElement} img
 * @param {number} cellW
 * @param {number} cellH
 * @param {{ panX?: number, panY?: number, zoom?: number }} transform
 */
export function computePanLimits(img, cellW, cellH, transform = { panX: 0, panY: 0, zoom: 1 }) {
  const zoom = Math.max(1, Math.min(3, transform.zoom || 1));
  const baseScale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
  const scale = baseScale * zoom;
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;

  return {
    maxPanX: Math.max(0, (sw - cellW) / 2),
    maxPanY: Math.max(0, (sh - cellH) / 2),
  };
}

export function drawCoverWithTransform(img, x, y, w, h, ctx, transform = { panX: 0, panY: 0, zoom: 1 }) {
  const zoom = Math.max(1, Math.min(3, transform.zoom || 1));
  const baseScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const scale = baseScale * zoom;
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;

  const maxPanX = Math.max(0, (sw - w) / 2);
  const maxPanY = Math.max(0, (sh - h) / 2);
  const panX = Math.max(-1, Math.min(1, transform.panX || 0));
  const panY = Math.max(-1, Math.min(1, transform.panY || 0));

  const sx = x + (w - sw) / 2 + panX * maxPanX;
  const sy = y + (h - sh) / 2 + panY * maxPanY;
  ctx.drawImage(img, sx, sy, sw, sh);
}

/**
 * Zielformat: Layout füllt die gesamte Fläche (keine Ränder).
 * @param {import('./layouts.js').CellDef[]} layoutCells
 * @param {{ width: number, height: number }} target
 * @param {number} gap
 * @param {number} previewMax
 */
/**
 * @param {{ slotIndex: number, imageIndex: number, x: number, y: number, w: number, h: number }[]} cells
 * @param {number} canvasW
 * @param {number} canvasH
 */
function snapCellsToCanvasEdges(cells, canvasW, canvasH) {
  if (!cells.length) return cells;

  const rows = new Map();
  cells.forEach((cell) => {
    const key = Math.round(cell.y);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(cell);
  });

  rows.forEach((rowCells) => {
    const rightmost = rowCells.reduce((a, b) =>
      a.x + a.w >= b.x + b.w ? a : b
    );
    rightmost.w = canvasW - rightmost.x;
  });

  const bottommost = cells.reduce((a, b) =>
    a.y + a.h >= b.y + b.h ? a : b
  );
  cells.forEach((cell) => {
    if (Math.abs(cell.y - bottommost.y) < 2) {
      cell.h = canvasH - cell.y;
    }
  });

  return cells;
}

function geometryForTarget(layoutCells, target, gap, previewMax) {
  const longSide = Math.max(target.width, target.height);
  const previewScale = Math.min(1, previewMax / longSide);
  const canvasW = Math.round(target.width * previewScale);
  const canvasH = Math.round(target.height * previewScale);
  const gapPx = gap * previewScale;

  let cells = layoutCells.map((cell, slotIndex) => {
    const atLeft = cell.x <= 0.001;
    const atTop = cell.y <= 0.001;
    const atRight = cell.x + cell.w >= 0.999;
    const atBottom = cell.y + cell.h >= 0.999;

    const insetL = atLeft ? 0 : gapPx / 2;
    const insetT = atTop ? 0 : gapPx / 2;
    const insetR = atRight ? 0 : gapPx / 2;
    const insetB = atBottom ? 0 : gapPx / 2;

    return {
      slotIndex,
      imageIndex: slotIndex,
      x: Math.round(cell.x * canvasW + insetL),
      y: Math.round(cell.y * canvasH + insetT),
      w: Math.max(1, Math.round(cell.w * canvasW - insetL - insetR)),
      h: Math.max(1, Math.round(cell.h * canvasH - insetT - insetB)),
    };
  });

  cells = snapCellsToCanvasEdges(cells, canvasW, canvasH);

  return { width: canvasW, height: canvasH, cells };
}

/**
 * Freies Format: Größe ergibt sich aus den Bildproportionen.
 * @param {HTMLImageElement[]} images
 * @param {import('./layouts.js').CellDef[]} layoutCells
 * @param {number} gap
 * @param {number} previewMax
 */
function geometryFree(images, layoutCells, gap, previewMax) {
  const refs = images.map((img) => ({
    w: img.naturalWidth || 1,
    h: img.naturalHeight || 1,
  }));

  let unit = 0;
  layoutCells.forEach((cell, i) => {
    const ref = refs[Math.min(i, refs.length - 1)];
    unit = Math.max(unit, ref.w / cell.w, ref.h / cell.h);
  });

  const contentW = unit + gap;
  const contentH = unit + gap;
  const scale = Math.min(1, previewMax / Math.max(contentW, contentH));
  const canvasW = Math.round(contentW * scale);
  const canvasH = Math.round(contentH * scale);
  const gapPx = gap * scale;

  const cells = layoutCells.map((cell, slotIndex) => {
    const insetL = cell.x > 0 ? gapPx / 2 : 0;
    const insetT = cell.y > 0 ? gapPx / 2 : 0;
    const insetR = cell.x + cell.w < 1 ? gapPx / 2 : 0;
    const insetB = cell.y + cell.h < 1 ? gapPx / 2 : 0;

    const w = Math.max(1, cell.w * unit * scale - insetL - insetR);
    const h = Math.max(1, cell.h * unit * scale - insetT - insetB);

    return {
      slotIndex,
      imageIndex: slotIndex,
      x: Math.round(cell.x * unit * scale + insetL),
      y: Math.round(cell.y * unit * scale + insetT),
      w: Math.round(w),
      h: Math.round(h),
    };
  });

  return { width: canvasW, height: canvasH, cells };
}

/**
 * @param {HTMLImageElement[]} images
 * @param {{ layoutId: string, gap: number, targetId?: string, previewMax?: number }} options
 */
export function computeCollageGeometry(images, options) {
  const layout = findLayout(options.layoutId, images.length);
  if (!layout || images.length < 2) return null;

  const layoutCells = layout.cells;
  if (!layoutCells.length || layoutCells.length < images.length) return null;

  const gap = options.gap;
  const previewMax = options.previewMax ?? 1200;
  const target = findTarget(options.targetId ?? 'free');

  if (target.width && target.height) {
    return geometryForTarget(layoutCells, target, gap, previewMax);
  }

  return geometryFree(images, layoutCells, gap, previewMax);
}

/**
 * @param {HTMLImageElement[]} images
 * @param {{ layoutId: string, gap: number, background: string, targetId?: string, previewMax?: number }} options
 * @param {ImageTransform[]} [transforms]
 * @returns {HTMLCanvasElement | null}
 */
export function buildCollageCanvas(images, options, transforms) {
  const geometry = computeCollageGeometry(images, options);
  if (!geometry) return null;

  const canvas = document.createElement('canvas');
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, geometry.width, geometry.height);

  geometry.cells.forEach((cell) => {
    const img = images[cell.imageIndex];
    const t = transforms?.[cell.imageIndex] ?? { panX: 0, panY: 0, zoom: 1 };

    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.w, cell.h);
    ctx.clip();
    drawCoverWithTransform(img, cell.x, cell.y, cell.w, cell.h, ctx, t);
    ctx.restore();
  });

  return canvas;
}

/**
 * @param {HTMLCanvasElement} source
 * @param {{ targetId?: string }} [options]
 * @returns {HTMLCanvasElement}
 */
export function upscaleForExport(source, options = {}) {
  const target = findTarget(options.targetId ?? 'free');

  if (target.width && target.height) {
    if (source.width === target.width && source.height === target.height) {
      return source;
    }
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, target.width, target.height);
    return canvas;
  }

  const max = Math.max(source.width, source.height);
  if (max >= EXPORT_MAX) return source;

  const scale = EXPORT_MAX / max;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
