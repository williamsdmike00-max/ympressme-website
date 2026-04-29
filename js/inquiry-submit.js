/**
 * YMPRESSME — inquiry-submit.js
 * Shared form-submission helper. Loaded as <script type="module">.
 *
 * Architecture (no backend, no Vercel functions):
 *  1. Customer-uploaded artwork files go directly to Supabase Storage
 *     (public bucket; URLs are unguessable; bucket has anon-INSERT policy).
 *  2. Form fields + Supabase URLs are POSTed to Web3Forms, which emails
 *     the inquiry to ympressme@yahoo.com with reply-to set to the customer.
 *
 * Exposes window.YMP.submitInquiry({...}) for the inline submit handlers
 * on contact.html, tshirts.html, dtf-transfers.html, gang-sheet-builder.html.
 *
 * The Supabase anon key and Web3Forms access key embedded below are
 * intentionally public — both vendors design these to live in client-side
 * code. Spam protection is the bucket's INSERT policy + Web3Forms' built-in
 * rate limiting + the honeypot field on each form.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = 'https://dgsdftbkpxpfhttgwhze.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc2RmdGJrcHhwZmh0dGd3aHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjMxODksImV4cCI6MjA5MjUzOTE4OX0.Xa4_CzSG1LUd4LJKhS4EoHqJ7uYFH9djwevPP87CCvI';
const SUPABASE_BUCKET = 'ympressme-uploads';
const WEB3FORMS_ACCESS_KEY = '75800229-122a-4a3f-858e-97cea5809fe5';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.YMP = window.YMP || {};

window.YMP.uploadToStorage = async function (file) {
  if (!file) return null;
  const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `inquiries/${Date.now()}-${rand}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data: urlData } = supabase.storage
    .from(SUPABASE_BUCKET)
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
  payload.append('access_key', WEB3FORMS_ACCESS_KEY);
  payload.append('subject', subject || ('New ' + formType + ' — YMPRESSME'));
  payload.append('from_name', 'YMPRESSME Website');
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
    uploaded.forEach((f, i) => {
      const sizeStr = f.size ? ' (' + formatSize(f.size) + ')' : '';
      payload.append('File ' + (i + 1) + ' — ' + f.label, f.url + sizeStr);
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
