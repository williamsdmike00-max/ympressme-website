/* Upload customer artwork (or a generated print file) to Supabase Storage
   and return its public link. The checkout API only accepts links from
   this bucket, so this is the one way artwork gets onto an order. */

import { sb } from './store.js';

const BUCKET = 'ympressme-uploads';
const MAX_BYTES = 50 * 1024 * 1024;   // bucket limit

export const ARTWORK_ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.svg,.pdf';

export async function uploadArtwork(fileOrBlob, name, folder = 'orders') {
  if (!fileOrBlob) throw new Error('No file to upload.');
  if (fileOrBlob.size > MAX_BYTES) {
    throw new Error('That file is over 50 MB. Please use a smaller file or contact us.');
  }
  const base = (name || fileOrBlob.name || 'artwork').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${folder}/${Date.now()}-${rand}-${base}`;
  const { data, error } = await sb.storage.from(BUCKET).upload(path, fileOrBlob, {
    contentType: fileOrBlob.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

/* Small JPEG/PNG thumbnail for the cart and the Stripe page. */
export async function makeThumbnail(fileOrBlob, maxPx = 600) {
  if (!/^image\/(png|jpeg|webp)$/.test(fileOrBlob.type || '')) return null;
  const url = URL.createObjectURL(fileOrBlob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/png'));
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}
