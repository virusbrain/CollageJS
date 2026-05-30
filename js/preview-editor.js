/**
 * Interaktive Vorschau – Tauschen über Nummern-Leiste, Pan/Zoom in der Vorschau.
 */
export function initPreviewEditor(stage, canvas, overlay, slotBar, callbacks) {
  let selectedSlot = 0;
  /** @type {number | null} */
  let swapPickSlot = null;

  /** @type {{ slot: number, imageIndex: number, pointerId?: number, startX: number, startY: number, startPanX: number, startPanY: number } | null} */
  let panDrag = null;

  /** @type {Map<number, { x: number, y: number }>} */
  let pinchPointers = new Map();
  /** @type {{ imageIndex: number, startDist: number, startZoom: number } | null} */
  let pinch = null;

  /** @type {{ imageIndex: number, startDist: number, startZoom: number } | null} */
  let touchPinch = null;

  let suppressPointerUntil = 0;

  function pct(value, total) {
    return `${(value / total) * 100}%`;
  }

  function clearSwapHighlight() {
    overlay.querySelectorAll('.preview-cell--swap-pick').forEach((n) => {
      n.classList.remove('preview-cell--swap-pick');
    });
    slotBar?.querySelectorAll('.preview-slot-chip').forEach((n) => {
      n.classList.remove('preview-slot-chip--active');
    });
  }

  function setSwapPick(slot) {
    swapPickSlot = slot;
    clearSwapHighlight();
    if (slot !== null) {
      overlay.querySelector(`[data-slot="${slot}"]`)?.classList.add('preview-cell--swap-pick');
      slotBar?.querySelector(`[data-slot="${slot}"]`)?.classList.add('preview-slot-chip--active');
      callbacks.onSwapArm?.(slot);
    } else {
      callbacks.onSwapArm?.(null);
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

  function applyPanDelta(slot, imageIndex, dx, dy, startPanX, startPanY) {
    const geometry = callbacks.getGeometry();
    const cell = geometry?.cells.find((c) => c.slotIndex === slot);
    if (!cell || !geometry) return;

    const limits = callbacks.getPanLimits(imageIndex, cell.w, cell.h);
    const rect = stage.getBoundingClientRect();
    const cellScreenW = (cell.w / geometry.width) * rect.width;
    const cellScreenH = (cell.h / geometry.height) * rect.height;
    if (cellScreenW < 1 || cellScreenH < 1) return;

    const scaleX = cell.w / cellScreenW;
    const scaleY = cell.h / cellScreenH;
    const deltaCanvasX = dx * scaleX;
    const deltaCanvasY = dy * scaleY;

    const startOffsetX = startPanX * limits.maxPanX;
    const startOffsetY = startPanY * limits.maxPanY;
    const newOffsetX = clamp(startOffsetX - deltaCanvasX, -limits.maxPanX, limits.maxPanX);
    const newOffsetY = clamp(startOffsetY - deltaCanvasY, -limits.maxPanY, limits.maxPanY);

    const current = callbacks.getTransform(imageIndex);
    callbacks.onTransform(imageIndex, {
      ...current,
      panX: limits.maxPanX > 0 ? newOffsetX / limits.maxPanX : 0,
      panY: limits.maxPanY > 0 ? newOffsetY / limits.maxPanY : 0,
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function touchDistance(touches) {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function zoomFromPinchRatio(startZoom, ratio) {
    const gain = 1.15;
    const scaled = 1 + (ratio - 1) * gain;
    return clamp(startZoom * scaled, 1, 3);
  }

  function applyPinchZoom(imageIndex, startDist, startZoom, currentDist) {
    if (startDist < 8) return;
    const ratio = currentDist / startDist;
    const zoom = zoomFromPinchRatio(startZoom, ratio);
    const current = callbacks.getTransform(imageIndex);
    callbacks.onTransform(imageIndex, { ...current, zoom });
  }

  function cellFromTouch(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    return /** @type {HTMLElement | null} */ (el?.closest?.('.preview-cell') ?? null);
  }

  function startPan(slot, imageIndex, clientX, clientY) {
    const t = callbacks.getTransform(imageIndex);
    panDrag = {
      slot,
      imageIndex,
      startX: clientX,
      startY: clientY,
      startPanX: t.panX,
      startPanY: t.panY,
    };
    overlay.querySelector(`[data-slot="${slot}"]`)?.classList.add('preview-cell--panning');
  }

  function movePan(clientX, clientY) {
    if (!panDrag) return;
    applyPanDelta(
      panDrag.slot,
      panDrag.imageIndex,
      clientX - panDrag.startX,
      clientY - panDrag.startY,
      panDrag.startPanX,
      panDrag.startPanY
    );
  }

  function endPan() {
    if (!panDrag) return;
    overlay.querySelectorAll('.preview-cell--panning').forEach((n) => {
      n.classList.remove('preview-cell--panning');
    });
    panDrag = null;
    callbacks.onInteractionEnd();
  }

  function endPinch() {
    if (!pinch && !touchPinch) return;
    pinch = null;
    touchPinch = null;
    callbacks.onInteractionEnd();
  }

  function bindOverlayTouch() {
    const onTouchStart = (e) => {
      if (swapPickSlot !== null) return;

      if (e.touches.length >= 2) {
        e.preventDefault();
        panDrag = null;
        overlay.querySelectorAll('.preview-cell--panning').forEach((n) => {
          n.classList.remove('preview-cell--panning');
        });

        const cellEl =
          cellFromTouch(e.touches[0]) || cellFromTouch(e.touches[1]);
        if (!cellEl) return;

        const imageIndex = Number(cellEl.dataset.imageIndex);
        const dist = touchDistance(e.touches);
        touchPinch = {
          imageIndex,
          startDist: dist,
          startZoom: callbacks.getTransform(imageIndex).zoom,
        };
        return;
      }

      if (e.touches.length !== 1) return;

      const cellEl = /** @type {HTMLElement} */ (e.target).closest('.preview-cell');
      if (!cellEl) return;

      suppressPointerUntil = Date.now() + 120;
      e.preventDefault();

      const slot = Number(cellEl.dataset.slot);
      const imageIndex = Number(cellEl.dataset.imageIndex);
      const t = e.touches[0];
      startPan(slot, imageIndex, t.clientX, t.clientY);
    };

    const onTouchMove = (e) => {
      if (swapPickSlot !== null) return;

      if (touchPinch && e.touches.length >= 2) {
        e.preventDefault();
        applyPinchZoom(
          touchPinch.imageIndex,
          touchPinch.startDist,
          touchPinch.startZoom,
          touchDistance(e.touches)
        );
        return;
      }

      if (e.touches.length >= 2 && !touchPinch) {
        e.preventDefault();
        const cellEl =
          cellFromTouch(e.touches[0]) || cellFromTouch(e.touches[1]);
        if (!cellEl) return;
        const imageIndex = Number(cellEl.dataset.imageIndex);
        const dist = touchDistance(e.touches);
        touchPinch = {
          imageIndex,
          startDist: dist,
          startZoom: callbacks.getTransform(imageIndex).zoom,
        };
        panDrag = null;
        return;
      }

      if (!panDrag || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      movePan(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e) => {
      if (touchPinch && e.touches.length < 2) {
        endPinch();
      }
      if (panDrag && e.touches.length === 0) {
        endPan();
      }
    };

    overlay.addEventListener('touchstart', onTouchStart, { passive: false });
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });
    overlay.addEventListener('touchend', onTouchEnd, { passive: false });
    overlay.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  function renderSlotBar(geometry) {
    if (!slotBar) return;

    if (!geometry) {
      slotBar.hidden = true;
      slotBar.innerHTML = '';
      return;
    }

    slotBar.hidden = false;
    slotBar.innerHTML = '';

    geometry.cells.forEach((cell) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preview-slot-chip';
      chip.dataset.slot = String(cell.slotIndex);
      chip.setAttribute('aria-label', `Position ${cell.slotIndex + 1} zum Tauschen wählen`);
      chip.textContent = String(cell.slotIndex + 1);

      if (cell.slotIndex === swapPickSlot) {
        chip.classList.add('preview-slot-chip--active');
      }

      chip.addEventListener('click', () => {
        tryTapSwap(cell.slotIndex);
      });

      slotBar.appendChild(chip);
    });
  }

  function renderOverlays() {
    const geometry = callbacks.getGeometry();
    overlay.innerHTML = '';

    if (!geometry) {
      renderSlotBar(null);
      return;
    }

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

      overlay.appendChild(el);
    });

    renderSlotBar(geometry);
  }

  bindOverlayTouch();

  overlay.addEventListener('pointerdown', (e) => {
    if (Date.now() < suppressPointerUntil) return;
    if (touchPinch) return;

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

    if (swapPickSlot !== null) return;

    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPointers.size === 2) {
      const pts = [...pinchPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch = { imageIndex, startDist: dist, startZoom: callbacks.getTransform(imageIndex).zoom };
      panDrag = null;
      return;
    }

    if (pinchPointers.size > 2) return;

    e.preventDefault();
    cellEl.setPointerCapture(e.pointerId);
    startPan(slot, imageIndex, e.clientX, e.clientY);
    panDrag.pointerId = e.pointerId;
  });

  overlay.addEventListener('pointermove', (e) => {
    if (Date.now() < suppressPointerUntil) return;

    if (pinchPointers.has(e.pointerId)) {
      pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinch && pinchPointers.size >= 2) {
      const pts = [...pinchPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      applyPinchZoom(pinch.imageIndex, pinch.startDist, pinch.startZoom, dist);
      return;
    }

    if (!panDrag || panDrag.pointerId !== e.pointerId) return;
    movePan(e.clientX, e.clientY);
  });

  function endPointer(e) {
    pinchPointers.delete(e.pointerId);
    if (pinch && pinchPointers.size < 2) {
      pinch = null;
      callbacks.onInteractionEnd();
    }

    if (!panDrag || panDrag.pointerId !== e.pointerId) return;
    try {
      overlay.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endPan();
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
      endPan();
      endPinch();
      renderOverlays();
    },
    cancelSwapPick() {
      setSwapPick(null);
    },
  };
}
