/**
 * YMPRESSME — gang-sheet-builder.js
 * Interactive canvas-based gang sheet builder.
 *
 * How it works:
 *  - User selects sheet size (13x19, 22x24, 22x36)
 *  - User selects a transfer size to place (4x4, 8x8, 11x15, etc.)
 *  - Click on the canvas to place a design at that position
 *  - Designs can be dragged to reposition
 *  - Right panel shows placed items, fill %, and total price
 *  - "Add to Quote" populates the quote form below
 *
 * Scale: CANVAS_SCALE px per inch (default 18)
 */

(function () {
  'use strict';

  /* ---- Constants ---- */
  const CANVAS_SCALE = 18; // pixels per inch
  const COLORS = {
    sheet:    '#f0f6ff',
    grid:     'rgba(0,123,255,0.06)',
    border:   '#007bff',
    design:   'rgba(0,123,255,0.18)',
    designBorder: '#007bff',
    selected: 'rgba(255,105,180,0.22)',
    selectedBorder: '#ff69b4',
    text:     '#0056b3',
    handle:   '#ff69b4',
    overlap:  'rgba(220,53,69,0.20)',
  };

  /* ---- Sheet definitions (inches) ----
     22"-wide standard DTF sheets, matching gangify.app's sizing.
     Prices here are starting suggestions — adjust to YMPRESSME's actual rates.
  ---- */
  const SHEETS = {
    '22x12':  { w: 22, h: 12,  label: '22" × 12"',  price: 14.00 },
    '22x24':  { w: 22, h: 24,  label: '22" × 24"',  price: 20.00 },
    '22x36':  { w: 22, h: 36,  label: '22" × 36"',  price: 28.00 },
    '22x48':  { w: 22, h: 48,  label: '22" × 48"',  price: 36.00 },
    '22x60':  { w: 22, h: 60,  label: '22" × 60"',  price: 44.00 },
    '22x96':  { w: 22, h: 96,  label: '22" × 96"',  price: 64.00 },
    '22x120': { w: 22, h: 120, label: '22" × 120"', price: 78.00 },
  };

  /* Default starting width when a design is auto-placed on the canvas (inches). */
  const DEFAULT_DROP_WIDTH_IN = 6;
  /* Safety margin (inches), shown as dashed inset on the sheet when the toggle is on. */
  const SAFETY_MARGIN_IN = 0.25;

  /* ---- State ---- */
  let currentSheet   = '22x24'; // gangify-style default
  let showMargins    = false;   // 0.25" safety margin overlay toggle
  let bgColor        = null;    // null = transparent; otherwise CSS color string
  let designs        = [];  // { id, key, x, y, w, h, label, uploadId }
  let nextId         = 1;
  let selectedId     = null;
  let dragging       = false;
  let dragOffX       = 0;
  let dragOffY       = 0;
  let resizing       = false;
  let resizeHandle   = null;  // 'tl' | 'tr' | 'bl' | 'br'
  let resizeAnchorX  = 0;     // sheet-space x of the corner OPPOSITE the drag handle
  let resizeAnchorY  = 0;
  const HANDLE_PX    = 10;    // hit radius for corner handles, in screen pixels
  const MIN_DIM_IN   = 0.5;   // minimum design dimension in inches

  /* ---- Upload tray state ---- */
  let uploads        = [];  // { id, file, dataUrl, image, name, naturalW, naturalH }
  let nextUploadId   = 1;
  let activeUploadId = null;

  /* ---- DOM refs ---- */
  let canvas, ctx;

  /* ---- Helpers ---- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- Initialization ---- */
  window.initGangSheetBuilder = function () {
    canvas = document.getElementById('gangSheetCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    setupCanvas();
    bindSheetButtons();
    bindTransferButtons();
    bindCanvasEvents();
    bindToolbarButtons();
    bindUploadTray();
    renderUploadTray();
    render();
  };

  /* ---- Expose builder uploads for the order form ---- */
  window.getBuilderUploads = function () {
    // Only return uploads that the customer actually placed on the sheet
    return uploads
      .filter(function (u) {
        return designs.some(function (d) { return d.uploadId === u.id; });
      })
      .map(function (u) { return u.file; });
  };

  window.clearBuilderUploads = function () {
    uploads = [];
    activeUploadId = null;
    designs = [];
    selectedId = null;
    renderUploadTray();
    render();
    updateSidebar();
    updateHint();
  };

  /* ---- Canvas sizing ---- */
  function setupCanvas() {
    const sheet  = SHEETS[currentSheet];
    const maxW   = Math.min(window.innerWidth - 80, 700);
    const scale  = Math.min(CANVAS_SCALE, (maxW - 4) / sheet.w);

    canvas.width  = Math.floor(sheet.w * scale);
    canvas.height = Math.floor(sheet.h * scale);
    canvas._scale = scale;

    // Store scale on canvas for coord transforms
    canvas.dataset.scale = scale;
  }

  function getScale() { return parseFloat(canvas.dataset.scale) || CANVAS_SCALE; }

  /* ---- Sheet buttons ---- */
  function bindSheetButtons() {
    document.querySelectorAll('.sheet-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sheet-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentSheet = this.dataset.sheet;
        // Preserve placed designs; re-measure text designs at the new canvas
        // scale so their AABBs remain pixel-accurate after the scale changes.
        selectedId = null;
        setupCanvas();
        remeasureAllTextDesigns();
        render();
        updateSidebar();
        renderUploadTray(); // refresh usage badges
      });
    });
  }

  /* ---- Transfer size buttons ---- */
  function bindTransferButtons() {
    document.querySelectorAll('.transfer-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.transfer-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentSizeKey = this.dataset.size;
      });
    });
  }

  /* ---- Canvas mouse / touch events ---- */
  function bindCanvasEvents() {
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const t = e.touches[0];
      onMouseDown({ clientX: t.clientX, clientY: t.clientY, target: canvas });
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      const t = e.touches[0];
      onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      onMouseUp();
    }, { passive: false });
  }

  function canvasCoords(e) {
    const rect  = canvas.getBoundingClientRect();
    const scale = getScale();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top)  / scale,
    };
  }

  function hitTest(pos) {
    // Search in reverse (top design first)
    for (let i = designs.length - 1; i >= 0; i--) {
      const d = designs[i];
      if (pos.x >= d.x && pos.x <= d.x + d.w &&
          pos.y >= d.y && pos.y <= d.y + d.h) {
        return d;
      }
    }
    return null;
  }

  /* Return which corner handle (if any) is under `pos` for the selected design.
     `pos` is in sheet inches; we compare against a screen-pixel radius. */
  function hitTestHandle(pos) {
    if (selectedId === null) return null;
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return null;
    const scale = getScale();
    const radius = HANDLE_PX / scale; // convert px to inches
    const corners = [
      { name: 'tl', x: d.x,       y: d.y       },
      { name: 'tr', x: d.x + d.w, y: d.y       },
      { name: 'bl', x: d.x,       y: d.y + d.h },
      { name: 'br', x: d.x + d.w, y: d.y + d.h },
    ];
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const dx = pos.x - c.x;
      const dy = pos.y - c.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) return c.name;
    }
    return null;
  }

  function onMouseDown(e) {
    const pos = canvasCoords(e);

    // Resize takes priority over drag/place — check corner handles first
    const handle = hitTestHandle(pos);
    if (handle) {
      const d = designs.find(function (d) { return d.id === selectedId; });
      if (d) {
        resizing = true;
        resizeHandle = handle;
        // Opposite corner is the fixed anchor while resizing
        resizeAnchorX = (handle === 'tl' || handle === 'bl') ? (d.x + d.w) : d.x;
        resizeAnchorY = (handle === 'tl' || handle === 'tr') ? (d.y + d.h) : d.y;
        render();
        return;
      }
    }

    const hit = hitTest(pos);
    if (hit) {
      selectedId = hit.id;
      dragging   = true;
      dragOffX   = pos.x - hit.x;
      dragOffY   = pos.y - hit.y;
    } else {
      // Place new design
      selectedId = null;
      placeDesign(pos.x, pos.y);
    }
    render();
  }

  function onMouseMove(e) {
    if (selectedId === null) return;
    const pos   = canvasCoords(e);
    const d     = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    const sheet = SHEETS[currentSheet];

    if (resizing) {
      // Resize keeping aspect ratio (relative to anchor corner)
      const aspect = (d.aspect && d.aspect > 0)
        ? d.aspect
        : (d.w / Math.max(d.h, 0.0001));

      // Distance from anchor in each axis (signed, but we use abs for sizing)
      let newW = Math.abs(pos.x - resizeAnchorX);
      let newH = Math.abs(pos.y - resizeAnchorY);

      // Lock to aspect ratio — use the larger drag axis as the driver
      if (newW / aspect >= newH) {
        newH = newW / aspect;
      } else {
        newW = newH * aspect;
      }

      // Enforce minimums
      newW = Math.max(MIN_DIM_IN, newW);
      newH = Math.max(MIN_DIM_IN / aspect, newH);

      // Determine top-left from anchor + handle direction
      const newX = (resizeHandle === 'tr' || resizeHandle === 'br')
        ? resizeAnchorX
        : resizeAnchorX - newW;
      const newY = (resizeHandle === 'bl' || resizeHandle === 'br')
        ? resizeAnchorY
        : resizeAnchorY - newH;

      // Clamp to sheet (shrink design if it would overflow)
      let clampedX = Math.max(0, newX);
      let clampedY = Math.max(0, newY);
      let clampedW = newW - (clampedX - newX);
      let clampedH = newH - (clampedY - newY);
      // Right/bottom overflow
      if (clampedX + clampedW > sheet.w) clampedW = sheet.w - clampedX;
      if (clampedY + clampedH > sheet.h) clampedH = sheet.h - clampedY;
      // Re-enforce aspect after clamping (use the smaller axis as the binding one)
      if (clampedW / aspect < clampedH) {
        clampedH = clampedW / aspect;
      } else {
        clampedW = clampedH * aspect;
      }

      d.x = clampedX;
      d.y = clampedY;
      d.w = clampedW;
      d.h = clampedH;
      d.label = d.w.toFixed(1) + '" × ' + d.h.toFixed(1) + '"';
      render();
      updateSidebar();
      return;
    }

    if (dragging) {
      d.x = Math.max(0, Math.min(pos.x - dragOffX, sheet.w - d.w));
      d.y = Math.max(0, Math.min(pos.y - dragOffY, sheet.h - d.h));
      render();
    }
  }

  function onMouseUp() {
    dragging = false;
    resizing = false;
    resizeHandle = null;
  }

  /* ---- Auto-place a design on the canvas when its upload finishes ----
     Gangify-style: as soon as an image upload completes, drop it onto the
     sheet at a sensible default size and find a non-overlapping spot.
  ---- */
  function autoPlaceDesign(upload) {
    if (!upload || !upload.image) return;
    const sheet = SHEETS[currentSheet];

    let aspect = upload.naturalW / upload.naturalH;
    if (!isFinite(aspect) || aspect <= 0) aspect = 1;

    // Start at the default drop width, clamped to fit the sheet.
    let w = Math.min(DEFAULT_DROP_WIDTH_IN, sheet.w);
    let h = w / aspect;
    if (h > sheet.h) {
      h = sheet.h;
      w = h * aspect;
    }

    // Find an empty spot: try simple row-major positions every 0.5", first
    // non-overlapping placement wins. If we can't find one, just stack at (0,0).
    const STEP = 0.5;
    let placedX = 0, placedY = 0, found = false;
    for (let yy = 0; yy + h <= sheet.h && !found; yy += STEP) {
      for (let xx = 0; xx + w <= sheet.w && !found; xx += STEP) {
        const overlaps = designs.some(function (d) {
          return !(xx + w <= d.x || xx >= d.x + d.w ||
                   yy + h <= d.y || yy >= d.y + d.h);
        });
        if (!overlaps) { placedX = xx; placedY = yy; found = true; }
      }
    }

    const design = {
      id:       nextId++,
      x:        placedX,
      y:        placedY,
      w:        w,
      h:        h,
      aspect:   aspect,
      rotation: 0,                                       // degrees, 90° increments
      label:    w.toFixed(1) + '" × ' + h.toFixed(1) + '"',
      uploadId: upload.id,
    };
    designs.push(design);
    selectedId = design.id;
    render();
    updateSidebar();
    updateHint();
    renderUploadTray();
  }

  /* Kept for back-compat with the canvas-click path. With gangify-style
     auto-placement, customers rarely need this — but a click on empty
     canvas while a design is "active" still places one. */
  function placeDesign(cx, cy) {
    const upload = activeUploadId != null
      ? uploads.find(function (u) { return u.id === activeUploadId; })
      : null;
    if (!upload || !upload.image) {
      window.showToast && window.showToast(
        'Upload a design first — it\'ll drop onto the sheet automatically.',
        'info'
      );
      return;
    }
    // Drop at the click point at the default size
    autoPlaceDesign(upload);
    // Move the just-placed design to be centered on the click
    const d = designs[designs.length - 1];
    if (!d) return;
    const sheet = SHEETS[currentSheet];
    d.x = Math.max(0, Math.min(cx - d.w / 2, sheet.w - d.w));
    d.y = Math.max(0, Math.min(cy - d.h / 2, sheet.h - d.h));
    render();
  }

  /* ---- Remove a design ---- */
  window.removeDesign = function (id) {
    designs = designs.filter(function (d) { return d.id !== id; });
    if (selectedId === id) selectedId = null;
    render();
    updateSidebar();
    updateHint();
    renderUploadTray();
  };

  /* ---- Rotate the currently-selected design by 90° clockwise.
     For arbitrary rotations use window.setRotation(deg). ---- */
  window.rotateSelected = function () {
    if (selectedId === null) {
      window.showToast && window.showToast('Click a design on the canvas first.', 'info');
      return;
    }
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    d.rotation = ((d.rotation || 0) + 90) % 360;
    render();
    updateSidebar();
  };

  /* ---- Apply custom dimensions to the selected design ---- */
  window.applyCustomSize = function (newW, newH) {
    if (selectedId === null) return;
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    const sheet = SHEETS[currentSheet];
    let w = parseFloat(newW), h = parseFloat(newH);
    if (!isFinite(w) || w < MIN_DIM_IN) w = d.w;
    if (!isFinite(h) || h < MIN_DIM_IN) h = d.h;
    // Clamp to sheet
    w = Math.min(w, sheet.w - d.x);
    h = Math.min(h, sheet.h - d.y);
    d.w = w; d.h = h;
    d.aspect = d.w / d.h;
    d.label = d.w.toFixed(1) + '" × ' + d.h.toFixed(1) + '"';
    render();
    updateSidebar();
  };

  /* ---- Toggle the 0.25" safety-margin overlay ---- */
  window.toggleSheetMargins = function (on) {
    showMargins = !!on;
    render();
  };

  /* ---- Auto-arrange placed designs ---- (simple shelf bin-packing) */
  window.autoArrangeDesigns = function () {
    if (designs.length === 0) return;
    const sheet = SHEETS[currentSheet];
    const GAP = 0.25; // 1/4" gap between designs

    // Sort by height descending (shelf packing heuristic — keeps rows compact)
    const sorted = designs.slice().sort(function (a, b) { return b.h - a.h; });

    let rowX = 0, rowY = 0, rowH = 0;
    sorted.forEach(function (d) {
      // Wrap to next row if this design won't fit in the current row
      if (rowX + d.w > sheet.w) {
        rowX = 0;
        rowY += rowH + GAP;
        rowH = 0;
      }
      // If we ran out of sheet height entirely, just leave it where it was
      if (rowY + d.h > sheet.h) return;
      d.x = rowX;
      d.y = rowY;
      rowX += d.w + GAP;
      if (d.h > rowH) rowH = d.h;
    });
    render();
    updateSidebar();
  };

  /* ---- Read back the currently-selected design (so the UI can populate W/H inputs) ---- */
  window.getSelectedDesign = function () {
    if (selectedId === null) return null;
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return null;
    // Reverse-lookup font id from the css string (best effort)
    let fontId = 'arial';
    if (d.fontFamily) {
      const match = TEXT_FONTS.find(function (f) { return f.css === d.fontFamily; });
      if (match) fontId = match.id;
    }
    return {
      id: d.id,
      type: d.type || 'image',
      x: d.x, y: d.y,
      w: d.w, h: d.h,
      rotation: d.rotation || 0,
      text: d.text || '',
      fontSize: d.fontSize || 1.5,
      sizePx: Math.round((d.fontSize || 1.5) * 72),
      color: d.color || '#000000',
      font: fontId,
      bold: (d.fontWeight || 400) >= 600,
      italic: d.fontStyle === 'italic',
    };
  };

  /* ---- Helper: trigger a file download from a data URL ---- */
  function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 100);
  }

  /* Measure text using the EXACT font size the canvas will render with.
     This eliminates the proportional-scaling error you get from measuring
     at a fixed reference size — font hinting makes glyph dimensions vary
     non-linearly with size, so we have to measure at the size we'll draw.

     Returns tight visible glyph bounds in inches at the current canvas scale.
     If the canvas scale later changes (sheet size change), call this again. */
  function measureTextInches(text, fontSizeIn, fontFamily, fontWeight, fontStyle) {
    const pxPerIn = (canvas && parseFloat(canvas.dataset.scale)) || 96;
    const c = document.createElement('canvas');
    const cx = c.getContext('2d');
    const fontPx = fontSizeIn * pxPerIn;
    cx.font = (fontStyle === 'italic' ? 'italic ' : '')
            + (fontWeight || 700) + ' '
            + fontPx + 'px '
            + (fontFamily || 'sans-serif');
    cx.textBaseline = 'alphabetic';
    cx.textAlign    = 'left';
    const m = cx.measureText(text || '');

    const bbLeftPx  = (typeof m.actualBoundingBoxLeft   === 'number') ? m.actualBoundingBoxLeft   : 0;
    const bbRightPx = (typeof m.actualBoundingBoxRight  === 'number') ? m.actualBoundingBoxRight  : m.width;
    const ascentPx  = (typeof m.actualBoundingBoxAscent  === 'number') ? m.actualBoundingBoxAscent  : (fontPx * 0.75);
    const descentPx = (typeof m.actualBoundingBoxDescent === 'number') ? m.actualBoundingBoxDescent : (fontPx * 0.20);
    const wPx = bbLeftPx + bbRightPx;
    const hPx = ascentPx + descentPx;
    return {
      w:      wPx       / pxPerIn,
      h:      hPx       / pxPerIn,
      ascent: ascentPx  / pxPerIn,
      bbLeft: bbLeftPx  / pxPerIn,
    };
  }

  /* Re-measure all text designs after the canvas scale changes (sheet size
     change). The stored w/h/ascent/bbLeft are scale-dependent because font
     hinting doesn't scale linearly, so we recompute them at the new size. */
  function remeasureAllTextDesigns() {
    designs.forEach(function (d) {
      if (d.type !== 'text') return;
      const dims = measureTextInches(d.text, d.fontSize, d.fontFamily, d.fontWeight, d.fontStyle);
      d.w = dims.w;
      d.h = dims.h;
      d.ascent = dims.ascent;
      d.bbLeft = dims.bbLeft || 0;
      d.aspect = d.w / d.h;
    });
  }

  /* Available fonts (matching gangify) */
  const TEXT_FONTS = [
    { id: 'arial',       css: 'Arial, sans-serif',                label: 'Arial' },
    { id: 'georgia',     css: 'Georgia, serif',                   label: 'Georgia' },
    { id: 'impact',      css: 'Impact, Haettenschweiler, sans-serif', label: 'Impact' },
    { id: 'courier',     css: '"Courier New", Courier, monospace', label: 'Courier New' },
    { id: 'trebuchet',   css: '"Trebuchet MS", sans-serif',       label: 'Trebuchet MS' },
    { id: 'palatino',    css: '"Palatino Linotype", Palatino, serif', label: 'Palatino' },
    { id: 'verdana',     css: 'Verdana, Geneva, sans-serif',      label: 'Verdana' },
    { id: 'comicsans',   css: '"Comic Sans MS", cursive',         label: 'Comic Sans' },
    { id: 'montserrat',  css: 'Montserrat, Arial, sans-serif',    label: 'Montserrat' },
    { id: 'times',       css: '"Times New Roman", Times, serif',  label: 'Times' },
  ];
  window.GSB_TEXT_FONTS = TEXT_FONTS;

  /* ---- Add a text design to the canvas ----
     `config` is either:
       - a string (legacy), in which case defaults are used, OR
       - an object: { text, font, sizePx, color, bold, italic }
  ---- */
  window.addText = function (config) {
    let text, fontFamily, fontWeight, fontStyle, sizeIn, color;
    if (typeof config === 'string' || config == null) {
      text = (config == null ? 'YOUR TEXT' : String(config)).slice(0, 200);
      fontFamily = TEXT_FONTS[0].css;
      fontWeight = 700;
      fontStyle = 'normal';
      sizeIn = 1.5;
      color = '#000000';
    } else {
      text       = String(config.text || 'YOUR TEXT').slice(0, 200);
      fontFamily = (config.font && TEXT_FONTS.find(f => f.id === config.font) || TEXT_FONTS[0]).css;
      fontWeight = config.bold ? 800 : 400;
      fontStyle  = config.italic ? 'italic' : 'normal';
      // size comes in as pixels (gangify-style); convert to inches at 72 px/in (typesetting reference)
      sizeIn = (typeof config.sizePx === 'number' ? config.sizePx : 72) / 72;
      color  = config.color || '#000000';
    }
    const sheet = SHEETS[currentSheet];

    const dims = measureTextInches(text, sizeIn, fontFamily, fontWeight, fontStyle);
    let w = Math.min(dims.w, sheet.w);
    let h = Math.min(dims.h, sheet.h);
    let ascent = dims.ascent;
    let bbLeft = dims.bbLeft || 0;

    // Find empty spot (row-major)
    const STEP = 0.5;
    let placedX = 0, placedY = 0, found = false;
    for (let yy = 0; yy + h <= sheet.h && !found; yy += STEP) {
      for (let xx = 0; xx + w <= sheet.w && !found; xx += STEP) {
        const overlaps = designs.some(function (d) {
          return !(xx + w <= d.x || xx >= d.x + d.w ||
                   yy + h <= d.y || yy >= d.y + d.h);
        });
        if (!overlaps) { placedX = xx; placedY = yy; found = true; }
      }
    }

    const design = {
      id:         nextId++,
      type:       'text',
      x:          placedX,
      y:          placedY,
      w:          w,
      h:          h,
      aspect:     w / h,
      rotation:   0,
      text:       text,
      fontFamily: fontFamily,
      fontWeight: fontWeight,
      fontStyle:  fontStyle,
      fontSize:   sizeIn,
      ascent:     ascent,   // inches — vertical offset from AABB top to text baseline
      bbLeft:     bbLeft,   // inches — horizontal offset to align glyphs to AABB left
      color:      color,
      label:      text.length > 16 ? (text.slice(0, 16) + '…') : text,
      uploadId:   null,
    };
    designs.push(design);
    selectedId = design.id;
    render();
    updateSidebar();
    updateHint();
  };

  /* ---- Update text-specific properties on the selected text design ---- */
  window.applyTextProps = function (props) {
    if (selectedId === null) return;
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d || d.type !== 'text') return;
    if (!props) return;

    if (typeof props.text === 'string' && props.text.length > 0) {
      d.text = props.text.slice(0, 200);
    }
    if (typeof props.sizePx === 'number' && props.sizePx > 0) {
      d.fontSize = Math.min(20, Math.max(0.25, props.sizePx / 72));
    } else if (typeof props.fontSize === 'number' && props.fontSize > 0) {
      d.fontSize = Math.min(20, Math.max(0.25, props.fontSize));
    }
    if (typeof props.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(props.color)) {
      d.color = props.color;
    }
    if (typeof props.font === 'string') {
      const f = TEXT_FONTS.find(function (x) { return x.id === props.font; });
      if (f) d.fontFamily = f.css;
    }
    if (typeof props.bold === 'boolean')   d.fontWeight = props.bold ? 800 : 400;
    if (typeof props.italic === 'boolean') d.fontStyle  = props.italic ? 'italic' : 'normal';

    // Recompute size from new text/fontSize
    const dims = measureTextInches(d.text, d.fontSize, d.fontFamily, d.fontWeight, d.fontStyle);
    d.w = dims.w;
    d.h = dims.h;
    d.ascent = dims.ascent;
    d.bbLeft = dims.bbLeft || 0;
    d.aspect = d.w / d.h;
    d.label = d.text.length > 16 ? (d.text.slice(0, 16) + '…') : d.text;

    // Clamp to sheet
    const sheet = SHEETS[currentSheet];
    if (d.x + d.w > sheet.w) d.x = Math.max(0, sheet.w - d.w);
    if (d.y + d.h > sheet.h) d.y = Math.max(0, sheet.h - d.h);

    render();
    updateSidebar();
  };

  /* ---- Deselect any selected design ---- */
  window.deselectAll = function () {
    selectedId = null;
    render();
    updateSidebar();
  };

  /* ---- Trim the selected image's transparent/white edges ----
     Detects the tight bounding box of non-empty pixels and crops to it.
     For PNGs with transparency: uses alpha channel.
     For JPGs / solid-bg images: uses near-white detection. */
  window.trimSelected = function () {
    if (selectedId === null) {
      window.showToast && window.showToast('Click an image on the canvas first.', 'info');
      return;
    }
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d || d.type === 'text') {
      window.showToast && window.showToast('Trim works on images only.', 'info');
      return;
    }
    const upload = uploads.find(function (u) { return u.id === d.uploadId; });
    if (!upload || !upload.image) return;

    const img = upload.image;
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return;

    // Render to a buffer canvas at native size to read pixels
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, W, H).data;

    // Decide which "empty" mode to use: transparent if image has any alpha,
    // otherwise near-white.
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) { hasTransparency = true; break; }
    }
    const ALPHA_THRESHOLD = 20;
    const WHITE_THRESHOLD = 720; // sum < 720 = not near-white

    // Scan for tight bounding box of non-empty pixels
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) {
      const rowBase = y * W * 4;
      for (let x = 0; x < W; x++) {
        const i = rowBase + x * 4;
        const visible = hasTransparency
            ? (data[i + 3] > ALPHA_THRESHOLD)
            : ((data[i] + data[i + 1] + data[i + 2]) < WHITE_THRESHOLD);
        if (visible) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) {
      window.showToast && window.showToast('Nothing to trim — image is empty.', 'info');
      return;
    }
    if (minX === 0 && minY === 0 && maxX === W - 1 && maxY === H - 1) {
      window.showToast && window.showToast('Image is already trimmed tight.', 'info');
      return;
    }

    // Crop
    const trimmedW = maxX - minX + 1;
    const trimmedH = maxY - minY + 1;
    const tc = document.createElement('canvas');
    tc.width = trimmedW; tc.height = trimmedH;
    const tcx = tc.getContext('2d');
    tcx.drawImage(c, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);

    // Capture old image dimensions BEFORE replacing the upload — needed to
    // map each design's old box → tight visible content position+size.
    const oldImgW = upload.naturalW;
    const oldImgH = upload.naturalH;

    const newDataUrl = tc.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = function () {
      upload.image    = newImg;
      upload.dataUrl  = newDataUrl;
      upload.naturalW = trimmedW;
      upload.naturalH = trimmedH;
      const newAspect = trimmedW / trimmedH;

      // For each design using this upload: the visible content was previously
      // rendered in a sub-region of the design's bounding box. After trim,
      // the visible content fills the new (tight) box. We update each
      // design's position+size so the visible content stays exactly where
      // it was on the sheet — only the bounding box itself gets tighter.
      designs.forEach(function (d2) {
        if (d2.uploadId !== upload.id) return;
        const oldW = d2.w, oldH = d2.h;
        // Where the visible content WAS, in sheet inches:
        d2.x      = d2.x + (minX / oldImgW) * oldW;
        d2.y      = d2.y + (minY / oldImgH) * oldH;
        d2.w      = (trimmedW / oldImgW) * oldW;
        d2.h      = (trimmedH / oldImgH) * oldH;
        d2.aspect = newAspect;
        d2.label  = d2.w.toFixed(1) + '" × ' + d2.h.toFixed(1) + '"';
        const sheet = SHEETS[currentSheet];
        if (d2.x + d2.w > sheet.w) d2.x = Math.max(0, sheet.w - d2.w);
        if (d2.y + d2.h > sheet.h) d2.y = Math.max(0, sheet.h - d2.h);
      });
      render();
      updateSidebar();
      renderUploadTray();
      window.showToast && window.showToast(
        'Trimmed ' + (W - trimmedW) + '×' + (H - trimmedH) + ' pixels of empty margin.',
        'success'
      );
    };
    newImg.src = newDataUrl;
  };

  /* ---- Remove background from the selected image ----
     Flood-fill from the 4 corners — any pixel matching the background
     color (within a threshold) gets its alpha set to 0. Works well for
     designs on solid/near-solid backgrounds. Will NOT remove complex
     photographic backgrounds — that needs an AI service. */
  window.removeBgSelected = function () {
    if (selectedId === null) {
      window.showToast && window.showToast('Click an image on the canvas first.', 'info');
      return;
    }
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d || d.type === 'text') {
      window.showToast && window.showToast('Background removal works on images only.', 'info');
      return;
    }
    const upload = uploads.find(function (u) { return u.id === d.uploadId; });
    if (!upload || !upload.image) return;

    const img = upload.image;
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return;

    // Render to buffer to read+modify pixels
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const imgData = cx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // Average the 4 corner pixels — they're our background reference
    const cornerCoords = [
      [0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1],
    ];
    let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
    cornerCoords.forEach(function (c) {
      const i = (c[1] * W + c[0]) * 4;
      bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]; bgA += data[i + 3];
    });
    bgR /= 4; bgG /= 4; bgB /= 4; bgA /= 4;

    // If corners are already mostly transparent, nothing to do
    if (bgA < 40) {
      window.showToast && window.showToast('Background already appears transparent.', 'info');
      return;
    }

    // Iterative flood-fill — uses a typed-array stack to handle big images
    // without recursion or stack overflow.
    const COLOR_THRESHOLD = 36;  // tolerance for "close enough to bg"
    const visited = new Uint8Array(W * H);
    // Stack holds packed indices: y * W + x
    const stack = new Int32Array(W * H);
    let sp = 0;
    cornerCoords.forEach(function (c) {
      stack[sp++] = c[1] * W + c[0];
    });

    let pixelsRemoved = 0;
    while (sp > 0) {
      const pi = stack[--sp];
      if (visited[pi]) continue;
      visited[pi] = 1;

      const i = pi * 4;
      const dr = Math.abs(data[i]     - bgR);
      const dg = Math.abs(data[i + 1] - bgG);
      const db = Math.abs(data[i + 2] - bgB);
      if (dr > COLOR_THRESHOLD || dg > COLOR_THRESHOLD || db > COLOR_THRESHOLD) continue;

      // Match — mark transparent
      data[i + 3] = 0;
      pixelsRemoved++;

      // Push 4-neighbors
      const x = pi % W;
      const y = (pi - x) / W;
      if (x + 1 < W) stack[sp++] = pi + 1;
      if (x - 1 >= 0) stack[sp++] = pi - 1;
      if (y + 1 < H) stack[sp++] = pi + W;
      if (y - 1 >= 0) stack[sp++] = pi - W;
    }

    if (pixelsRemoved < 100) {
      window.showToast && window.showToast(
        'No clear background detected. For complex backgrounds, upload a transparent PNG.',
        'info'
      );
      return;
    }

    cx.putImageData(imgData, 0, 0);
    const newDataUrl = c.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = function () {
      upload.image   = newImg;
      upload.dataUrl = newDataUrl;
      render();
      window.showToast && window.showToast(
        'Background removed (' + pixelsRemoved.toLocaleString() + ' pixels).',
        'success'
      );
    };
    newImg.src = newDataUrl;
  };

  /* ---- Set arbitrary rotation (0-360°) on the selected design ---- */
  window.setRotation = function (deg) {
    if (selectedId === null) return;
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    let v = parseFloat(deg);
    if (!isFinite(v)) v = 0;
    // Normalize to 0-360
    v = ((v % 360) + 360) % 360;
    d.rotation = v;
    render();
    updateSidebar();
  };

  /* ---- Duplicate the selected design `count` times (default 1) ---- */
  window.duplicateSelected = function (count) {
    if (selectedId === null) {
      window.showToast && window.showToast('Click a design on the canvas first.', 'info');
      return;
    }
    const src = designs.find(function (d) { return d.id === selectedId; });
    if (!src) return;
    const sheet = SHEETS[currentSheet];
    const n = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    const OFFSET = 0.5; // shift each copy 0.5" right & down

    for (let i = 0; i < n; i++) {
      const copy = Object.assign({}, src, {
        id:       nextId++,
        x:        Math.min(src.x + OFFSET * (i + 1), sheet.w - src.w),
        y:        Math.min(src.y + OFFSET * (i + 1), sheet.h - src.h),
      });
      // ensure not negative or off-sheet
      copy.x = Math.max(0, copy.x);
      copy.y = Math.max(0, copy.y);
      designs.push(copy);
      selectedId = copy.id;
    }
    render();
    updateSidebar();
    renderUploadTray();
  };

  /* ---- Toggle the canvas background between transparent and a solid color ---- */
  window.setSheetBackground = function (color) {
    bgColor = (color === null || color === undefined || color === 'transparent') ? null : color;
    render();
  };

  /* ---- Download just the selected design at 300 DPI ---- */
  window.downloadSelected = function () {
    if (selectedId === null) {
      window.showToast && window.showToast('Click a design on the canvas first.', 'info');
      return;
    }
    const d = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    const DPI = 300;

    if (d.type === 'text') {
      // Render text-only to a 300 DPI canvas, glyphs fitting exactly
      const c = document.createElement('canvas');
      c.width  = Math.max(1, Math.round(d.w * DPI));
      c.height = Math.max(1, Math.round(d.h * DPI));
      const cx = c.getContext('2d');
      const style = d.fontStyle === 'italic' ? 'italic ' : '';
      cx.font = style + (d.fontWeight || 700) + ' ' + (d.fontSize * DPI) + 'px ' + d.fontFamily;
      cx.fillStyle = d.color;
      cx.textBaseline = 'alphabetic';
      cx.textAlign    = 'left';
      const ascentPx = (d.ascent || (d.h * 0.78)) * DPI;
      const bbLeftPx = (d.bbLeft || 0) * DPI;
      cx.fillText(d.text, bbLeftPx, ascentPx);
      triggerDownload(c.toDataURL('image/png'), 'text-design.png');
      return;
    }

    // Image: download the original upload (preserves max quality)
    const upload = uploads.find(function (u) { return u.id === d.uploadId; });
    if (upload && upload.dataUrl) {
      triggerDownload(upload.dataUrl, upload.name || ('design-' + d.id + '.png'));
    }
  };

  /* ---- Export the full sheet as a print-ready 300 DPI PNG ---- */
  window.exportSheet300DPI = function () {
    const sheet = SHEETS[currentSheet];
    const DPI = 300;
    const c = document.createElement('canvas');
    c.width  = Math.round(sheet.w * DPI);
    c.height = Math.round(sheet.h * DPI);
    const cx = c.getContext('2d');

    // Background: if a color is set, fill. Otherwise leave transparent.
    if (bgColor) {
      cx.fillStyle = bgColor;
      cx.fillRect(0, 0, c.width, c.height);
    }

    // Draw each design at 300 DPI
    designs.forEach(function (d) {
      const px = d.x * DPI;
      const py = d.y * DPI;
      const pw = d.w * DPI;
      const ph = d.h * DPI;
      const rot = d.rotation || 0;

      if (d.type === 'text') {
        cx.save();
        const style = d.fontStyle === 'italic' ? 'italic ' : '';
        cx.font = style + (d.fontWeight || 700) + ' ' + (d.fontSize * DPI) + 'px ' + d.fontFamily;
        cx.fillStyle = d.color;
        cx.textBaseline = 'alphabetic';
        cx.textAlign    = 'left';
        const ascentPx = (d.ascent || (d.h * 0.78)) * DPI;
        const bbLeftPx = (d.bbLeft || 0) * DPI;
        if (rot !== 0) {
          cx.translate(px + pw / 2, py + ph / 2);
          cx.rotate(rot * Math.PI / 180);
          cx.fillText(d.text, -pw / 2 + bbLeftPx, -ph / 2 + ascentPx);
        } else {
          cx.fillText(d.text, px + bbLeftPx, py + ascentPx);
        }
        cx.restore();
        return;
      }

      // Image design
      const upload = uploads.find(function (u) { return u.id === d.uploadId; });
      if (!upload || !upload.image) return;
      cx.save();
      if (rot !== 0) {
        cx.translate(px + pw / 2, py + ph / 2);
        cx.rotate(rot * Math.PI / 180);
        cx.drawImage(upload.image, -pw / 2, -ph / 2, pw, ph);
      } else {
        cx.drawImage(upload.image, px, py, pw, ph);
      }
      cx.restore();
    });

    const sizeLabel = sheet.label.replace(/[^0-9x]/g, '');
    triggerDownload(c.toDataURL('image/png'), 'gang-sheet-' + sizeLabel + '-300dpi.png');
  };

  /* ---- Toolbar buttons ---- */
  function bindToolbarButtons() {
    const clearBtn = document.getElementById('builderClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (designs.length === 0) return;
        if (confirm('Clear all designs from the sheet? (Uploaded files stay in your tray.)')) {
          designs = [];
          selectedId = null;
          render();
          updateSidebar();
          updateHint();
          renderUploadTray();
        }
      });
    }

    const removeSelBtn = document.getElementById('builderRemoveSelected');
    if (removeSelBtn) {
      removeSelBtn.addEventListener('click', function () {
        if (selectedId !== null) window.removeDesign(selectedId);
      });
    }

    const quoteBtn = document.getElementById('builderAddToQuote');
    if (quoteBtn) {
      quoteBtn.addEventListener('click', function () {
        if (designs.length === 0) {
          window.showToast && window.showToast('Add at least one design to the sheet first.', 'error');
          return;
        }
        buildQuoteSummary();
        const quoteSection = document.getElementById('gangSheetQuote');
        if (quoteSection) quoteSection.scrollIntoView({ behavior: 'smooth' });
        window.showToast && window.showToast('Layout ready! Fill in your details below.', 'success');
      });
    }
  }

  /* ---- Upload tray ---- */
  function bindUploadTray() {
    const dropZone = document.getElementById('designUploadZone');
    const fileInput = document.getElementById('designFileInput');
    if (!dropZone || !fileInput) return;

    // Click the dropzone to open file picker
    dropZone.addEventListener('click', function (e) {
      // ignore clicks on the file input itself (would double-trigger)
      if (e.target === fileInput) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        handleUploadedFiles(e.target.files);
        // reset so picking the same file again re-fires change
        fileInput.value = '';
      }
    });

    // Drag-drop
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });
    dropZone.addEventListener('drop', function (e) {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        handleUploadedFiles(dt.files);
      }
    });
  }

  function handleUploadedFiles(fileList) {
    const MAX = 50 * 1024 * 1024; // 50MB to match the rest of the site
    Array.from(fileList).forEach(function (file) {
      if (file.size > MAX) {
        window.showToast && window.showToast(
          '"' + file.name + '" is over 50MB and was skipped.', 'error'
        );
        return;
      }
      const isImage = /^image\//.test(file.type);
      if (!isImage) {
        // Still keep it (e.g. PDF / SVG / ZIP) but no canvas preview
        const u = {
          id: nextUploadId++,
          file: file,
          dataUrl: null,
          image: null,
          name: file.name,
          naturalW: 0, naturalH: 0,
        };
        uploads.push(u);
        if (activeUploadId === null) activeUploadId = u.id;
        renderUploadTray();
        window.showToast && window.showToast(
          '"' + file.name + '" added. (Non-image files won\'t preview on the canvas.)',
          'info'
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const u = {
            id: nextUploadId++,
            file: file,
            dataUrl: e.target.result,
            image: img,
            name: file.name,
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
          };
          uploads.push(u);
          activeUploadId = u.id;
          renderUploadTray();
          // Gangify-style: auto-place the design on the canvas immediately,
          // so the customer sees their artwork the moment it finishes uploading.
          autoPlaceDesign(u);
        };
        img.onerror = function () {
          window.showToast && window.showToast(
            'Could not read "' + file.name + '" as an image.', 'error'
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderUploadTray() {
    const grid = document.getElementById('designThumbGrid');
    const empty = document.getElementById('designThumbEmpty');
    if (!grid) return;

    if (uploads.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = uploads.map(function (u) {
      const usage = designs.filter(function (d) { return d.uploadId === u.id; }).length;
      const isActive = u.id === activeUploadId;
      const ext = (u.name.split('.').pop() || '?').toUpperCase().slice(0, 4);
      const preview = u.dataUrl
        ? '<img src="' + u.dataUrl + '" alt="' + escapeHtml(u.name) + '" draggable="false" />'
        : '<div class="dt-fallback">' + escapeHtml(ext) + '</div>';
      return (
        '<div class="design-thumb ' + (isActive ? 'active' : '') + '" data-upload-id="' + u.id + '" title="' + escapeHtml(u.name) + (isActive ? ' (active — click canvas to place)' : '') + '">' +
          preview +
          (usage > 0 ? '<span class="dt-count" aria-label="Placed ' + usage + ' times">×' + usage + '</span>' : '') +
          '<button class="dt-remove" data-upload-id="' + u.id + '" type="button" aria-label="Remove ' + escapeHtml(u.name) + '">×</button>' +
          '<span class="dt-name">' + escapeHtml(u.name) + '</span>' +
        '</div>'
      );
    }).join('');

    // Wire thumbnail clicks
    grid.querySelectorAll('.design-thumb').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.dt-remove')) return;
        const id = parseInt(el.dataset.uploadId, 10);
        activeUploadId = (activeUploadId === id) ? null : id;
        renderUploadTray();
      });
    });
    grid.querySelectorAll('.dt-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = parseInt(btn.dataset.uploadId, 10);
        removeUpload(id);
      });
    });
  }

  function removeUpload(id) {
    const inUse = designs.filter(function (d) { return d.uploadId === id; }).length;
    if (inUse > 0) {
      const ok = confirm(
        'This design is placed ' + inUse + ' time(s) on the sheet.\n\n' +
        'Remove it? All ' + inUse + ' placement(s) will be cleared.'
      );
      if (!ok) return;
    }
    uploads = uploads.filter(function (u) { return u.id !== id; });
    designs = designs.filter(function (d) { return d.uploadId !== id; });
    if (activeUploadId === id) {
      activeUploadId = uploads.length ? uploads[0].id : null;
    }
    if (selectedId !== null && !designs.some(function (d) { return d.id === selectedId; })) {
      selectedId = null;
    }
    renderUploadTray();
    render();
    updateSidebar();
    updateHint();
  }

  /* Draw the size pill below a design. Called for EVERY design (always
     visible) so the customer can see exactly how much sheet space each
     design will occupy in inches. Selected designs get a brighter pill;
     unselected designs get a faded one. */
  function drawSizePill(d, px, py, pw, ph, isSelected) {
    const sizeText = d.w.toFixed(1) + '" × ' + d.h.toFixed(1) + '"';
    const lblFont  = 11;
    ctx.save();
    ctx.font = 'bold ' + lblFont + 'px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const textW = ctx.measureText(sizeText).width;
    const padX = 8, padY = 3;
    const lblW = textW + padX * 2;
    const lblH = lblFont + padY * 2 + 2;
    const lblX = px + pw / 2 - lblW / 2;
    const lblY = py + ph + 6;

    // Selected: vivid blue. Unselected: subtle dark pill at lower opacity.
    ctx.fillStyle = isSelected ? '#1e90ff' : 'rgba(13, 27, 42, 0.78)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(lblX, lblY, lblW, lblH, 4);
      ctx.fill();
    } else {
      ctx.fillRect(lblX, lblY, lblW, lblH);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sizeText, px + pw / 2, lblY + padY);
    ctx.restore();
  }

  /* ---- Draw the gangify-style selection chrome around a design ----
     Solid blue outline + bigger white-filled handles + a bottom-right
     resize indicator. Size pill is drawn separately by drawSizePill. ---- */
  function drawSelectionChrome(d, px, py, pw, ph, isSelected, overlapping) {
    // Always draw the size pill so customers can see space usage
    drawSizePill(d, px, py, pw, ph, isSelected);

    if (!isSelected && !overlapping) return;

    const SELECT_COLOR  = '#1e90ff';
    const OVERLAP_COLOR = '#dc3545';
    const color = overlapping ? OVERLAP_COLOR : SELECT_COLOR;

    // Solid outline
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = isSelected ? 2 : 1.5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.restore();

    if (!isSelected) return;

    // Corner handles
    const HANDLE_R = 7;
    const corners = [
      [px,      py     ],
      [px + pw, py     ],
      [px,      py + ph],
      [px + pw, py + ph],
    ];
    corners.forEach(function (c) {
      ctx.fillStyle   = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(c[0], c[1], HANDLE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Bottom-right resize indicator — small diagonal arrow
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    const ax = px + pw - 3;
    const ay = py + ph - 3;
    ctx.beginPath();
    ctx.moveTo(ax,     ay - 6);
    ctx.lineTo(ax,     ay);
    ctx.lineTo(ax - 6, ay);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- Render the canvas ---- */
  function render() {
    const scale = getScale();
    const sheet = SHEETS[currentSheet];
    const W     = canvas.width;
    const H     = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Sheet background
    if (bgColor === null) {
      // Transparent mode — show a subtle checker pattern so the customer sees
      // that the print will be on clear DTF film.
      const sz = 12;
      for (let yy = 0; yy < H; yy += sz) {
        for (let xx = 0; xx < W; xx += sz) {
          const dark = ((xx / sz | 0) + (yy / sz | 0)) % 2 === 0;
          ctx.fillStyle = dark ? '#e8eaed' : '#f5f6f8';
          ctx.fillRect(xx, yy, sz, sz);
        }
      }
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // Grid lines (1-inch increments)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= sheet.w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, H);
      ctx.stroke();
    }
    for (let y = 0; y <= sheet.h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(W, y * scale);
      ctx.stroke();
    }

    // Sheet border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Safety-margin overlay (0.25" inset, dashed)
    if (showMargins) {
      const m = SAFETY_MARGIN_IN * scale;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(220,53,69,0.65)';
      ctx.lineWidth = 1.25;
      ctx.strokeRect(m, m, W - m * 2, H - m * 2);
      ctx.restore();
    }

    // Sheet label (watermark)
    ctx.fillStyle = 'rgba(0,86,179,0.08)';
    ctx.font      = 'bold ' + Math.round(scale * 1.5) + 'px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sheet.label, W / 2, H / 2);

    // Draw designs
    //   - With an image  → draw ONLY the image (no opaque background, no border)
    //                      Selected: subtle dashed outline + 4 corner resize handles
    //   - No image yet   → fall back to the old colored-rect placeholder
    designs.forEach(function (d) {
      const isSelected = d.id === selectedId;
      const px = d.x * scale;
      const py = d.y * scale;
      const pw = d.w * scale;
      const ph = d.h * scale;

      // Check overlaps with other designs
      const overlapping = designs.some(function (other) {
        if (other.id === d.id) return false;
        return !(d.x + d.w <= other.x || d.x >= other.x + other.w ||
                 d.y + d.h <= other.y || d.y >= other.y + other.h);
      });

      const upload = d.uploadId != null
        ? uploads.find(function (u) { return u.id === d.uploadId; })
        : null;
      const hasImage = upload && upload.image;
      const isText   = d.type === 'text';

      if (isText) {
        // Render text — using `alphabetic` baseline + ascent for vertical
        // alignment AND `bbLeft` for horizontal alignment.
        // The text origin is shifted by `bbLeft` so the leftmost visible
        // pixel of the glyphs lines up with the AABB's left edge exactly.
        const rot = d.rotation || 0;
        const ascentPx = (d.ascent || (d.h * 0.78)) * scale;
        const bbLeftPx = (d.bbLeft || 0) * scale;
        ctx.save();
        const style = d.fontStyle === 'italic' ? 'italic ' : '';
        ctx.font = style + (d.fontWeight || 700) + ' ' + ((d.fontSize || 1.5) * scale) + 'px ' + (d.fontFamily || 'sans-serif');
        ctx.fillStyle = d.color || '#000000';
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign    = 'left';
        if (rot !== 0) {
          ctx.translate(px + pw / 2, py + ph / 2);
          ctx.rotate(rot * Math.PI / 180);
          ctx.fillText(d.text || '', -pw / 2 + bbLeftPx, -ph / 2 + ascentPx);
        } else {
          ctx.fillText(d.text || '', px + bbLeftPx, py + ascentPx);
        }
        ctx.restore();

        drawSelectionChrome(d, px, py, pw, ph, isSelected, overlapping);
        return; // skip the image/placeholder branches
      }

      if (hasImage) {
        // Draw the image — rotate around the design's center if needed
        const rot = d.rotation || 0;
        try {
          ctx.save();
          if (rot !== 0) {
            ctx.translate(px + pw / 2, py + ph / 2);
            ctx.rotate(rot * Math.PI / 180);
            ctx.drawImage(upload.image, -pw / 2, -ph / 2, pw, ph);
          } else {
            ctx.drawImage(upload.image, px, py, pw, ph);
          }
          ctx.restore();
        } catch (err) {
          ctx.restore && ctx.restore();
          ctx.fillStyle = COLORS.design;
          ctx.fillRect(px, py, pw, ph);
        }

        drawSelectionChrome(d, px, py, pw, ph, isSelected, overlapping);
      } else {
        // No image attached — keep the legacy colored-rect placeholder
        ctx.fillStyle = overlapping ? COLORS.overlap : (isSelected ? COLORS.selected : COLORS.design);
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = isSelected ? COLORS.selectedBorder : (overlapping ? '#dc3545' : COLORS.designBorder);
        ctx.lineWidth   = isSelected ? 2.5 : 1.5;
        ctx.strokeRect(px, py, pw, ph);

        const fontSize = Math.max(8, Math.min(14, scale * 0.7));
        ctx.fillStyle  = isSelected ? '#c2185b' : COLORS.text;
        ctx.font       = 'bold ' + fontSize + 'px Montserrat, sans-serif';
        ctx.textAlign  = 'center';
        const lines = [d.label, '#' + d.id];
        const lineH = fontSize * 1.4;
        const startY = py + ph / 2 - (lines.length - 1) * lineH / 2;
        lines.forEach(function (line, i) {
          ctx.fillText(line, px + pw / 2, startY + i * lineH);
        });
      }
    });

    // Update fill percentage display
    updateFillMeter();

    // Sync the "Selected Design" controls in the left panel with whatever's
    // currently selected on the canvas.
    if (typeof notifySelection === 'function') notifySelection();
  }

  /* ---- Fill percentage ---- */
  function getFillPct() {
    const sheet    = SHEETS[currentSheet];
    const totalSqIn= sheet.w * sheet.h;
    const usedSqIn = designs.reduce(function (acc, d) { return acc + d.w * d.h; }, 0);
    return Math.min(100, (usedSqIn / totalSqIn) * 100);
  }

  function updateFillMeter() {
    const pct     = getFillPct();
    const bar     = document.getElementById('builderFillBar');
    const label   = document.getElementById('builderFillPct');
    if (bar) {
      bar.style.width = pct.toFixed(1) + '%';
      bar.className = 'fill-bar' + (pct > 90 ? ' full' : pct > 70 ? ' warn' : '');
    }
    if (label) label.textContent = pct.toFixed(1) + '%';
  }

  /* ---- Notify the page when the selection changes (so the W/H inputs in
     the left "Selected Design" panel can stay in sync). ---- */
  function notifySelection() {
    const detail = window.getSelectedDesign ? window.getSelectedDesign() : null;
    window.dispatchEvent(new CustomEvent('gsb-selection-changed', { detail: detail }));
  }

  /* ---- Sidebar (placed items list + summary) ---- */
  function updateSidebar() {
    notifySelection();
    const list = document.getElementById('placedItemsList');
    if (!list) return;

    if (designs.length === 0) {
      list.innerHTML = '<p style="color:#adb5bd;font-size:0.82rem;text-align:center;padding:1rem 0;">No designs placed yet.<br>Click the canvas to add designs.</p>';
    } else {
      list.innerHTML = designs.map(function (d) {
        const upload = d.uploadId != null
          ? uploads.find(function (u) { return u.id === d.uploadId; })
          : null;
        const nameLine = upload
          ? '<span class="pi-filename">📎 ' + escapeHtml(upload.name) + '</span>'
          : '<span class="pi-filename" style="color:#adb5bd;font-style:italic;">No image attached</span>';
        return '<div class="placed-item">' +
          '<div class="pi-info">' +
            '<strong>' + d.label + '</strong>' +
            '<span>Design #' + d.id + ' · ' + (d.w * d.h).toFixed(0) + ' sq in</span>' +
            nameLine +
          '</div>' +
          '<button class="pi-remove" onclick="removeDesign(' + d.id + ')" title="Remove" aria-label="Remove design ' + d.id + '">×</button>' +
          '</div>';
      }).join('');
    }

    // Update summary
    updateBuilderSummary();
  }

  function updateBuilderSummary() {
    const sheet        = SHEETS[currentSheet];
    const sheetPriceEl = document.getElementById('bsSummarySheetPrice');
    const countEl      = document.getElementById('bsSummaryCount');
    const fillEl       = document.getElementById('bsSummaryFill');
    const totalEl      = document.getElementById('bsSummaryTotal');

    const sheetQtyInput = document.getElementById('gangSheetQtyInput');
    const qty = sheetQtyInput ? parseInt(sheetQtyInput.value) || 1 : 1;

    if (sheetPriceEl) sheetPriceEl.textContent = '$' + sheet.price.toFixed(2) + '/sheet';
    if (countEl)      countEl.textContent       = designs.length + ' design(s) placed';
    if (fillEl)       fillEl.textContent        = getFillPct().toFixed(1) + '% filled';
    if (totalEl)      totalEl.textContent       = '$' + (sheet.price * qty).toFixed(2);

    // Update qty listener
    if (sheetQtyInput && !sheetQtyInput._bound) {
      sheetQtyInput._bound = true;
      sheetQtyInput.addEventListener('input', function () { updateBuilderSummary(); });
    }
  }

  function updateHint() {
    const hint = document.getElementById('canvasHint');
    if (hint) hint.style.display = designs.length > 0 ? 'none' : 'block';
  }

  /* ---- Build quote summary text ---- */
  function buildQuoteSummary() {
    const sheet = SHEETS[currentSheet];
    const lines = [
      'Gang Sheet Order',
      'Sheet Size: ' + sheet.label,
      'Total Designs: ' + designs.length,
      '',
      'Designs:',
    ];
    designs.forEach(function (d, i) {
      const upload = d.uploadId != null
        ? uploads.find(function (u) { return u.id === d.uploadId; })
        : null;
      const fileNote = upload ? ' [file: ' + upload.name + ']' : ' [no file attached]';
      lines.push(
        '  ' + (i + 1) + '. ' + d.label +
        ' (Position: ' + d.x.toFixed(1) + '" x ' + d.y.toFixed(1) + '")' +
        fileNote
      );
    });

    // Files-used summary
    const usedUploads = uploads.filter(function (u) {
      return designs.some(function (d) { return d.uploadId === u.id; });
    });
    if (usedUploads.length) {
      lines.push('', 'Files used:');
      usedUploads.forEach(function (u) {
        const count = designs.filter(function (d) { return d.uploadId === u.id; }).length;
        lines.push('  • ' + u.name + ' — placed ' + count + 'x');
      });
    }

    const summaryEl = document.getElementById('gangSheetSummaryText');
    if (summaryEl) summaryEl.value = lines.join('\n');

    const sheetSizeEl = document.getElementById('formGangSheetSize');
    if (sheetSizeEl) sheetSizeEl.value = sheet.label;

    const designCountEl = document.getElementById('formDesignCount');
    if (designCountEl) designCountEl.value = designs.length;
  }

  /* ---- Export layout as PNG (for submission) ---- */
  window.exportSheetLayout = function () {
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

})();
