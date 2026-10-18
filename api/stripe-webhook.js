// POST /api/stripe-webhook
// Stripe calls this. It is the ONLY place an order is marked paid — never the
// browser, never the success page. A customer can close the tab mid-redirect
// and the order still lands here.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stripe signs the RAW body. Vercel's JSON parser would corrupt the signature.
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(
      buf,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    // Unsigned or tampered request. Do not touch the database.
    console.error('signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  try {
    // Idempotency: Stripe retries. Same session must never create two orders.
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (existing) return res.status(200).json({ received: true, duplicate: true });

    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price.product']
    });

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        email: full.customer_details?.email,
        phone: full.customer_details?.phone,
        status: 'paid',
        stripe_session_id: full.id,
        stripe_payment_intent: full.payment_intent,
        subtotal_cents: full.amount_subtotal ?? 0,
        shipping_cents: full.shipping_cost?.amount_total ?? 0,
        tax_cents: full.total_details?.amount_tax ?? 0,
        total_cents: full.amount_total ?? 0,
        shipping_address: full.collected_information?.shipping_details
                          ?? full.customer_details?.address
                          ?? null,
        artwork_needed: full.metadata?.artwork_needed === 'true',
        user_id: /^[0-9a-f-]{36}$/i.test(full.metadata?.user_id || '') ? full.metadata.user_id : null,
        customer_name: full.customer_details?.name ?? null,
        paid_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (orderErr) throw orderErr;

    const items = (full.line_items?.data ?? []).map(li => ({
      order_id: order.id,
      variant_id: li.price?.product?.metadata?.variant_id ?? null,
      product_title: li.price?.product?.name ?? li.description ?? 'Item',
      variant_label: li.price?.product?.description ?? null,
      quantity: li.quantity ?? 1,
      unit_price_cents: li.price?.unit_amount ?? 0,
      artwork_url: li.price?.product?.metadata?.artwork_url ?? null,
      preview_url: li.price?.product?.metadata?.preview_url ?? null,
      note: li.price?.product?.metadata?.note ?? null
    }));

    if (items.length) {
      const { error: itemErr } = await supabase.from('order_items').insert(items);
      if (itemErr) throw itemErr;
    }

    // Signed-in customer with no saved address yet? Save this one for next time.
    const uid = /^[0-9a-f-]{36}$/i.test(full.metadata?.user_id || '') ? full.metadata.user_id : null;
    const shipTo = full.collected_information?.shipping_details ?? full.shipping_details;
    if (uid && shipTo?.address?.line1) {
      const { data: prof } = await supabase.from('profiles').select('address').eq('id', uid).maybeSingle();
      if (!prof?.address?.line1) {
        const ad = shipTo.address;
        await supabase.from('profiles').upsert({
          id: uid,
          full_name: shipTo.name || full.customer_details?.name || null,
          phone: full.customer_details?.phone || null,
          address: { line1: ad.line1, line2: ad.line2 || '', city: ad.city, state: ad.state,
                     postal_code: ad.postal_code, country: ad.country || 'US' },
          updated_at: new Date().toISOString()
        });
      }
    }

    return res.status(200).json({ received: true, order_id: order.id });
  } catch (err) {
    // Non-2xx makes Stripe retry, which is what we want on a transient failure.
    console.error('webhook processing failed:', err);
    return res.status(500).json({ error: 'processing failed' });
  }
}
