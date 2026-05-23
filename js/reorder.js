/**
 * Touch- und mausfreundliches Umsortieren per Ziehen am Griff.
 * @param {HTMLElement} container
 * @param {{ onReorder: (fromIndex: number, toIndex: number) => void }} callbacks
 */
export function enableImageReorder(container, { onReorder }) {
  /** @type {{ fromIndex: number, thumb: HTMLElement, pointerId: number, ghost: HTMLElement, toIndex?: number } | null} */
  let drag = null;

  function clearDropHints() {
    container.querySelectorAll('.thumb--over').forEach((el) => {
      el.classList.remove('thumb--over');
    });
  }

  function endDrag() {
    if (!drag) return;
    drag.thumb.classList.remove('thumb--dragging');
    drag.ghost.remove();
    clearDropHints();
    drag = null;
  }

  function moveGhost(clientX, clientY) {
    if (!drag) return;
    const size = 72;
    drag.ghost.style.left = `${clientX - size / 2}px`;
    drag.ghost.style.top = `${clientY - size / 2}px`;
  }

  function indexFromThumb(thumb) {
    if (!thumb?.dataset.index) return -1;
    return Number(thumb.dataset.index);
  }

  function findDropTarget(clientX, clientY) {
    if (!drag) return null;
    drag.ghost.hidden = true;
    const el = document.elementFromPoint(clientX, clientY);
    drag.ghost.hidden = false;
    const thumb = el?.closest?.('.thumb');
    if (!thumb || !container.contains(thumb) || thumb === drag.thumb) {
      return null;
    }
    return thumb;
  }

  container.addEventListener('pointerdown', (e) => {
    const handle = /** @type {HTMLElement} */ (e.target).closest('.drag-handle');
    if (!handle || !container.contains(handle)) return;

    const thumb = handle.closest('.thumb');
    if (!thumb) return;

    const fromIndex = indexFromThumb(/** @type {HTMLElement} */ (thumb));
    if (fromIndex < 0) return;

    e.preventDefault();
    handle.setPointerCapture(e.pointerId);

    const ghost = /** @type {HTMLElement} */ (thumb.cloneNode(true));
    ghost.classList.remove('thumb--dragging');
    ghost.classList.add('thumb--ghost');
    ghost.removeAttribute('data-index');
    ghost.querySelector('.drag-handle')?.remove();
    document.body.appendChild(ghost);

    thumb.classList.add('thumb--dragging');
    drag = { fromIndex, thumb: /** @type {HTMLElement} */ (thumb), pointerId: e.pointerId, ghost };
    moveGhost(e.clientX, e.clientY);
  });

  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;

    moveGhost(e.clientX, e.clientY);
    clearDropHints();

    const target = findDropTarget(e.clientX, e.clientY);
    if (target) {
      target.classList.add('thumb--over');
      drag.toIndex = indexFromThumb(target);
    } else {
      drag.toIndex = undefined;
    }
  });

  container.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const { fromIndex, toIndex } = drag;
    endDrag();

    if (toIndex !== undefined && toIndex >= 0 && toIndex !== fromIndex) {
      onReorder(fromIndex, toIndex);
    }
  });

  container.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag();
  });

  container.addEventListener('dragstart', (e) => {
    const thumb = /** @type {HTMLElement} */ (e.target).closest('.thumb');
    if (!thumb || !container.contains(thumb)) return;
    if (/** @type {HTMLElement} */ (e.target).closest('.remove')) {
      e.preventDefault();
      return;
    }

    const index = indexFromThumb(thumb);
    if (index < 0) return;

    e.dataTransfer?.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    thumb.classList.add('thumb--dragging');
  });

  container.addEventListener('dragend', (e) => {
    const thumb = /** @type {HTMLElement} */ (e.target).closest('.thumb');
    thumb?.classList.remove('thumb--dragging');
    clearDropHints();
  });

  container.addEventListener('dragover', (e) => {
    const thumb = /** @type {HTMLElement} */ (e.target).closest('.thumb');
    if (!thumb || !container.contains(thumb)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropHints();
    thumb.classList.add('thumb--over');
  });

  container.addEventListener('dragleave', (e) => {
    const thumb = /** @type {HTMLElement} */ (e.target).closest('.thumb');
    thumb?.classList.remove('thumb--over');
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = /** @type {HTMLElement} */ (e.target).closest('.thumb');
    if (!target) return;

    const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
    const toIndex = indexFromThumb(target);
    clearDropHints();
    target.classList.remove('thumb--over');

    if (!Number.isNaN(fromIndex) && toIndex >= 0 && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  });
}
