/**
 * YMPRESSME — pricing.js
 * Updated pricing based on client-provided rate sheet.
 *
 * DTF Transfers: Flat price per transfer by inch size (largest dimension)
 * T-Shirts:      Tiered production price per shirt by quantity
 * Personalization: Names $3.00 | Numbers $2.00 each
 */

/* ================================================================
   DTF INDIVIDUAL PRINT PRICING
   Flat price per transfer — priced by size (largest dimension in inches)
   ================================================================ */

const DTF_PRICES = [
  { key: '1.5',  label: '1.5"',  price: 1.00 },
  { key: '2',    label: '2"',    price: 1.25 },
  { key: '3',    label: '3"',    price: 1.75 },
  { key: '4',    label: '4"',    price: 2.00 },
  { key: '5',    label: '5"',    price: 2.00 },
  { key: '8',    label: '8"',    price: 3.25 },
  { key: '9',    label: '9"',    price: 3.75 },
  { key: '10',   label: '10"',   price: 5.25 },
  { key: '10.5', label: '10.5"', price: 5.25 },
  { key: '11',   label: '11"',   price: 5.75 },
  { key: '11.5', label: '11.5"', price: 6.25 },
  { key: '12',   label: '12"',   price: 6.50 },
  { key: '12.5', label: '12.5"', price: 6.50 },
  { key: '13',   label: '13"',   price: 6.75 },
  { key: '14',   label: '14"',   price: 7.25 },
  { key: '15',   label: '15"',   price: 7.50 },
  { key: '16',   label: '16"',   price: 7.75 },
  { key: '17',   label: '17"',   price: 8.25 },
  { key: '18',   label: '18"',   price: 8.50 },
];

/**
 * Get price for a DTF transfer by size key
 * @param {string} sizeKey
 * @returns {number} price per transfer
 */
function getDtfPrice(sizeKey) {
  const found = DTF_PRICES.find(function (s) { return s.key === sizeKey; });
  return found ? found.price : 0;
}

/**
 * Calculate DTF order total
 * @param {string} sizeKey
 * @param {number} qty
 * @returns {{ unitPrice, total, sizeLabel }}
 */
function calcDtfPrice(sizeKey, qty) {
  const found = DTF_PRICES.find(function (s) { return s.key === sizeKey; });
  if (!found || qty < 1) return null;
  return {
    unitPrice:  found.price,
    total:      +(found.price * qty).toFixed(2),
    sizeLabel:  found.label,
  };
}

/* ================================================================
   GANG SHEET PRICING
   Priced per sheet — pack as many designs as fit.
   ================================================================ */

const GANG_SHEETS = {
  '13x19': { label: '13" × 19"', price: 12.00, w: 13, h: 19 },
  '22x24': { label: '22" × 24"', price: 20.00, w: 22, h: 24 },
  '22x36': { label: '22" × 36"', price: 28.00, w: 22, h: 36 },
};

function calcGangSheetPrice(sheetKey, qty) {
  const sheet = GANG_SHEETS[sheetKey];
  if (!sheet || qty < 1) return null;
  const discount   = qty >= 10 ? 0.10 : qty >= 5 ? 0.05 : 0;
  const sheetPrice = +(sheet.price * (1 - discount)).toFixed(2);
  return {
    sheetPrice: sheetPrice,
    total:      +(sheetPrice * qty).toFixed(2),
    discount:   discount,
    label:      sheet.label,
  };
}

/* ================================================================
   T-SHIRT PRODUCTION PRICING
   Flat price per shirt by quantity tier.
   Size upcharges: +$1 per X over XL (2XL=+$1, 3XL=+$2 … 7XL=+$6)
   ================================================================ */

const SHIRT_QTY_TIERS = [
  { min: 1,   max: 25,       price: 18.00, label: '1–25 shirts' },
  { min: 26,  max: 50,       price: 16.00, label: '26–50 shirts' },
  { min: 51,  max: 100,      price: 14.00, label: '51–100 shirts' },
  { min: 101, max: Infinity, price: 13.00, label: '100+ shirts' },
];

/**
 * Get upcharge for oversized shirts
 * XL = $0, 2XL = +$1, 3XL = +$2, ... 7XL = +$6
 * @param {string} sizeKey  e.g. "XL", "2XL", "3XL"
 * @returns {number}
 */
function getShirtSizeUpcharge(sizeKey) {
  const match = sizeKey && sizeKey.match(/^(\d+)XL$/i);
  if (!match) return 0;
  const x = parseInt(match[1]);
  return x >= 2 ? Math.min(x - 1, 6) : 0;
}

function getShirtTier(qty) {
  return SHIRT_QTY_TIERS.find(function (t) {
    return qty >= t.min && qty <= t.max;
  }) || SHIRT_QTY_TIERS[SHIRT_QTY_TIERS.length - 1];
}

/**
 * Calculate shirt total
 * @param {number} qty
 * @param {string} sizeUpchargeKey  optional — e.g. "2XL"
 * @param {number} nameCount       number of name personalizations
 * @param {number} numberCount     number of number personalizations
 * @returns {{ unitPrice, total, tier, personalizationCost }}
 */
