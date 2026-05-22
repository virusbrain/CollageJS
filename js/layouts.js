/** @typedef {{ id: string, label: string, minImages: number, maxImages: number, cells: { x: number, y: number, w: number, h: number }[] }} LayoutDef */

/** @type {LayoutDef[]} */
export const LAYOUTS = [
  {
    id: 'row-2',
    label: '2 nebeneinander',
    minImages: 2,
    maxImages: 2,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'col-2',
    label: '2 untereinander',
    minImages: 2,
    maxImages: 2,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: 'grid-2x2',
    label: '2×2 Raster',
    minImages: 4,
    maxImages: 4,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'row-3',
    label: '3 nebeneinander',
    minImages: 3,
    maxImages: 3,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: 'col-3',
    label: '3 untereinander',
    minImages: 3,
    maxImages: 3,
    cells: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    id: 'big-left',
    label: 'Groß links',
    minImages: 3,
    maxImages: 3,
    cells: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      { x: 0.55, y: 0, w: 0.45, h: 0.5 },
      { x: 0.55, y: 0.5, w: 0.45, h: 0.5 },
    ],
  },
  {
    id: 'big-top',
    label: 'Groß oben',
    minImages: 3,
    maxImages: 3,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.55 },
      { x: 0, y: 0.55, w: 0.5, h: 0.45 },
      { x: 0.5, y: 0.55, w: 0.5, h: 0.45 },
    ],
  },
  {
    id: 'row-4',
    label: '4 nebeneinander',
    minImages: 4,
    maxImages: 4,
    cells: [
      { x: 0, y: 0, w: 0.25, h: 1 },
      { x: 0.25, y: 0, w: 0.25, h: 1 },
      { x: 0.5, y: 0, w: 0.25, h: 1 },
      { x: 0.75, y: 0, w: 0.25, h: 1 },
    ],
  },
  {
    id: 'grid-1-2',
    label: '1 oben, 2 unten',
    minImages: 3,
    maxImages: 3,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
];

/**
 * @param {number} imageCount
 * @returns {LayoutDef[]}
 */
export function layoutsForCount(imageCount) {
  return LAYOUTS.filter(
    (l) => imageCount >= l.minImages && imageCount <= l.maxImages
  );
}

/**
 * @param {string} layoutId
 * @param {number} imageCount
 * @returns {LayoutDef | undefined}
 */
export function findLayout(layoutId, imageCount) {
  const match = LAYOUTS.find((l) => l.id === layoutId);
  if (!match) return layoutsForCount(imageCount)[0];
  if (imageCount >= match.minImages && imageCount <= match.maxImages) {
    return match;
  }
  return layoutsForCount(imageCount)[0];
}
