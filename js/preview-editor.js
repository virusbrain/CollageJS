/**
 * Interaktive Vorschau – iOS-taugliches Tauschen per Touch, Pan/Zoom per Pointer.
 */
export function initPreviewEditor(stage, canvas, overlay, callbacks) {
  let selectedSlot = 0;
  /** @type {number | null} */
  let swapPickSlot = null;

  /** @type {{ mode: 'pan', slot: number, imageIndex: number, pointerId: number, startX: number, startY: number, startPanX: number, startPanY: number } | null} */
  let drag = null;

  /** @type {Map<number, { x: number, y: number }>} */
  let pinchPointers = new Map();
  /** @type {{ imageIndex: number, startDist: number, startZoom: number } | null} */
  let pinch = null;

  /** @type {{ slot: number, targetSlot: number, startX: number, startY: number, moved: boolean } | null} */
  let touchSwap = null;

  /** Letzter Touch-Zeitstempel – verhindert doppelte Pointer-Events auf iOS */
  let suppressPointerUntil = 0;

  const preferTouchSwap =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

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
      callbacks.onSwapArm?.(slot);
    } else {
      callbacks.onSwapArm?.(null);
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

  function removeTouchSwapListeners() {
    if (!touchSwap?.cleanup) return;
    touchSwap.cleanup();
    touchSwap = null;
  }

  /**
   * @param {HTMLElement} handle
   * @param {number} slot
   * @param {HTMLElement} cellEl
   */
  function bindTouchSwapHandle(handle, slot, cellEl) {
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;

      suppressPointerUntil = Date.now() + 600;
      e.preventDefault();
      e.stopPropagation();

      const t = e.touches[0];
      touchSwap = {
        slot,
        targetSlot: -1,
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        cleanup: null,
      };

      cellEl.classList.add('preview-cell--dragging');

      const onTouchMove = (ev) => {
        if (!touchSwap || touchSwap.slot !== slot) return;
        ev.preventDefault();

        const touch = ev.touches[0];
        if (!touch) return;

        const dist = Math.hypot(touch.clientX - touchSwap.startX, touch.clientY - touchSwap.startY);
        if (dist > 10) touchSwap.moved = true;

        const hovered = slotFromPoint(touch.clientX, touch.clientY);
        touchSwap.targetSlot = hovered >= 0 && hovered !== slot ? hovered : -1;
        highlightSwapTarget(touchSwap.targetSlot, slot);
      };

      const onTouchEnd = (ev) => {
        if (!touchSwap || touchSwap.slot !== slot) return;
        ev.preventDefault();
        ev.stopPropagation();

        const touch = ev.changedTouches[0];
        if (touch && !touchSwap.moved) {
          const dist = Math.hypot(touch.clientX - touchSwap.startX, touch.clientY - touchSwap.startY);
          if (dist > 14) touchSwap.moved = true;
        }

        cellEl.classList.remove('preview-cell--dragging');
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);

        if (!touchSwap.moved) {
          tryTapSwap(slot);
        } else if (touchSwap.targetSlot >= 0) {
          setSwapPick(null);
          callbacks.onSwapSlots(slot, touchSwap.targetSlot);
        }

        clearSwapHighlight();
        touchSwap = null;
      };

      touchSwap.cleanup = () => {
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        cellEl.classList.remove('preview-cell--dragging');
      };

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { passive: false });
      document.addEventListener('touchcancel', onTouchEnd, { passive: false });
    };

    handle.addEventListener('touchstart', onTouchStart, { passive: false });
  }

  /**
   * @param {HTMLElement} cellEl
   * @param {number} slot
   */
  function bindTouchSwapCell(cellEl, slot) {
    cellEl.addEventListener(
      'touchend',
      (e) => {
        if (swapPickSlot === null || swapPickSlot === slot) return;
        if (e.target.closest('.preview-cell-handle')) return;

        suppressPointerUntil = Date.now() + 600;
        e.preventDefault();
        tryTapSwap(slot);
      },
      { passive: false }
    );
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
      handle.setAttribute('aria-label', `Position ${cell.slotIndex + 1} tauschen`);
      handle.textContent = String(cell.slotIndex + 1);

      el.appendChild(handle);
      overlay.appendChild(el);

      bindTouchSwapHandle(handle, cell.slotIndex, el);
      bindTouchSwapCell(el, cell.slotIndex);
    });
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (Date.now() < suppressPointerUntil) return;

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
      if (preferTouchSwap) return;

      e.preventDefault();
      handle.setPointerCapture(e.pointerId);

      let targetSlot = -1;
      let moved = false;
      const startX = e.clientX;
      const startY = e.clientY;

      cellEl.classList.add('preview-cell--dragging');

      const onMove = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist > 8) moved = true;
        const hovered = slotFromPoint(ev.clientX, ev.clientY);
        targetSlot = hovered >= 0 && hovered !== slot ? hovered : -1;
        highlightSwapTarget(targetSlot, slot);
      };

      const onUp = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        cellEl.classList.remove('preview-cell--dragging');
        clearSwapHighlight();

        if (!moved) tryTapSwap(slot);
        else if (targetSlot >= 0) {
          setSwapPick(null);
          callbacks.onSwapSlots(slot, targetSlot);
        }
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      return;
    }

    if (swapPickSlot !== null && !preferTouchSwap) {
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
    if (Date.now() < suppressPointerUntil) return;

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
    if (Date.now() < suppressPointerUntil) return;

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
      removeTouchSwapListeners();
      renderOverlays();
    },
    cancelSwapPick() {
      setSwapPick(null);
    },
  };
}
