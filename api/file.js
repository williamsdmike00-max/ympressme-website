// GET /f/<key>  (rewritten to /api/file?k=<key>)
// Short, email-friendly link to a customer's print file. <key> is the
// "<timestamp>-<random>" prefix every upload gets in js/artwork.js. Redirects
// to the original file in Supabase Storage (byte-for-byte what was uploaded)
// and makes it download with its original name.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'ympressme-uploads';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const key = String(req.query.k || '');
  if (!/^\d{10,16}-[a-z0-9]{3,10}$/.test(key)) {
    return res.status(400).send('Bad file link.');
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('orders', { search: key, limit: 5 });
  const hit = (data || []).find(f => f.name.startsWith(key + '-'));
  if (error || !hit) return res.status(404).send('File not found.');

  const path = 'orders/' + hit.name;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path, {
    download: hit.name.slice(key.length + 1) || true
  });
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: pub.publicUrl });
  res.end();
}
