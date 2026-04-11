/**
 * YMPRESSME — pricing.js
 * Dynamic pricing calculator for DTF transfers and custom t-shirts.
 * All prices based on competitive market research (Transfer Superstars,
 * The Transfer Store, STAHLS) and standard POD industry tiers.
 */

/* ================================================================
   DTF SINGLE-SIZE TRANSFER PRICING
   Tiers: 1-5 | 6-11 | 12-23 | 24-47 | 48-99 | 100+
   ================================================================ */

const DTF_SIZES = {
  '4x4': {
    label: '4" × 4" (Small / Pocket)',
    pricePerUnit: [2.50, 2.00, 1.75, 1.50, 1.25, 1.00],
    sqIn: 16,
  },
  '4x12': {
    label: '4" × 12" (Sleeve / Long)',
    pricePerUnit: [3.00, 2.50, 2.00, 1.75, 1.50, 1.25],
    sqIn: 48,
  },
  '8x8': {
    label: '8" × 8" (Medium)',
    pricePerUnit: [3.75, 3.25, 2.75, 2.25, 2.00, 1.75],
    sqIn: 64,
  },
  '11x15': {
    label: '11" × 15" (Full Front)',
    pricePerUnit: [5.50, 5.00, 4.50, 4.00, 3.50, 3.00],
    sqIn: 165,
  },
  '12x16': {
    label: '12" × 16" (XL Front)',
    pricePerUnit: [6.50, 6.00, 5.50, 5.00, 4.50, 4.00],
    sqIn: 192,
  },
  '13x19': {
    label: '13" × 19" (Oversized)',
    pricePerUnit: [7.50, 7.00, 6.50, 6.00, 5.50, 5.00],
    sqIn: 247,
  },
};

const QUANTITY_TIERS = [
  { min: 1,   max: 5,    label: '1–5 pcs' },
  { min: 6,   max: 11,   label: '6–11 pcs' },
  { min: 12,  max: 23,   label: '12–23 pcs' },
  { min: 24,  max: 47,   label: '24–47 pcs' },
  { min: 48,  max: 99,   label: '48–99 pcs' },
  { min: 100, max: Infinity, label: '100+ pcs' },
];

/**
 * Get the tier index for a given quantity
 * @param {number} qty
 * @returns {number} tier index 0-5
 */
function getDtfTierIndex(qty) {
  for (let i = 0; i < QUANTITY_TIERS.length; i++) {
    if (qty >= QUANTITY_TIERS[i].min && qty <= QUANTITY_TIERS[i].max) return i;
  }
  return QUANTITY_TIERS.length - 1;
}

/**
 * Calculate price for single-size DTF transfers
 * @param {string} sizeKey - key from DTF_SIZES
 * @param {number} qty
 * @returns {{ unitPrice: number, total: number, tierIndex: number, tierLabel: string }}
 */
function calcDtfPrice(sizeKey, qty) {
  const size = DTF_SIZES[sizeKey];
  if (!size || qty < 1) return null;
  const tierIdx  = getDtfTierIndex(qty);
  const unitPrice = size.pricePerUnit[tierIdx];
  return {
    unitPrice:  unitPrice,
    total:      +(unitPrice * qty).toFixed(2),
    tierIndex:  tierIdx,
    tierLabel:  QUANTITY_TIERS[tierIdx].label,
    sizeLabel:  size.label,
  };
}

/* ================================================================
   GANG SHEET PRICING
   Priced per sheet — customers pack as many designs as will fit.
   ================================================================ */

const GANG_SHEETS = {
  '13x19': { label: '13" × 19"', price: 12.00, w: 13, h: 19 },
  '22x24': { label: '22" × 24"', price: 20.00, w: 22, h: 24 },
  '22x36': { label: '22" × 36"', price: 28.00, w: 22, h: 36 },
};

/**
 * Calculate gang sheet total
 * @param {string} sheetKey
 * @param {number} qty - number of sheets
 * @returns {{ sheetPrice: number, total: number }}
 */
