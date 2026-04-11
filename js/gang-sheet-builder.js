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

  /* ---- Sheet definitions (inches) ---- */
  const SHEETS = {
    '13x19': { w: 13, h: 19, label: '13" × 19"', price: 12.00 },
    '22x24': { w: 22, h: 24, label: '22" × 24"', price: 20.00 },
    '22x36': { w: 22, h: 36, label: '22" × 36"', price: 28.00 },
  };

  /* ---- Transfer size definitions (inches) ---- */
  const SIZES = [
    { key: '4x4',   w: 4,  h: 4,  label: '4" × 4"',   unitPrice: 2.50 },
    { key: '4x12',  w: 4,  h: 12, label: '4" × 12"',  unitPrice: 3.00 },
    { key: '8x8',   w: 8,  h: 8,  label: '8" × 8"',   unitPrice: 3.75 },
    { key: '11x15', w: 11, h: 15, label: '11" × 15"', unitPrice: 5.50 },
    { key: '12x16', w: 12, h: 16, label: '12" × 16"', unitPrice: 6.50 },
  ];

  /* ---- State ---- */
  let currentSheet   = '22x36';
  let currentSizeKey = '4x4';
  let designs        = [];  // { id, key, x, y, w, h, label }
  let nextId         = 1;
  let selectedId     = null;
  let dragging       = false;
  let dragOffX       = 0;
  let dragOffY       = 0;

  /* ---- DOM refs ---- */
  let canvas, ctx;

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
    render();
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
        designs = []; // clear on sheet change
        selectedId = null;
        setupCanvas();
        render();
        updateSidebar();
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

  function onMouseDown(e) {
    const pos = canvasCoords(e);
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
    if (!dragging || selectedId === null) return;
    const pos   = canvasCoords(e);
    const d     = designs.find(function (d) { return d.id === selectedId; });
    if (!d) return;
    const sheet = SHEETS[currentSheet];

    d.x = Math.max(0, Math.min(pos.x - dragOffX, sheet.w - d.w));
    d.y = Math.max(0, Math.min(pos.y - dragOffY, sheet.h - d.h));
    render();
  }

  function onMouseUp() {
    dragging = false;
  }

  /* ---- Place a design ---- */
  function placeDesign(cx, cy) {
    const sizeData = SIZES.find(function (s) { return s.key === currentSizeKey; });
    if (!sizeData) return;

    const sheet = SHEETS[currentSheet];

    // Center design on click point, clamped to sheet bounds
    let x = cx - sizeData.w / 2;
    let y = cy - sizeData.h / 2;
    x = Math.max(0, Math.min(x, sheet.w - sizeData.w));
    y = Math.max(0, Math.min(y, sheet.h - sizeData.h));

    // Check if design fits on sheet
    if (sizeData.w > sheet.w || sizeData.h > sheet.h) {
      window.showToast && window.showToast(
        sizeData.label + ' doesn\'t fit on a ' + SHEETS[currentSheet].label + ' sheet.',
        'error'
      );
      return;
    }

    const design = {
      id:    nextId++,
      key:   sizeData.key,
      x:     x,
      y:     y,
      w:     sizeData.w,
      h:     sizeData.h,
      label: sizeData.label,
    };

    designs.push(design);
    selectedId = design.id;
    render();
    updateSidebar();
    updateHint();
  }

  /* ---- Remove a design ---- */
  window.removeDesign = function (id) {
    designs = designs.filter(function (d) { return d.id !== id; });
    if (selectedId === id) selectedId = null;
    render();
    updateSidebar();
    updateHint();
  };

  /* ---- Toolbar buttons ---- */
  function bindToolbarButtons() {
    const clearBtn = document.getElementById('builderClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (designs.length === 0) return;
        if (confirm('Clear all designs from the sheet?')) {
          designs = [];
          selectedId = null;
          render();
          updateSidebar();
          updateHint();
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

  /* ---- Render the canvas ---- */
  function render() {
    const scale = getScale();
    const sheet = SHEETS[currentSheet];
    const W     = canvas.width;
    const H     = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Sheet background
    ctx.fillStyle = COLORS.sheet;
    ctx.fillRect(0, 0, W, H);

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

    // Sheet label (watermark)
    ctx.fillStyle = 'rgba(0,86,179,0.08)';
    ctx.font      = 'bold ' + Math.round(scale * 1.5) + 'px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sheet.label, W / 2, H / 2);

    // Draw designs
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

      // Fill
      ctx.fillStyle = overlapping ? COLORS.overlap : (isSelected ? COLORS.selected : COLORS.design);
      ctx.fillRect(px, py, pw, ph);

      // Border
      ctx.strokeStyle = isSelected ? COLORS.selectedBorder : (overlapping ? '#dc3545' : COLORS.designBorder);
      ctx.lineWidth   = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle && ctx.strokeRect(px, py, pw, ph);

      // Label
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

      // Drag handle (corner circle) when selected
      if (isSelected) {
        ctx.fillStyle = COLORS.handle;
        ctx.beginPath();
        ctx.arc(px + pw - 6, py + ph - 6, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Update fill percentage display
    updateFillMeter();
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

  /* ---- Sidebar (placed items list + summary) ---- */
  function updateSidebar() {
    const list = document.getElementById('placedItemsList');
    if (!list) return;

    if (designs.length === 0) {
      list.innerHTML = '<p style="color:#adb5bd;font-size:0.82rem;text-align:center;padding:1rem 0;">No designs placed yet.<br>Click the canvas to add designs.</p>';
    } else {
      list.innerHTML = designs.map(function (d) {
        return '<div class="placed-item">' +
          '<div class="pi-info"><strong>' + d.label + '</strong><span>Design #' + d.id + ' · ' + (d.w * d.h).toFixed(0) + ' sq in</span></div>' +
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
    const summary = [
      'Gang Sheet Order',
      'Sheet Size: ' + sheet.label,
      'Total Designs: ' + designs.length,
      '',
      'Designs:',
    ].concat(designs.map(function (d, i) {
      return '  ' + (i + 1) + '. ' + d.label + ' (Position: ' + d.x.toFixed(1) + '" x ' + d.y.toFixed(1) + '")';
    })).join('\n');

    const summaryEl = document.getElementById('gangSheetSummaryText');
    if (summaryEl) summaryEl.value = summary;

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
