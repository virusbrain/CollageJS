import { findLayout } from './layouts.js';

const EXPORT_MAX = 2400;

/**
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {CanvasRenderingContext2D} ctx
 */
function drawCover(img, x, y, w, h, ctx) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const sx = x + (w - sw) / 2;
  const sy = y + (h - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);
}

/**
 * @param {HTMLImageElement[]} images
 * @param {{ layoutId: string, gap: number, background: string, previewMax?: number }} options
 * @returns {HTMLCanvasElement | null}
 */
export function buildCollageCanvas(images, options) {
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
  const w = Math.round(totalW * scale);
  const h = Math.round(totalH * scale);
  const sUnit = unit * scale;
  const sGap = gap * scale;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, w, h);

  layout.cells.forEach((cell, index) => {
    const img = images[Math.min(index, images.length - 1)];
    const insetL = cell.x > 0 ? sGap / 2 : 0;
    const insetT = cell.y > 0 ? sGap / 2 : 0;
    const insetR = cell.x + cell.w < 1 ? sGap / 2 : 0;
    const insetB = cell.y + cell.h < 1 ? sGap / 2 : 0;

    const drawX = Math.round(cell.x * sUnit + insetL);
    const drawY = Math.round(cell.y * sUnit + insetT);
    const drawW = Math.round(cell.w * sUnit - insetL - insetR);
    const drawH = Math.round(cell.h * sUnit - insetT - insetB);

    ctx.save();
    ctx.beginPath();
    ctx.rect(drawX, drawY, drawW, drawH);
    ctx.clip();
    drawCover(img, drawX, drawY, drawW, drawH, ctx);
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
