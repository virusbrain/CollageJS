/** @typedef {{ id: string, label: string, hint: string, width: number | null, height: number | null }} CollageTarget */

/** @type {CollageTarget[]} */
export const TARGETS = [
  {
    id: 'free',
    label: 'Frei',
    hint: 'Automatisches Format',
    width: null,
    height: null,
  },
  {
    id: 'instagram-post',
    label: 'Instagram Post',
    hint: '1:1 · 1080×1080',
    width: 1080,
    height: 1080,
  },
  {
    id: 'instagram-portrait',
    label: 'Instagram Hoch',
    hint: '4:5 · 1080×1350',
    width: 1080,
    height: 1350,
  },
  {
    id: 'instagram-story',
    label: 'Story / Reel',
    hint: '9:16 · 1080×1920',
    width: 1080,
    height: 1920,
  },
  {
    id: 'facebook-post',
    label: 'Facebook Beitrag',
    hint: '1,91:1 · 1200×630',
    width: 1200,
    height: 630,
  },
  {
    id: 'facebook-cover',
    label: 'Facebook Titelbild',
    hint: '16:9 · 1640×924',
    width: 1640,
    height: 924,
  },
  {
    id: 'pinterest',
    label: 'Pinterest Pin',
    hint: '2:3 · 1000×1500',
    width: 1000,
    height: 1500,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    hint: '9:16 · 1080×1920',
    width: 1080,
    height: 1920,
  },
  {
    id: 'twitter-post',
    label: 'X / Twitter',
    hint: '16:9 · 1600×900',
    width: 1600,
    height: 900,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: '1:1 · 1080×1080',
    width: 1080,
    height: 1080,
  },
  {
    id: 'hd-landscape',
    label: 'HD Querformat',
    hint: '16:9 · 1920×1080',
    width: 1920,
    height: 1080,
  },
  {
    id: 'a4-print',
    label: 'A4 Druck',
    hint: 'A4 · 2480×3508',
    width: 2480,
    height: 3508,
  },
];

/**
 * @param {string} targetId
 * @returns {CollageTarget}
 */
export function findTarget(targetId) {
  return TARGETS.find((t) => t.id === targetId) ?? TARGETS[0];
}

/**
 * @param {number} contentW
 * @param {number} contentH
 * @param {CollageTarget} target
 * @param {number} previewMax
 */
export function fitContentInTarget(contentW, contentH, target, previewMax) {
  if (!target.width || !target.height) {
    const scale = Math.min(1, previewMax / Math.max(contentW, contentH));
    return {
      canvasW: Math.round(contentW * scale),
      canvasH: Math.round(contentH * scale),
      scale,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const fitScale = Math.min(target.width / contentW, target.height / contentH);
  const drawnW = contentW * fitScale;
  const drawnH = contentH * fitScale;
  const offsetX = (target.width - drawnW) / 2;
  const offsetY = (target.height - drawnH) / 2;

  const longSide = Math.max(target.width, target.height);
  const previewScale = Math.min(1, previewMax / longSide);

  return {
    canvasW: Math.round(target.width * previewScale),
    canvasH: Math.round(target.height * previewScale),
    scale: fitScale * previewScale,
    offsetX: Math.round(offsetX * previewScale),
    offsetY: Math.round(offsetY * previewScale),
  };
}
