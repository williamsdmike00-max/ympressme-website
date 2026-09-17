/* Ympressme cart — client side only.
   Holds variant ids and quantities. Deliberately stores NO prices:
   the server re-prices everything at checkout, so a tampered cart
   changes nothing except what the customer sees before they pay. */

const KEY = 'ympressme_cart_v1';

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(i => i && i.variant_id) : [];
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

export function addItem(variant_id, quantity = 1, display = {}) {
  const items = read();
  const hit = items.find(i => i.variant_id === variant_id);
  if (hit) hit.quantity = Math.min(500, hit.quantity + quantity);
  else items.push({ variant_id, quantity: Math.min(500, quantity), display });
  write(items);
}

export function setQuantity(variant_id, quantity) {
  const q = Math.max(0, Math.min(500, parseInt(quantity, 10) || 0));
  let items = read();
  if (q === 0) items = items.filter(i => i.variant_id !== variant_id);
  else {
    const hit = items.find(i => i.variant_id === variant_id);
    if (hit) hit.quantity = q;
  }
  write(items);
}

export function removeItem(variant_id) { setQuantity(variant_id, 0); }
export function clearCart() { write([]); }

function paintBadge(items = read()) {
  const n = items.reduce((a, i) => a + (i.quantity || 0), 0);
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = n;
    el.hidden = n === 0;
  });
}

/* Hand off to Stripe. Sends ids and quantities only. */
export async function checkout(email) {
  const items = read();
  if (!items.length) return { ok: false, error: 'Your cart is empty.' };

  const payload = items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity }));

  try {
    const r = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