function calcShirtPrice(qty, sizeUpchargeKey, nameCount, numberCount) {
  if (qty < 1) return null;
  const tier         = getShirtTier(qty);
  const upcharge     = getShirtSizeUpcharge(sizeUpchargeKey || '');
  const unitBase     = tier.price + upcharge;
  const personNames  = (nameCount  || 0) * 3.00;
  const personNums   = (numberCount || 0) * 2.00;
  const personPerShirt = personNames + personNums;
  const unitPrice    = +(unitBase + personPerShirt).toFixed(2);
  const total        = +(unitPrice * qty).toFixed(2);
  return {
    unitPrice,
    total,
    tier,
    upcharge,
    personalizationCost: +(personPerShirt * qty).toFixed(2),
    baseTotal: +(unitBase * qty).toFixed(2),
  };
}

/* ================================================================
   PERSONALIZATION PRICING
   ================================================================ */

const PERSONALIZATION = {
  name:   { label: 'Name',   price: 3.00 },
  number: { label: 'Number', price: 2.00 },
};

/* ================================================================
   UI HELPERS
   ================================================================ */

function fmt(n) {
  return '$' + Number(n).toFixed(2);
}

/* ----- DTF Calculator (dtf-transfers.html) ----- */
window.initDtfCalculator = function () {
  const sizeSelect = document.getElementById('dtfSize');
  const qtyInput   = document.getElementById('dtfQty');
  if (!sizeSelect || !qtyInput) return;

  function render() {
    const qty    = parseInt(qtyInput.value) || 1;
    const result = calcDtfPrice(sizeSelect.value, qty);
    if (!result) return;

    const unitEl  = document.getElementById('dtfUnitPrice');
    const totalEl = document.getElementById('dtfTotal');
    const bdQty   = document.getElementById('bdQty');
    const bdUnit  = document.getElementById('bdUnit');
    const bdTotal = document.getElementById('bdTotal');
    const badge   = document.getElementById('dtfTierBadge');

    if (unitEl)  unitEl.textContent  = fmt(result.unitPrice);
    if (totalEl) totalEl.textContent = fmt(result.total);
    if (bdQty)   bdQty.textContent   = qty + ' transfer' + (qty > 1 ? 's' : '');
    if (bdUnit)  bdUnit.textContent  = fmt(result.unitPrice) + ' each';
    if (bdTotal) bdTotal.textContent = fmt(result.total);
    if (badge)   badge.textContent   = result.sizeLabel + ' transfer';
  }

  sizeSelect.addEventListener('change', render);
  qtyInput.addEventListener('input', render);
  render();
};

/* ----- Gang Sheet Calculator (dtf-transfers.html) ----- */
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

/* ----- T-Shirt Calculator (tshirts.html) ----- */
window.initShirtCalculator = function () {
  const qtyInput     = document.getElementById('shirtQty');
  const sizeUpcharge = document.getElementById('shirtSizeUpcharge');
  const nameCount    = document.getElementById('shirtNameCount');
  const numberCount  = document.getElementById('shirtNumberCount');
  if (!qtyInput) return;

  function render() {
    const qty    = parseInt(qtyInput.value) || 1;
    const szKey  = sizeUpcharge ? sizeUpcharge.value : '';
    const names  = nameCount   ? parseInt(nameCount.value)   || 0 : 0;
    const nums   = numberCount ? parseInt(numberCount.value) || 0 : 0;
    const result = calcShirtPrice(qty, szKey, names, nums);
    if (!result) return;

    const unitEl    = document.getElementById('shirtUnitPrice');
    const totalEl   = document.getElementById('shirtTotal');
    const tierEl    = document.getElementById('shirtTierBadge');
    const savingsEl = document.getElementById('shirtSavings');
    const bdQty     = document.getElementById('sbd-qty');
    const bdUnit    = document.getElementById('sbd-unit');
    const bdPerson  = document.getElementById('sbd-person');
    const bdTot     = document.getElementById('sbd-total');
    const bdUpch    = document.getElementById('sbd-upcharge');

    if (unitEl)    unitEl.textContent    = fmt(result.unitPrice);
    if (totalEl)   totalEl.textContent   = fmt(result.total);
    if (tierEl)    tierEl.textContent    = result.tier.label + ' · ' + fmt(result.tier.price) + '/shirt';
    if (savingsEl) {
      const saved = (18.00 - result.tier.price) * qty;
      savingsEl.textContent = saved > 0
        ? 'You save ' + fmt(saved) + ' vs. single-piece price'
        : 'Best price starts at 26+ shirts';
    }
    if (bdQty)    bdQty.textContent    = qty + ' shirt' + (qty > 1 ? 's' : '');
    if (bdUnit)   bdUnit.textContent   = fmt(result.tier.price) + '/shirt (base)';
    if (bdUpch)   bdUpch.textContent   = result.upcharge > 0 ? '+' + fmt(result.upcharge) + '/shirt (oversize)' : 'Standard size';
    if (bdPerson) bdPerson.textContent = result.personalizationCost > 0 ? '+' + fmt(result.personalizationCost) + ' (personalization)' : 'None';
    if (bdTot)    bdTot.textContent    = fmt(result.total);
  }

  qtyInput.addEventListener('input', render);
  sizeUpcharge  && sizeUpcharge.addEventListener('change', render);
  nameCount     && nameCount.addEventListener('input', render);
  numberCount   && numberCount.addEventListener('input', render);
  render();
};

/* Expose for gang sheet builder */
window.GANG_SHEETS        = GANG_SHEETS;
window.DTF_PRICES         = DTF_PRICES;
window.calcGangSheetPrice = calcGangSheetPrice;
window.fmt                = fmt;