function calcGangSheetPrice(sheetKey, qty) {
  const sheet = GANG_SHEETS[sheetKey];
  if (!sheet || qty < 1) return null;
  const discount = qty >= 10 ? 0.10 : qty >= 5 ? 0.05 : 0;
  const sheetPrice = +(sheet.price * (1 - discount)).toFixed(2);
  return {
    sheetPrice: sheetPrice,
    total:      +(sheetPrice * qty).toFixed(2),
    discount:   discount,
    label:      sheet.label,
  };
}

/* ================================================================
   CUSTOM T-SHIRT PRICING
   ================================================================ */

const SHIRT_TYPES = {
  'gildan5000':    { label: 'Gildan 5000 (Standard Tee)',        basePrice: 14.00 },
  'bella3001':     { label: 'Bella+Canvas 3001 (Premium Tee)',   basePrice: 21.00 },
  'gildan18500':   { label: 'Gildan 18500 (Heavy Blend Hoodie)', basePrice: 30.00 },
  'gildan2200':    { label: 'Gildan 2200 (Tank Top)',            basePrice: 13.00 },
  'gildan5400':    { label: 'Gildan 5400 (Heavy Tee)',           basePrice: 15.00 },
};

const SHIRT_QTY_BREAKS = [
  { min: 1,   max: 11,  discount: 0.00, label: '1–11 pcs' },
  { min: 12,  max: 23,  discount: 0.12, label: '12–23 pcs' },
  { min: 24,  max: 47,  discount: 0.20, label: '24–47 pcs' },
  { min: 48,  max: 71,  discount: 0.28, label: '48–71 pcs' },
  { min: 72,  max: Infinity, discount: 0.35, label: '72+ pcs' },
];

function getShirtTier(qty) {
  for (let i = 0; i < SHIRT_QTY_BREAKS.length; i++) {
    if (qty >= SHIRT_QTY_BREAKS[i].min && qty <= SHIRT_QTY_BREAKS[i].max) return SHIRT_QTY_BREAKS[i];
  }
  return SHIRT_QTY_BREAKS[SHIRT_QTY_BREAKS.length - 1];
}

/**
 * Calculate custom T-shirt price
 * @param {string} typeKey
 * @param {number} qty
 * @param {boolean} hasPocket - add pocket print ($2/shirt)
 * @returns {{ unitPrice, total, tier, savings }}
 */
function calcShirtPrice(typeKey, qty, hasPocket) {
  const shirt = SHIRT_TYPES[typeKey];
  if (!shirt || qty < 1) return null;
  const tier      = getShirtTier(qty);
  const base      = shirt.basePrice + (hasPocket ? 2.00 : 0);
  const unitPrice = +(base * (1 - tier.discount)).toFixed(2);
  const total     = +(unitPrice * qty).toFixed(2);
  const savings   = +((base - unitPrice) * qty).toFixed(2);
  return { unitPrice, total, tier, savings, basePrice: base };
}

/* ================================================================
   UI HELPERS — Wire up the pricing widgets on each page
   ================================================================ */

/** Format a number as USD currency string */
function fmt(n) {
  return '$' + n.toFixed(2);
}

/* ----- DTF Single-Size Calculator (used on dtf-transfers.html) ----- */
window.initDtfCalculator = function () {
  const sizeSelect = document.getElementById('dtfSize');
  const qtyInput   = document.getElementById('dtfQty');
  const display    = document.getElementById('dtfPriceDisplay');
  if (!sizeSelect || !qtyInput || !display) return;

  function render() {
    const result = calcDtfPrice(sizeSelect.value, parseInt(qtyInput.value) || 1);
    if (!result) return;

    document.getElementById('dtfUnitPrice').textContent = fmt(result.unitPrice);
    document.getElementById('dtfTotal').textContent     = fmt(result.total);
    document.getElementById('dtfTierBadge').textContent = result.tierLabel + ' pricing';

    // Highlight active column in reference table
    document.querySelectorAll('.price-tier-col').forEach(function (col, i) {
      col.classList.toggle('highlight', i === result.tierIndex);
    });

    // Price breakdown rows
    const bdQty  = document.getElementById('bdQty');
    const bdUnit = document.getElementById('bdUnit');
    const bdTotal= document.getElementById('bdTotal');
    if (bdQty)   bdQty.textContent  = parseInt(qtyInput.value) + ' transfers';
    if (bdUnit)  bdUnit.textContent = fmt(result.unitPrice) + ' each';
    if (bdTotal) bdTotal.textContent= fmt(result.total);
  }

  sizeSelect.addEventListener('change', render);
  qtyInput.addEventListener('input', render);
  render(); // initial render
};

