// GET /api/order-summary?session_id=cs_...
// Returns what the shop owner needs to print a PAID order: items, print-file
// links, notes, and where to ship. Used by the confirmation page to email the
// order to the shop. Unpaid or unknown sessions get nothing.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const id = String(req.query.session_id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'Bad session id' });
  }

  try {
    const s = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price.product']
    });
    if (s.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Not paid' });
    }

    const ship = s.collected_information?.shipping_details ?? s.shipping_details ?? null;
    const a = ship?.address ?? s.customer_details?.address ?? {};

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      order_ref: s.id.slice(-10).toUpperCase(),
      name: ship?.name || s.customer_details?.name || '',
      email: s.customer_details?.email || '',
      phone: s.customer_details?.phone || '',
      ship_to: [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(' ')]
        .filter(Boolean).join(', '),
      total: (s.amount_total ?? 0) / 100,
      shipping: (s.shipping_cost?.amount_total ?? 0) / 100,
      items: (s.line_items?.data ?? []).map(li => ({
        title: li.price?.product?.name ?? li.description ?? 'Item',
        details: li.price?.product?.description ?? '',
        quantity: li.quantity ?? 1,
        artwork_url: li.price?.product?.metadata?.artwork_url ?? '',
        preview_url: li.price?.product?.metadata?.preview_url ?? '',
        note: li.price?.product?.metadata?.note ?? ''
      }))
    });
  } catch (err) {
    console.error('order-summary error:', err.message);
    return res.status(404).json({ error: 'Order not found' });
  }
}
