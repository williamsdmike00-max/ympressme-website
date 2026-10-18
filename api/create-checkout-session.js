// POST /api/create-checkout-session
// The browser sends ONLY variant ids + quantities. Never a price.
// Prices are re-read from Supabase here, server-side. This is the whole
// reason this endpoint exists — a static page cannot be trusted with money.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { shippingFor, DELIVERY_DAYS } from '../js/shipping.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // service role: server only, never shipped to the browser
);

const MAX_QTY = 500;

// Artwork must live in our own upload bucket. Anything else is rejected, so
// nobody can push an arbitrary link through to the print queue.
const ARTWORK_PREFIX =
  `${process.env.SUPABASE_URL}/storage/v1/object/public/ympressme-uploads/`;
const okArtwork = u => typeof u === 'string' && u.length <= 450 && u.startsWith(ARTWORK_PREFIX);
const clip = (s, n) => (typeof s === 'string' ? s.replace(/[\r\n]+/g, ' ').slice(0, n) : '');

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
    // Lines are keyed by variant + artwork, so two different gang sheets
    // stay two separate lines (each with its own print file).
    const lines = new Map();
    for (const it of items) {
      const id = String(it?.variant_id ?? '');
      const qty = Number.parseInt(it?.quantity, 10);
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: 'Bad variant id' });
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return res.status(400).json({ error: 'Bad quantity' });
      }
      let artwork = null;
      if (it.artwork_url != null) {
        if (!okArtwork(it.artwork_url)) {
          return res.status(400).json({ error: 'Bad artwork link. Please re-upload your design.' });
        }
        artwork = {
          url: it.artwork_url,
          name: clip(it.artwork_name, 120) || 'artwork',
          preview_url: okArtwork(it.preview_url) ? it.preview_url : '',
          note: clip(it.note, 450),
        };
      }
      const key = artwork ? id + '|' + artwork.url : id;
      const prev = lines.get(key);
      if (prev) prev.qty = Math.min(MAX_QTY, prev.qty + qty);
      else lines.set(key, { id, qty, artwork });
    }
    const wanted = new Set([...lines.values()].map(l => l.id));

    // ---- signed-in customer? (optional) ----
    let user = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(auth.slice(7));
      user = data?.user ?? null;
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
      .in('id', [...wanted]);

    if (error) throw error;

    if (!variants || variants.length !== wanted.size) {
      return res.status(409).json({
        error: 'Some items are no longer available. Please refresh your cart.'
      });
    }

    const byId = new Map(variants.map(v => [v.id, v]));
    let artworkNeeded = false;
    let totalItems = 0;
    const line_items = [];

    for (const line of lines.values()) {
      const v = byId.get(line.id);
      const p = v.products;
      if (!p || p.status !== 'active' || v.available === false) {
        return res.status(409).json({
          error: `"${p?.title ?? 'An item'}" is no longer available.`
        });
      }
      if (p.needs_artwork && !line.artwork) artworkNeeded = true;
      totalItems += line.qty;

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

      const description = [label, line.artwork ? `Your design: ${line.artwork.name}` : '']
        .filter(Boolean).join(' · ');

      const metadata = { variant_id: v.id };
      if (line.artwork) {
        metadata.artwork_url = line.artwork.url;
        if (line.artwork.preview_url) metadata.preview_url = line.artwork.preview_url;
        if (line.artwork.note) metadata.note = line.artwork.note;
      }

      line_items.push({
        quantity: line.qty,
        price_data: {
          currency: 'usd',
          unit_amount: v.price_cents,          // <- from the database, not the browser
          product_data: {
            name: p.title,
            description: description || undefined,
            images: line.artwork?.preview_url ? [line.artwork.preview_url] : (img ? [img] : undefined),
            metadata
          }
        }
      });
    }

    const ship = shippingFor(totalItems);

    // Signed-in customers: reuse one Stripe customer so name, phone and
    // address are pre-filled, and new addresses get saved for next time.
    let stripeCustomer = null;
    if (user) {
      try {
        const { data: prof } = await supabase.from('profiles')
          .select('full_name, phone, address, stripe_customer_id').eq('id', user.id).maybeSingle();
        const a = prof?.address || {};
        const hasAddr = a.line1 && a.city && a.state && a.postal_code;
        const details = {
          email: user.email,
          name: prof?.full_name || undefined,
          phone: prof?.phone || undefined,
          metadata: { supabase_user_id: user.id },
          ...(hasAddr ? { shipping: {
            name: prof.full_name || user.email,
            phone: prof.phone || undefined,
            address: { line1: a.line1, line2: a.line2 || undefined, city: a.city,
                       state: a.state, postal_code: a.postal_code, country: 'US' }
          } } : {})
        };
        if (prof?.stripe_customer_id) {
          stripeCustomer = (await stripe.customers.update(prof.stripe_customer_id, details)).id;
        } else {
          stripeCustomer = (await stripe.customers.create(details)).id;
          await supabase.from('profiles').upsert({ id: user.id, stripe_customer_id: stripeCustomer });
        }
      } catch (e) {
        console.warn('stripe customer link skipped:', e.message);   // checkout still works as guest
        stripeCustomer = null;
      }
    }

    const origin = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      ...(stripeCustomer
        ? { customer: stripeCustomer, customer_update: { name: 'auto', shipping: 'auto', address: 'auto' } }
        : { customer_email: user?.email || email || undefined }),
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: false },   // flip on once Stripe Tax is configured
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: ship.label,
            fixed_amount: { amount: ship.cents, currency: 'usd' },
            delivery_estimate: {
              minimum: { unit: 'business_day', value: DELIVERY_DAYS.min },
              maximum: { unit: 'business_day', value: DELIVERY_DAYS.max }
            }
          }
        }
      ],
      metadata: {
        artwork_needed: artworkNeeded ? 'true' : 'false',
        user_id: user?.id || '',
        cart: JSON.stringify([...lines.values()].map(l => ({ id: l.id, q: l.qty, a: l.artwork ? 1 : 0 }))).slice(0, 480)
      },
      success_url: `${origin}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}${artworkNeeded ? '&artwork=1' : ''}`,
      cancel_url: `${origin}/cart.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: 'Could not start checkout.' });
  }
}
