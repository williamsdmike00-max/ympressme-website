/* Ympressme cart — client side only.
   Holds variant ids, quantities, and (for print orders) a link to the
   customer's artwork. Deliberately stores NO prices: the server re-prices
   everything at checkout, so a tampered cart changes nothing except what
   the customer sees before they pay.

   Each cart line has a `key`. Plain products use the variant id as the key,
   so adding the same shirt twice bumps the quantity. Lines with artwork get
   their own key, so two different gang sheets never merge into one line. */

const KEY = 'ympressme_cart_v1';
const MAX_QTY = 500;

function lineKey(variant_id, artwork) {
  return artwork && artwork.url ? variant_id + '|' + artwork.url : variant_id;
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(i => i && i.variant_id)
      .map(i => Object.assign({}, i, { key: i.key || lineKey(i.variant_id, i.artwork) }));
  } catch { return []; }          // private mode / blocked storage
}

function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: items }));
  paintBadge(items);
}

export function getCart() { return read(); }

export function count() {
  return read().reduce((n, i) => n + (i.quantity || 0), 0);
}

/* artwork (optional): { url, name, preview_url, note } */
export function addItem(variant_id, quantity = 1, display = {}, artwork = null) {
  const items = read();
  const key = lineKey(variant_id, artwork);
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  const hit = items.find(i => i.key === key);
  if (hit) hit.quantity = Math.min(MAX_QTY, hit.quantity + q);
  else items.push({ key, variant_id, quantity: Math.min(MAX_QTY, q), display, artwork: artwork || null });
  write(items);
}

export function setQuantity(key, quantity) {
  const q = Math.max(0, Math.min(MAX_QTY, parseInt(quantity, 10) || 0));
  let items = read();
  if (q === 0) items = items.filter(i => i.key !== key);
  else {
    const hit = items.find(i => i.key === key);
    if (hit) hit.quantity = q;
  }
  write(items);
}

export function removeItem(key) { setQuantity(key, 0); }
export function clearCart() { write([]); }

function paintBadge(items = read()) {
  const n = items.reduce((a, i) => a + (i.quantity || 0), 0);
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = n;
    el.hidden = n === 0;
  });
}

/* Hand off to Stripe. Sends ids, quantities and artwork links only. */
export async function checkout(email) {
  const items = read();
  if (!items.length) return { ok: false, error: 'Your cart is empty.' };

  const payload = items.map(i => ({
    variant_id: i.variant_id,
    quantity: i.quantity,
    artwork_url: i.artwork?.url || undefined,
    artwork_name: i.artwork?.name || undefined,
    preview_url: i.artwork?.preview_url || undefined,
    note: i.artwork?.note || undefined,
  }));

  // Signed-in customers get their email pre-filled and the order tied to them
  let token = null;
  try {
    const { getSession } = await import('./account.js');
    const s = await getSession();
    if (s) { token = s.access_token; email = email || s.user?.email; }
  } catch {}

  try {
    const r = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify({ items: payload, email })
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data.error || 'Checkout failed.' };
    window.location.href = data.url;       // Stripe-hosted payment page
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

document.addEventListener('DOMContentLoaded', () => paintBadge());
