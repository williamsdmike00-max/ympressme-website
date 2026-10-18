/* Customer accounts: passwordless sign-in by email link, saved details,
   order history, and reorder. Everything is scoped by Supabase row-level
   security, so a customer can only ever read their own profile and orders. */

import { sb } from './store.js';
import { addItem } from './cart.js';

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session ?? null;
}

export function onAuthChange(cb) {
  return sb.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function sendSignInLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + '/account.html' }
  });
  if (error) throw error;
}

export async function signOut() { await sb.auth.signOut(); }

export async function getProfile() {
  const s = await getSession();
  if (!s) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
  if (error) throw error;
  return data || { id: s.user.id, full_name: '', phone: '', address: {} };
}

export async function saveProfile({ full_name, phone, address }) {
  const s = await getSession();
  if (!s) throw new Error('Please sign in first.');
  const { error } = await sb.from('profiles').upsert({
    id: s.user.id, full_name, phone, address, updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function listOrders() {
  const { data, error } = await sb
    .from('orders')
    .select(`id, order_number, status, total_cents, created_at,
             order_items ( id, variant_id, product_title, variant_label, quantity,
                           unit_price_cents, artwork_url, preview_url )`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/* Put a past line back in the cart with the same artwork. Prices are
   re-checked at checkout, so a reorder always charges today's price. */
export async function reorderItem(item) {
  if (!item.variant_id) throw new Error('This item is no longer sold.');
  const { data: v } = await sb.from('variants')
    .select('id, available, products(status)').eq('id', item.variant_id).maybeSingle();
  if (!v || v.available === false || v.products?.status !== 'active') {
    throw new Error(`"${item.product_title}" is no longer available.`);
  }
  const artwork = item.artwork_url
    ? { url: item.artwork_url, name: (item.artwork_url.split('/').pop() || 'artwork').replace(/^\d+-[a-z0-9]+-/, ''),
        preview_url: item.preview_url || '' }
    : null;
  addItem(item.variant_id, item.quantity, { title: item.product_title, label: item.variant_label }, artwork);
}
