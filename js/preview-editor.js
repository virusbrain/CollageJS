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

  function bindTouchPanCell(cellEl, slot, imageIndex) {
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      if (swapPickSlot !== null) return;

      suppressPointerUntil = Date.now() + 400;
      e.preventDefault();

      const t = e.touches[0];
      startPan(slot, imageIndex, t.clientX, t.clientY);

      const onTouchMove = (ev) => {
        if (!panDrag || panDrag.slot !== slot) return;
        ev.preventDefault();
        const touch = ev.touches[0];
        if (touch) movePan(touch.clientX, touch.clientY);
      };

      const onTouchEnd = (ev) => {
        if (!panDrag || panDrag.slot !== slot) return;
        ev.preventDefault();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        endPan();
      };

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { passive: false });
      document.addEventListener('touchcancel', onTouchEnd, { passive: false });
    };

    cellEl.addEventListener('touchstart', onTouchStart, { passive: false });
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
      bindTouchPanCell(el, cell.slotIndex, cell.imageIndex);
    });

    renderSlotBar(geometry);
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (Date.now() < suppressPointerUntil) return;

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
      const zoom = Math.max(1, Math.min(3, pinch.startZoom * (dist / pinch.startDist)));
      const current = callbacks.getTransform(pinch.imageIndex);
      callbacks.onTransform(pinch.imageIndex, { ...current, zoom });
      callbacks.onInteractionEnd();
      return;
    }

    if (!panDrag || panDrag.pointerId !== e.pointerId) return;
    movePan(e.clientX, e.clientY);
  });

  function endPointer(e) {
    pinchPointers.delete(e.pointerId);
    if (pinchPointers.size < 2) pinch = null;

    if (!panDrag || panDrag.pointerId !== e.pointerId) return;
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
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const zoom = Math.max(1, Math.min(3, current.zoom + delta));

      callbacks.onTransform(imageIndex, { ...current, zoom });
      callbacks.onInteractionEnd();
    },
    { passive: false }
  );

  return {
    update() {
      endPan();
      renderOverlays();
    },
    cancelSwapPick() {
      setSwapPick(null);
    },
  };
}
