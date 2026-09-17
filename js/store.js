/* Ympressme storefront data layer.
   Reads the catalog from Supabase with the public anon key. RLS only
   exposes active products — orders are invisible from the browser. */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://qgiozygfzsqtjhfhvoon.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_jDOcTqSI7Oqfio9xmUiQFg_qfr5FU9L';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

export const money = cents =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const SELECT = `
  id, handle, title, description, needs_artwork,
  option1_name, option2_name, option3_name, sort_order,
  product_images ( src, position ),
  variants ( id, option1, option2, option3, price_cents, available )
`;

export async function listProducts() {
  const { data, error } = await sb
    .from('products').select(SELECT)
    .eq('status', 'active').order('sort_order');
  if (error) throw error;
  return (data ?? []).map(decorate);
}

export async function getProduct(handle) {
  const { data, error } = await sb
    .from('products').select(SELECT)
    .eq('handle', handle).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return data ? decorate(data) : null;
}

/* Look up carted variants for display. Prices shown here are a preview —
   the server re-prices everything at checkout. */
export async function getVariants(ids) {
  if (!ids.length) return [];
  const { data, error } = await sb
    .from('variants')
    .select('id, option1, option2, option3, price_cents, products(title, handle, option1_name, option2_name, option3_name, product_images(src, position))')
    .in('id', ids);
  if (error) throw error;
  return data ?? [];
}

function decorate(p) {
  p.images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
  p.hero = p.images[0]?.src || null;
  p.variants = (p.variants ?? []).filter(v => v.available !== false);
  const prices = p.variants.map(v => v.price_cents);
  p.minPrice = prices.length ? Math.min(...prices) : null;
  p.maxPrice = prices.length ? Math.max(...prices) : null;
  p.optionNames = [p.option1_name, p.option2_name, p.option3_name].filter(Boolean);
  return p;
}

/* Distinct values for option slot n (1-based), in first-seen order. */
export function optionValues(product, n) {
  const key = `option${n}`;
  return [...new Set(product.variants.map(v => v[key]).filter(Boolean))];
}

export function findVariant(product, picked) {
  return product.variants.find(v =>
    (v.option1 ?? null) === (picked[0] ?? null) &&
    (v.option2 ?? null) === (picked[1] ?? null) &&
    (v.option3 ?? null) === (picked[2] ?? null)
  ) || null;
}

export function variantLabel(product, v) {
  return [v.option1, v.option2, v.option3].filter(Boolean).join(' / ');
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
