/**
 * Custom Quill image resize + drag-to-move module.
 * Click an image → 8 drag handles to resize (corners + midpoints).
 * Grab the image body → drag to reposition it anywhere in the editor.
 * No toolbar, no buttons — just drag like Word / Google Docs.
 */

const HANDLE_SIZE = 10;

const HANDLES = [
  { cursor: "nwse-resize", top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { cursor: "ns-resize", top: -HANDLE_SIZE / 2, left: "calc(50% - 5px)" },
  { cursor: "nesw-resize", top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  { cursor: "ew-resize", top: "calc(50% - 5px)", left: -HANDLE_SIZE / 2 },
  { cursor: "ew-resize", top: "calc(50% - 5px)", right: -HANDLE_SIZE / 2 },
  { cursor: "nesw-resize", bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { cursor: "ns-resize", bottom: -HANDLE_SIZE / 2, left: "calc(50% - 5px)" },
  { cursor: "nwse-resize", bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
] as const;

type HandleIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ImageResize(quill: any) {
  let activeImg: HTMLImageElement | null = null;
  let overlay: HTMLDivElement | null = null;

  /* ── resize state ─── */
  let resizeHandle: HandleIndex | null = null;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let naturalRatio = 1;

  /* ── drag-to-move state ─── */
  let isDragging = false;
  let dragGhost: HTMLDivElement | null = null;
  let dropIndicator: HTMLDivElement | null = null;

  const container: HTMLElement = quill.root.parentElement!;
  container.style.position = "relative";

  /* ────────────────────────────────────────────────────── */
  /*  OVERLAY                                               */
  /* ────────────────────────────────────────────────────── */

  function positionOverlay() {
    if (!activeImg || !overlay) return;
    const cr = container.getBoundingClientRect();
    const ir = activeImg.getBoundingClientRect();
    overlay.style.left = `${ir.left - cr.left + container.scrollLeft}px`;
    overlay.style.top = `${ir.top - cr.top + container.scrollTop}px`;
    overlay.style.width = `${ir.width}px`;
    overlay.style.height = `${ir.height}px`;
  }

  function showOverlay(img: HTMLImageElement) {
    hideOverlay();
    activeImg = img;
    naturalRatio = img.naturalWidth / (img.naturalHeight || 1);

    const ov = document.createElement("div");
    overlay = ov;
    ov.style.cssText =
      "position:absolute;border:2px solid #0095ff;box-sizing:border-box;" +
      "z-index:100;cursor:grab;pointer-events:auto;";

    // Grab-to-move on the overlay body
    ov.addEventListener("mousedown", onOverlayMouseDown);

    // Resize handles
    HANDLES.forEach((h, i) => {
      const el = document.createElement("div");
      el.dataset.index = String(i);
      el.style.cssText =
        `position:absolute;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;` +
        `background:#0095ff;border:1px solid #fff;border-radius:2px;` +
        `box-sizing:border-box;pointer-events:auto;cursor:${h.cursor};z-index:101;`;

      if ("top" in h) el.style.top = typeof h.top === "number" ? `${h.top}px` : h.top;
      if ("bottom" in h) el.style.bottom = typeof h.bottom === "number" ? `${h.bottom}px` : h.bottom;
      if ("left" in h) el.style.left = typeof h.left === "number" ? `${h.left}px` : h.left;
      if ("right" in h) el.style.right = typeof h.right === "number" ? `${h.right}px` : h.right;

      el.addEventListener("mousedown", onHandleMouseDown);
      ov.appendChild(el);
    });

    container.appendChild(ov);
    positionOverlay();
  }

  function hideOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    activeImg = null;
    resizeHandle = null;
    cleanupDrag();
  }

  /* ────────────────────────────────────────────────────── */
  /*  RESIZE  (drag a handle)                               */
  /* ────────────────────────────────────────────────────── */

  function onHandleMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!activeImg) return;

    resizeHandle = Number((e.target as HTMLDivElement).dataset.index) as HandleIndex;
    startX = e.clientX;
    startY = e.clientY;
    startW = activeImg.getBoundingClientRect().width;
    startH = activeImg.getBoundingClientRect().height;

    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeUp);
  }

  function onResizeMove(e: MouseEvent) {
    if (resizeHandle === null || !activeImg) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newW = startW;
    let newH = startH;

    switch (resizeHandle) {
      case 0: newW = Math.max(50, startW - dx); newH = newW / naturalRatio; break;
      case 1: newH = Math.max(30, startH - dy); newW = newH * naturalRatio; break;
      case 2: newW = Math.max(50, startW + dx); newH = newW / naturalRatio; break;
      case 3: newW = Math.max(50, startW - dx); newH = newW / naturalRatio; break;
      case 4: newW = Math.max(50, startW + dx); newH = newW / naturalRatio; break;
      case 5: newW = Math.max(50, startW - dx); newH = newW / naturalRatio; break;
      case 6: newH = Math.max(30, startH + dy); newW = newH * naturalRatio; break;
      case 7: newW = Math.max(50, startW + dx); newH = newW / naturalRatio; break;
    }

    activeImg.style.width = `${Math.round(newW)}px`;
    activeImg.style.height = `${Math.round(newH)}px`;
    activeImg.setAttribute("width", String(Math.round(newW)));
    activeImg.setAttribute("height", String(Math.round(newH)));
    positionOverlay();
  }

  function onResizeUp() {
    resizeHandle = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeUp);
  }

  /* ────────────────────────────────────────────────────── */
  /*  DRAG-TO-MOVE  (grab the image body)                   */
  /* ────────────────────────────────────────────────────── */

  function onOverlayMouseDown(e: MouseEvent) {
    // Ignore if click was on a resize handle
    if ((e.target as HTMLElement).dataset.index !== undefined) return;
    if (!activeImg) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Small semi-transparent ghost following cursor
    const imgRect = activeImg.getBoundingClientRect();
    const ghostW = Math.min(imgRect.width, 120);
    const ghostH = Math.min(imgRect.height, 120);
    dragGhost = document.createElement("div");
    dragGhost.style.cssText =
      `position:fixed;pointer-events:none;z-index:10000;opacity:0.45;` +
      `width:${ghostW}px;height:${ghostH}px;border:2px solid #0095ff;border-radius:4px;` +
      `background-size:contain;background-repeat:no-repeat;background-position:center;` +
      `left:${e.clientX - ghostW / 2}px;top:${e.clientY - ghostH / 2}px;`;
    dragGhost.style.backgroundImage = `url("${activeImg.src.replace(/"/g, "")}")`;
    document.body.appendChild(dragGhost);

    // Blue caret drop-indicator
    dropIndicator = document.createElement("div");
    dropIndicator.style.cssText =
      "position:absolute;width:2px;background:#0095ff;z-index:10000;" +
      "pointer-events:none;display:none;border-radius:1px;";
    container.appendChild(dropIndicator);

    if (overlay) overlay.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragUp);
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging || !dragGhost) return;
    e.preventDefault();

    const ghostW = dragGhost.offsetWidth;
    const ghostH = dragGhost.offsetHeight;
    dragGhost.style.left = `${e.clientX - ghostW / 2}px`;
    dragGhost.style.top = `${e.clientY - ghostH / 2}px`;

    updateDropIndicator(e.clientX, e.clientY);
  }

  function updateDropIndicator(x: number, y: number) {
    if (!dropIndicator) return;
    const range = document.caretRangeFromPoint(x, y);
    if (!range || !quill.root.contains(range.startContainer)) {
      dropIndicator.style.display = "none";
      return;
    }
    // Get a rect for the caret position
    const tempRange = document.createRange();
    tempRange.setStart(range.startContainer, range.startOffset);
    tempRange.collapse(true);
    const rect = tempRange.getBoundingClientRect();
    const cr = container.getBoundingClientRect();

    const lineH = Math.max(rect.height, 20);
    dropIndicator.style.display = "block";
    dropIndicator.style.left = `${rect.left - cr.left + container.scrollLeft}px`;
    dropIndicator.style.top = `${rect.top - cr.top + container.scrollTop}px`;
    dropIndicator.style.height = `${lineH}px`;
  }

  function onDragUp(e: MouseEvent) {
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragUp);
    document.body.style.cursor = "";

    if (!isDragging || !activeImg) { cleanupDrag(); return; }

    // Only move if user actually dragged (not just clicked)
    const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    if (dist < 8) { cleanupDrag(); return; }

    // Find drop position via caretRangeFromPoint
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || !quill.root.contains(range.startContainer)) {
      cleanupDrag();
      return;
    }

    // Save image attributes before removing
    const imgSrc = activeImg.src;
    const imgWidth = activeImg.getAttribute("width");
    const imgHeight = activeImg.getAttribute("height");
    const imgStyle = activeImg.getAttribute("style");

    try {
      // Find the Quill blot for the active image
      const Parchment = quill.constructor.import("parchment");
      const blot = Parchment.find(activeImg);
      if (!blot) { cleanupDrag(); return; }
      const oldIndex: number = quill.getIndex(blot);

      // Place DOM selection at drop point, then read Quill index
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      quill.update("user");
      const dropSel = quill.getSelection(true);
      if (!dropSel) { cleanupDrag(); return; }
      let dropIndex: number = dropSel.index;

      // Nothing to do if dropping at same spot
      if (dropIndex === oldIndex || dropIndex === oldIndex + 1) {
        cleanupDrag();
        showOverlay(activeImg);
        return;
      }

      // Remove old, adjust index, insert new
      quill.deleteText(oldIndex, 1, "user");
      if (dropIndex > oldIndex) dropIndex--;
      quill.insertEmbed(dropIndex, "image", imgSrc, "user");

      // Re-apply saved dimensions via Quill's format system
      if (imgWidth) quill.formatText(dropIndex, 1, "width", imgWidth, "silent");
      if (imgHeight) quill.formatText(dropIndex, 1, "height", imgHeight, "silent");
      if (imgStyle) quill.formatText(dropIndex, 1, "style", imgStyle, "silent");

      // Re-select the moved image
      cleanupDrag();
      setTimeout(() => {
        const [leaf] = quill.getLeaf(dropIndex);
        const node = leaf?.domNode ?? leaf?.parent?.domNode;
        if (node && node.tagName === "IMG") {
          showOverlay(node as HTMLImageElement);
        } else {
          // Fallback: find the image by src near the drop position
          const imgs = quill.root.querySelectorAll("img");
          for (const img of imgs) {
            if ((img as HTMLImageElement).src === imgSrc) {
              showOverlay(img as HTMLImageElement);
              break;
            }
          }
        }
      }, 60);
      return;
    } catch (err) {
      console.warn("Image drag-move failed:", err);
    }

    cleanupDrag();
  }

  function cleanupDrag() {
    isDragging = false;
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    if (dropIndicator) { dropIndicator.remove(); dropIndicator = null; }
    if (overlay) overlay.style.cursor = "grab";
    document.body.style.cursor = "";
  }

  /* ────────────────────────────────────────────────────── */
  /*  EVENT LISTENERS                                       */
  /* ────────────────────────────────────────────────────── */

  // Click on image → show overlay
  quill.root.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      showOverlay(target as HTMLImageElement);
    } else if (!overlay?.contains(target as Node)) {
      hideOverlay();
    }
  });

  // Reposition overlay on content changes
  quill.on("text-change", () => {
    if (activeImg) positionOverlay();
  });

  // Click outside editor → hide
  document.addEventListener("mousedown", (e: MouseEvent) => {
    if (overlay && !container.contains(e.target as Node)) {
      hideOverlay();
    }
  });

  // Reposition on scroll
  quill.root.addEventListener("scroll", () => {
    if (activeImg) positionOverlay();
  });
}
