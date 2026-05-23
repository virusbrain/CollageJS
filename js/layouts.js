/** @typedef {{ x: number, y: number, w: number, h: number }} CellDef */

/** @typedef {{ id: string, label: string, minImages: number, maxImages: number, cells?: CellDef[], getCells?: (count: number) => CellDef[] }} LayoutDef */

/**
 * @param {number} cols
 * @param {number} rows
 * @param {number} count
 * @returns {CellDef[]}
 */
export function uniformGrid(cols, rows, count) {
  const cells = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cells.push({
      x: col / cols,
      y: row / rows,
      w: 1 / cols,
      h: 1 / rows,
    });
  }
  return cells;
}

/**
 * @param {number} count
 * @returns {CellDef[]}
 */
export function autoGrid(count) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return uniformGrid(cols, rows, count);
}

/**
 * @param {LayoutDef} layout
 * @param {number} imageCount
 * @returns {CellDef[]}
 */
export function getLayoutCells(layout, imageCount) {
  if (layout.getCells) return layout.getCells(imageCount);
  return layout.cells ?? [];
}

/**
 * @param {number} count
 * @returns {LayoutDef}
 */
function gridLayout(id, label, min, max, getCells) {
  return { id, label, minImages: min, maxImages: max, getCells };
}

/** @type {LayoutDef[]} */
export const LAYOUTS = [
  gridLayout('grid-auto', 'Raster (auto)', 2, 10, autoGrid),

  {
    id: 'row-2',
    label: '2 nebeneinander',
    minImages: 2,
    maxImages: 2,
    cells: uniformGrid(2, 1, 2),
  },
  {
    id: 'col-2',
    label: '2 untereinander',
    minImages: 2,
    maxImages: 2,
    cells: uniformGrid(1, 2, 2),
  },

  gridLayout('grid-row-3', '3 nebeneinander', 3, 3, () => uniformGrid(3, 1, 3)),
  gridLayout('grid-col-3', '3 untereinander', 3, 3, () => uniformGrid(1, 3, 3)),

  {
    id: 'row-3',
    label: '3 nebeneinander',
    minImages: 3,
    maxImages: 3,
    cells: uniformGrid(3, 1, 3),
  },
  {
    id: 'col-3',
    label: '3 untereinander',
    minImages: 3,
    maxImages: 3,
    cells: uniformGrid(1, 3, 3),
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

  {
    id: 'grid-2x2',
    label: '2×2 Raster',
    minImages: 4,
    maxImages: 4,
    cells: uniformGrid(2, 2, 4),
  },
  gridLayout('grid-row-4', '4 nebeneinander', 4, 4, () => uniformGrid(4, 1, 4)),
  gridLayout('grid-col-4', '4 untereinander', 4, 4, () => uniformGrid(1, 4, 4)),
  {
    id: 'row-4',
    label: '4 nebeneinander',
    minImages: 4,
    maxImages: 4,
    cells: uniformGrid(4, 1, 4),
  },

  gridLayout('grid-row-5', '5 nebeneinander', 5, 5, () => uniformGrid(5, 1, 5)),
  gridLayout('grid-col-5', '5 untereinander', 5, 5, () => uniformGrid(1, 5, 5)),
  {
    id: 'grid-2-3',
    label: '2 oben, 3 unten',
    minImages: 5,
    maxImages: 5,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },

  gridLayout('grid-3x2', '3×2 Raster', 6, 6, () => uniformGrid(3, 2, 6)),
  gridLayout('grid-2x3', '2×3 Raster', 6, 6, () => uniformGrid(2, 3, 6)),

  gridLayout('grid-row-7', '7 nebeneinander', 7, 7, () => uniformGrid(7, 1, 7)),
  {
    id: 'grid-3-4',
    label: '3 oben, 4 unten',
    minImages: 7,
    maxImages: 7,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 0, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },

  gridLayout('grid-4x2', '4×2 Raster', 8, 8, () => uniformGrid(4, 2, 8)),
  gridLayout('grid-2x4', '2×4 Raster', 8, 8, () => uniformGrid(2, 4, 8)),

  gridLayout('grid-3x3', '3×3 Raster', 9, 9, () => uniformGrid(3, 3, 9)),

  gridLayout('grid-5x2', '5×2 Raster', 10, 10, () => uniformGrid(5, 2, 10)),
  gridLayout('grid-2x5', '2×5 Raster', 10, 10, () => uniformGrid(2, 5, 10)),
  gridLayout('grid-row-10', '10 nebeneinander', 10, 10, () => uniformGrid(10, 1, 10)),
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
  const base =
    match && imageCount >= match.minImages && imageCount <= match.maxImages
      ? match
      : layoutsForCount(imageCount)[0];

  if (!base) return undefined;

  return {
    ...base,
    cells: getLayoutCells(base, imageCount),
  };
}
