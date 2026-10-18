// POST /api/create-checkout-session
// The browser sends ONLY variant ids + quantities. Never a price.
// Prices are re-read from Supabase here, server-side. This is the whole
// reason this endpoint exists — a static page cannot be trusted with money.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // service role: server only, never shipped to the browser
);

const MAX_QTY = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, email } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many line items' });
    }

    // ---- normalise + validate the client's request ----
    const wanted = new Map();
    for (const it of items) {
      const id = String(it?.variant_id ?? '');
      const qty = Number.parseInt(it?.quantity, 10);
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: 'Bad variant id' });
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return res.status(400).json({ error: 'Bad quantity' });
      }
      wanted.set(id, (wanted.get(id) ?? 0) + qty);
    }

    // ---- authoritative price lookup ----
    const { data: variants, error } = await supabase
      .from('variants')
      .select(`
        id, option1, option2, option3, price_cents, available,
        products ( id, title, status, needs_artwork,
                   option1_name, option2_name, option3_name,
                   product_images ( src, position ) )
      `)
      .in('id', [...wanted.keys()]);

    if (error) throw error;

    if (!variants || variants.length !== wanted.size) {
      return res.status(409).json({
        error: 'Some items are no longer available. Please refresh your cart.'
      });
    }

    let artworkNeeded = false;
    const line_items = [];

    for (const v of variants) {
      const p = v.products;
      if (!p || p.status !== 'active' || v.available === false) {
        return res.status(409).json({
          error: `"${p?.title ?? 'An item'}" is no longer available.`
        });
      }
      if (p.needs_artwork) artworkNeeded = true;

      // human-readable variant label, e.g. "black / 2xl / long"
      const label = [
        [p.option1_name, v.option1],
        [p.option2_name, v.option2],
        [p.option3_name, v.option3]
      ].filter(([n, val]) => n && val)
       .map(([, val]) => val)
       .join(' / ');

      const img = (p.product_images ?? [])
        .sort((a, b) => a.position - b.position)[0]?.src;

      line_items.push({
        quantity: wanted.get(v.id),
        price_data: {
          currency: 'usd',
          unit_amount: v.price_cents,          // <- from the database, not the browser
          product_data: {
            name: p.title,
            description: label || undefined,
            images: img ? [img] : undefined,
            metadata: { variant_id: v.id }
          }
        }
      });
    }

    const origin = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email || undefined,
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: false },   // flip on once Stripe Tax is configured
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'Standard shipping',
            fixed_amount: { amount: 999, currency: 'usd' },
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 }
            }
          }
        }
      ],
      metadata: {
        artwork_needed: artworkNeeded ? 'true' : 'false',
        cart: JSON.stringify([...wanted].map(([id, q]) => ({ id, q }))).slice(0, 480)
      },
      success_url: `${origin}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: 'Could not start checkout.' });
  }
}
