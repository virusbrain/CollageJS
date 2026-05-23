/**
 * Interaktive Vorschau: Reihenfolge per Ziehen der Nummer, Bild per Wischen positionieren, Zoomen per Pinch.
 * @param {HTMLElement} stage
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} overlay
 * @param {{
 *   getGeometry: () => { width: number, height: number, cells: { slotIndex: number, imageIndex: number, x: number, y: number, w: number, h: number }[] } | null,
 *   getTransform: (imageIndex: number) => { panX: number, panY: number, zoom: number },
 *   onSwapSlots: (fromSlot: number, toSlot: number) => void,
 *   onTransform: (imageIndex: number, transform: { panX: number, panY: number, zoom: number }) => void,
 *   onInteractionEnd: () => void,
 * }} callbacks
 */
export function initPreviewEditor(stage, canvas, overlay, callbacks) {
  let selectedSlot = 0;

  /** @type {{ mode: 'swap', slot: number, pointerId: number } | { mode: 'pan', slot: number, imageIndex: number, pointerId: number, startX: number, startY: number, startPanX: number, startPanY: number } | null} */
  let drag = null;

  /** @type {Map<number, { x: number, y: number }>} */
  let pinchPointers = new Map();
  /** @type {{ imageIndex: number, startDist: number, startZoom: number } | null} */
  let pinch = null;

  function pct(value, total) {
    return `${(value / total) * 100}%`;
  }

  function renderOverlays() {
    const geometry = callbacks.getGeometry();
    overlay.innerHTML = '';
    if (!geometry) return;

    const { width, height, cells } = geometry;

    cells.forEach((cell) => {
      const el = document.createElement('div');
      el.className = 'preview-cell';
      if (cell.slotIndex === selectedSlot) el.classList.add('preview-cell--selected');
      el.dataset.slot = String(cell.slotIndex);
      el.dataset.imageIndex = String(cell.imageIndex);
      el.style.left = pct(cell.x, width);
      el.style.top = pct(cell.y, height);
      el.style.width = pct(cell.w, width);
      el.style.height = pct(cell.h, height);

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'preview-cell-handle';
      handle.setAttribute('aria-label', `Position ${cell.slotIndex + 1} tauschen`);
      handle.textContent = String(cell.slotIndex + 1);

      el.appendChild(handle);
      overlay.appendChild(el);
    });
  }

  function slotFromPoint(clientX, clientY) {
    const cell = document.elementFromPoint(clientX, clientY)?.closest?.('.preview-cell');
    if (!cell || !overlay.contains(cell)) return -1;
    return Number(/** @type {HTMLElement} */ (cell).dataset.slot);
  }

  function clearSwapHighlight() {
    overlay.querySelectorAll('.preview-cell--swap-target').forEach((n) => {
      n.classList.remove('preview-cell--swap-target');
    });
  }

  function highlightSwapTarget(clientX, clientY, fromSlot) {
    clearSwapHighlight();
    const target = slotFromPoint(clientX, clientY);
    if (target >= 0 && target !== fromSlot) {
      overlay.querySelector(`[data-slot="${target}"]`)?.classList.add('preview-cell--swap-target');
    }
  }

  overlay.addEventListener('pointerdown', (e) => {
    const handle = /** @type {HTMLElement} */ (e.target).closest('.preview-cell-handle');
    const cellEl = /** @type {HTMLElement} */ (e.target).closest('.preview-cell');
    if (!cellEl) return;

    const slot = Number(cellEl.dataset.slot);
    const imageIndex = Number(cellEl.dataset.imageIndex);
    selectedSlot = slot;
    renderOverlays();

    if (handle) {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      drag = { mode: 'swap', slot, pointerId: e.pointerId };
      cellEl.classList.add('preview-cell--dragging');
      return;
    }

    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPointers.size === 2) {
      const pts = [...pinchPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch = { imageIndex, startDist: dist, startZoom: callbacks.getTransform(imageIndex).zoom };
      return;
    }

    if (pinchPointers.size > 2) return;

    const t = callbacks.getTransform(imageIndex);
    e.preventDefault();
    cellEl.setPointerCapture(e.pointerId);
    drag = {
      mode: 'pan',
      slot,
      imageIndex,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: t.panX,
      startPanY: t.panY,
    };
  });

  overlay.addEventListener('pointermove', (e) => {
    if (pinchPointers.has(e.pointerId)) {
      pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinch && pinchPointers.size >= 2) {
      const pts = [...pinchPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const zoom = Math.max(1, Math.min(3, pinch.startZoom * (dist / pinch.startDist)));
      const current = callbacks.getTransform(pinch.imageIndex);
      callbacks.onTransform(pinch.imageIndex, { ...current, zoom });
      callbacks.onInteractionEnd();
      return;
    }

    if (!drag || e.pointerId !== drag.pointerId) return;

    if (drag.mode === 'swap') {
      highlightSwapTarget(e.clientX, e.clientY, drag.slot);
      return;
    }

    const geometry = callbacks.getGeometry();
    const cell = geometry?.cells.find((c) => c.slotIndex === drag.slot);
    if (!cell || !geometry) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const rect = stage.getBoundingClientRect();
    const cellScreenW = (cell.w / geometry.width) * rect.width;
    const cellScreenH = (cell.h / geometry.height) * rect.height;

    const panX = drag.startPanX - (dx / cellScreenW) * 2;
    const panY = drag.startPanY - (dy / cellScreenH) * 2;
    const current = callbacks.getTransform(drag.imageIndex);

    callbacks.onTransform(drag.imageIndex, {
      ...current,
      panX: Math.max(-1, Math.min(1, panX)),
      panY: Math.max(-1, Math.min(1, panY)),
    });
  });

  function endPointer(e) {
    pinchPointers.delete(e.pointerId);
    if (pinchPointers.size < 2) pinch = null;

    if (!drag || e.pointerId !== drag.pointerId) return;

    if (drag.mode === 'swap') {
      const target = slotFromPoint(e.clientX, e.clientY);
      if (target >= 0 && target !== drag.slot) {
        callbacks.onSwapSlots(drag.slot, target);
      }
    } else {
      callbacks.onInteractionEnd();
    }

    overlay.querySelectorAll('.preview-cell--dragging').forEach((n) => {
      n.classList.remove('preview-cell--dragging');
    });
    clearSwapHighlight();
    drag = null;
  }

  overlay.addEventListener('pointerup', endPointer);
  overlay.addEventListener('pointercancel', endPointer);

  overlay.addEventListener(
    'wheel',
    (e) => {
      const cellEl = /** @type {HTMLElement} */ (e.target).closest('.preview-cell');
      if (!cellEl) return;
      e.preventDefault();

      const imageIndex = Number(cellEl.dataset.imageIndex);
      const current = callbacks.getTransform(imageIndex);
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const zoom = Math.max(1, Math.min(3, current.zoom + delta));

      callbacks.onTransform(imageIndex, { ...current, zoom });
      callbacks.onInteractionEnd();
    },
    { passive: false }
  );

  return {
    update() {
      renderOverlays();
    },
  };
}