/* ----- Gang Sheet Calculator (used on dtf-transfers.html) ----- */
window.initGangSheetCalculator = function () {
  const sheetSelect = document.getElementById('gangSheetSize');
  const qtyInput    = document.getElementById('gangSheetQty');
  if (!sheetSelect || !qtyInput) return;

  function render() {
    const result = calcGangSheetPrice(sheetSelect.value, parseInt(qtyInput.value) || 1);
    if (!result) return;

    const priceEl   = document.getElementById('gsSheetPrice');
    const totalEl   = document.getElementById('gsTotal');
    const discountEl= document.getElementById('gsDiscount');
    if (priceEl)    priceEl.textContent   = fmt(result.sheetPrice) + '/sheet';
    if (totalEl)    totalEl.textContent   = fmt(result.total);
    if (discountEl) discountEl.textContent= result.discount > 0
      ? '🎉 ' + (result.discount * 100).toFixed(0) + '% multi-sheet discount applied!'
      : 'Order 5+ sheets for 5% off, 10+ for 10% off';
  }

  sheetSelect.addEventListener('change', render);
  qtyInput.addEventListener('input', render);
  render();
};

/* ----- T-Shirt Calculator (used on tshirts.html) ----- */
window.initShirtCalculator = function () {
  const typeSelect  = document.getElementById('shirtType');
  const qtyInput    = document.getElementById('shirtQty');
  const pocketCheck = document.getElementById('shirtPocket');
  const display     = document.getElementById('shirtPriceDisplay');
  if (!typeSelect || !qtyInput || !display) return;

  function render() {
    const result = calcShirtPrice(
      typeSelect.value,
      parseInt(qtyInput.value) || 1,
      pocketCheck ? pocketCheck.checked : false
    );
    if (!result) return;

    const unitEl    = document.getElementById('shirtUnitPrice');
    const totalEl   = document.getElementById('shirtTotal');
    const tierEl    = document.getElementById('shirtTierBadge');
    const savingsEl = document.getElementById('shirtSavings');
    if (unitEl)    unitEl.textContent    = fmt(result.unitPrice);
    if (totalEl)   totalEl.textContent   = fmt(result.total);
    if (tierEl)    tierEl.textContent    = result.tier.label + ' pricing';
    if (savingsEl) {
      savingsEl.textContent = result.savings > 0
        ? 'You save ' + fmt(result.savings) + ' vs. single-piece price'
        : 'Order 12+ for bulk discounts';
    }

    // Breakdown
    const bdQty  = document.getElementById('sbd-qty');
    const bdUnit = document.getElementById('sbd-unit');
    const bdSave = document.getElementById('sbd-save');
    const bdTot  = document.getElementById('sbd-total');
    if (bdQty)  bdQty.textContent  = (parseInt(qtyInput.value) || 1) + ' shirts';
    if (bdUnit) bdUnit.textContent = fmt(result.unitPrice) + '/shirt';
    if (bdSave) bdSave.textContent = result.savings > 0 ? '–' + fmt(result.savings) : '$0.00';
    if (bdTot)  bdTot.textContent  = fmt(result.total);
  }

  typeSelect.addEventListener('change', render);
  qtyInput.addEventListener('input', render);
  pocketCheck && pocketCheck.addEventListener('change', render);
  render();
};

/* Expose for use in gang sheet builder */
window.GANG_SHEETS      = GANG_SHEETS;
window.DTF_SIZES        = DTF_SIZES;
window.calcGangSheetPrice = calcGangSheetPrice;
window.fmt              = fmt;
