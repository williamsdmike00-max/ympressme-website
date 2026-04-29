/**
 * Shared form-submission helper. Loaded as <script type="module">.
 * Per-site config (Supabase + Web3Forms keys) lives in js/site-config.js —
 * that's the file to edit when cloning this stack for a new client.
 *
 * Architecture (no backend, no Vercel functions):
 *  1. Customer-uploaded artwork files go directly to Supabase Storage
 *     (public bucket; URLs are unguessable; bucket has anon-INSERT policy).
 *  2. Form fields + Supabase URLs are POSTed to Web3Forms, which emails
 *     the inquiry to the recipient configured on the access key, with
 *     reply-to set to the customer's email.
 *
 * Exposes window.YMP.submitInquiry({...}) for the inline submit handlers
 * on contact.html, tshirts.html, dtf-transfers.html, gang-sheet-builder.html.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SITE_CONFIG } from './site-config.js';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

const supabase = createClient(SITE_CONFIG.supabaseUrl, SITE_CONFIG.supabaseAnonKey);

window.YMP = window.YMP || {};

window.YMP.uploadToStorage = async function (file) {
  if (!file) return null;
  const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `inquiries/${Date.now()}-${rand}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(SITE_CONFIG.supabaseBucket)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data: urlData } = supabase.storage
    .from(SITE_CONFIG.supabaseBucket)
    .getPublicUrl(data.path);
  return { url: urlData.publicUrl, path: data.path };
};

window.YMP.submitInquiry = async function ({ formType, subject, fields, files, replyTo, honeypot }) {
  const uploaded = [];
  const safeFiles = (files || []).filter((f) => f && f.file);

  for (const f of safeFiles) {
    const result = await window.YMP.uploadToStorage(f.file);
    if (result && result.url) {
      uploaded.push({
        url: result.url,
        label: f.label || f.file.name,
        size: f.file.size,
      });
    }
  }

  const payload = new FormData();
  payload.append('access_key', SITE_CONFIG.web3formsAccessKey);
  payload.append('subject', subject || ('New ' + formType + ' — ' + SITE_CONFIG.brandName));
  payload.append('from_name', SITE_CONFIG.fromName);
  if (replyTo) payload.append('email', replyTo);
  payload.append('botcheck', honeypot || '');
  payload.append('Form Type', formType || 'Inquiry');

  for (const [k, v] of Object.entries(fields || {})) {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      payload.append(k, String(v));
    }
  }

  if (uploaded.length === 0) {
    payload.append('Attached Files', 'None');
  } else {
    // Each artwork gets two fields so the URL sits alone on its line —
    // that lets Yahoo / Outlook / Gmail auto-linkify it as a clickable link.
    uploaded.forEach((f, i) => {
      const num = i + 1;
      const sizeStr = f.size ? ' (' + formatSize(f.size) + ')' : '';
      payload.append('Artwork ' + num + ' Filename', f.label + sizeStr);
      payload.append('Artwork ' + num + ' Link', f.url);
    });
  }

  const res = await fetch(WEB3FORMS_ENDPOINT, {
    method: 'POST',
    body: payload,
  });

  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON response */ }

  if (!res.ok || (json && json.success === false)) {
    const msg = (json && (json.message || json.error)) || 'Submission failed';
    throw new Error(msg);
  }
  return json || { success: true };
};

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

window.YMP.ready = true;
window.dispatchEvent(new Event('ymp-ready'));
