import { findLayout } from './layouts.js';

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
 * @param {HTMLImageElement[]} images
 * @param {{ layoutId: string, gap: number, previewMax?: number }} options
 */
export function computeCollageGeometry(images, options) {
  const layout = findLayout(options.layoutId, images.length);
  if (!layout || images.length < 2) return null;

  const gap = options.gap;
  const previewMax = options.previewMax ?? 1200;

  const refs = images.map((img) => ({
    w: img.naturalWidth || 1,
    h: img.naturalHeight || 1,
  }));

  let unit = 0;
  layout.cells.forEach((cell, i) => {
    const ref = refs[Math.min(i, refs.length - 1)];
    unit = Math.max(unit, ref.w / cell.w, ref.h / cell.h);
  });

  const contentW = Math.max(...layout.cells.map((c) => (c.x + c.w) * unit));
  const contentH = Math.max(...layout.cells.map((c) => (c.y + c.h) * unit));
  const totalW = contentW + gap;
  const totalH = contentH + gap;
  const scale = Math.min(1, previewMax / Math.max(totalW, totalH));
  const width = Math.round(totalW * scale);
  const height = Math.round(totalH * scale);
  const sUnit = unit * scale;
  const sGap = gap * scale;

  const cells = layout.cells.map((cell, slotIndex) => {
    const insetL = cell.x > 0 ? sGap / 2 : 0;
    const insetT = cell.y > 0 ? sGap / 2 : 0;
    const insetR = cell.x + cell.w < 1 ? sGap / 2 : 0;
    const insetB = cell.y + cell.h < 1 ? sGap / 2 : 0;

    const w = Math.max(1, Math.round(cell.w * sUnit - insetL - insetR));
    const h = Math.max(1, Math.round(cell.h * sUnit - insetT - insetB));

    return {
      slotIndex,
      imageIndex: slotIndex,
      x: Math.round(cell.x * sUnit + insetL),
      y: Math.round(cell.y * sUnit + insetT),
      w,
      h,
    };
  });

  return { width, height, cells };
}

/**
 * @param {HTMLImageElement[]} images
 * @param {{ layoutId: string, gap: number, background: string, previewMax?: number }} options
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
 * @param {number} maxSide
 * @returns {HTMLCanvasElement}
 */
export function upscaleForExport(source, maxSide = EXPORT_MAX) {
  const max = Math.max(source.width, source.height);
  if (max >= maxSide) return source;

  const scale = maxSide / max;
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
