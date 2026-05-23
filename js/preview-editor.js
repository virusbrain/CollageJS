/**
 * Interaktive Vorschau: Reihenfolge tauschen (Ziehen oder Tippen), Bild positionieren & zoomen.
 */
export function initPreviewEditor(stage, canvas, overlay, callbacks) {
  let selectedSlot = 0;
  /** @type {number | null} Erste getippte Position zum Tauschen */
  let swapPickSlot = null;

  /** @type {{ mode: 'swap', slot: number, pointerId: number, targetSlot: number, moved: boolean } | { mode: 'pan', slot: number, imageIndex: number, pointerId: number, startX: number, startY: number, startPanX: number, startPanY: number } | null} */
  let drag = null;

  /** @type {Map<number, { x: number, y: number }>} */
  let pinchPointers = new Map();
  /** @type {{ imageIndex: number, startDist: number, startZoom: number } | null} */
  let pinch = null;

  /** @type {((e: PointerEvent) => void) | null} */
  let docMoveHandler = null;
  /** @type {((e: PointerEvent) => void) | null} */
  let docEndHandler = null;

  function pct(value, total) {
    return `${(value / total) * 100}%`;
  }

  function slotFromPoint(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      const cell = el.closest?.('.preview-cell');
      if (cell && overlay.contains(cell)) {
        return Number(/** @type {HTMLElement} */ (cell).dataset.slot);
      }
    }
    return -1;
  }

  function clearSwapHighlight() {
    overlay.querySelectorAll('.preview-cell--swap-target').forEach((n) => {
      n.classList.remove('preview-cell--swap-target');
    });
    overlay.querySelectorAll('.preview-cell--swap-pick').forEach((n) => {
      n.classList.remove('preview-cell--swap-pick');
    });
  }

  function setSwapPick(slot) {
    swapPickSlot = slot;
    clearSwapHighlight();
    if (slot !== null) {
      overlay.querySelector(`[data-slot="${slot}"]`)?.classList.add('preview-cell--swap-pick');
    }
  }

  function highlightSwapTarget(targetSlot, fromSlot) {
    overlay.querySelectorAll('.preview-cell--swap-target').forEach((n) => {
      n.classList.remove('preview-cell--swap-target');
    });
    if (targetSlot >= 0 && targetSlot !== fromSlot) {
      overlay.querySelector(`[data-slot="${targetSlot}"]`)?.classList.add('preview-cell--swap-target');
    }
  }

  function removeDocListeners() {
    if (docMoveHandler) {
      document.removeEventListener('pointermove', docMoveHandler);
      docMoveHandler = null;
    }
    if (docEndHandler) {
      document.removeEventListener('pointerup', docEndHandler);
      document.removeEventListener('pointercancel', docEndHandler);
      docEndHandler = null;
    }
  }

  function finishSwapDrag() {
    if (!drag || drag.mode !== 'swap') return;

    const { slot, targetSlot } = drag;
    overlay.querySelectorAll('.preview-cell--dragging').forEach((n) => {
      n.classList.remove('preview-cell--dragging');
    });
    clearSwapHighlight();
    removeDocListeners();

    if (targetSlot >= 0 && targetSlot !== slot) {
      setSwapPick(null);
      callbacks.onSwapSlots(slot, targetSlot);
    }

    drag = null;
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
      if (cell.slotIndex === swapPickSlot) el.classList.add('preview-cell--swap-pick');
      el.dataset.slot = String(cell.slotIndex);
      el.dataset.imageIndex = String(cell.imageIndex);
      el.style.left = pct(cell.x, width);
      el.style.top = pct(cell.y, height);
      el.style.width = pct(cell.w, width);
      el.style.height = pct(cell.h, height);

      const handle = document.createElement('div');
      handle.className = 'preview-cell-handle';
      handle.setAttribute('role', 'button');
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('aria-label', `Position ${cell.slotIndex + 1} tauschen`);
      handle.textContent = String(cell.slotIndex + 1);

      el.appendChild(handle);
      overlay.appendChild(el);
    });
  }

  function tryTapSwap(slot) {
    if (swapPickSlot === null) {
      setSwapPick(slot);
      return;
    }
    if (swapPickSlot === slot) {
      setSwapPick(null);
      return;
    }
    const from = swapPickSlot;
    setSwapPick(null);
    callbacks.onSwapSlots(from, slot);
  }

  overlay.addEventListener('pointerdown', (e) => {
    const handle = /** @type {HTMLElement} */ (e.target).closest('.preview-cell-handle');
    const cellEl = /** @type {HTMLElement} */ (e.target).closest('.preview-cell');
    if (!cellEl) return;

    const slot = Number(cellEl.dataset.slot);
    const imageIndex = Number(cellEl.dataset.imageIndex);

    if (selectedSlot !== slot) {
      selectedSlot = slot;
      overlay.querySelectorAll('.preview-cell').forEach((cell) => {
        cell.classList.toggle(
          'preview-cell--selected',
          Number(/** @type {HTMLElement} */ (cell).dataset.slot) === slot
        );
      });
    }

    if (handle) {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);

      drag = {
        mode: 'swap',
        slot,
        pointerId: e.pointerId,
        targetSlot: -1,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
      };
      cellEl.classList.add('preview-cell--dragging');

      docMoveHandler = (ev) => {
        if (!drag || drag.mode !== 'swap' || ev.pointerId !== drag.pointerId) return;

        const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
        if (dist > 8) drag.moved = true;

        const hovered = slotFromPoint(ev.clientX, ev.clientY);
        drag.targetSlot = hovered >= 0 && hovered !== drag.slot ? hovered : -1;
        highlightSwapTarget(drag.targetSlot, drag.slot);
      };

      docEndHandler = (ev) => {
        if (!drag || drag.mode !== 'swap' || ev.pointerId !== drag.pointerId) return;

        if (!drag.moved) {
          tryTapSwap(drag.slot);
          if (ev.target instanceof Element && ev.target.hasPointerCapture(ev.pointerId)) {
            ev.target.releasePointerCapture(ev.pointerId);
          }
          overlay.querySelectorAll('.preview-cell--dragging').forEach((n) => {
            n.classList.remove('preview-cell--dragging');
          });
          clearSwapHighlight();
          removeDocListeners();
          drag = null;
          return;
        }

        finishSwapDrag();
      };

      document.addEventListener('pointermove', docMoveHandler);
      document.addEventListener('pointerup', docEndHandler);
      document.addEventListener('pointercancel', docEndHandler);
      return;
    }

    if (swapPickSlot !== null) {
      tryTapSwap(slot);
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

    if (!drag || drag.mode !== 'pan' || e.pointerId !== drag.pointerId) return;

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

  function endPan(e) {
    pinchPointers.delete(e.pointerId);
    if (pinchPointers.size < 2) pinch = null;

    if (!drag || drag.mode !== 'pan' || e.pointerId !== drag.pointerId) return;

    callbacks.onInteractionEnd();
    drag = null;
  }

  overlay.addEventListener('pointerup', endPan);
  overlay.addEventListener('pointercancel', endPan);

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
    cancelSwapPick() {
      setSwapPick(null);
    },
  };
}
