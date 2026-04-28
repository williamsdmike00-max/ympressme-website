/**
 * YMPRESSME — inquiry-submit.js
 * Shared form-submission helper. Loaded as <script type="module">.
 *
 * Flow per form:
 *  1. Files are uploaded directly from the browser to Vercel Blob (bypasses
 *     the 4.5MB function body limit; supports up to 50MB).
 *  2. Form fields + Blob URLs are POSTed as JSON to /api/send-inquiry.
 *  3. The serverless function emails the inquiry + downloadable file links
 *     to the YMPRESSME inbox via Resend.
 *
 * Exposes window.YMP.submitInquiry({...}) for the inline form handlers
 * on contact.html, tshirts.html, dtf-transfers.html, gang-sheet-builder.html.
 */

import { upload } from 'https://esm.sh/@vercel/blob@0.27.3/client';

window.YMP = window.YMP || {};

window.YMP.uploadToBlob = async function (file) {
  if (!file) return null;
  const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `inquiries/${Date.now()}-${safeName}`;
  const result = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload-token',
    contentType: file.type || undefined,
  });
  return result;
};

window.YMP.submitInquiry = async function ({ formType, subject, fields, files, replyTo, honeypot }) {
  const fileUrls = [];
  const safeFiles = (files || []).filter((f) => f && f.file);

  for (const f of safeFiles) {
    const blob = await window.YMP.uploadToBlob(f.file);
    if (blob && blob.url) {
      fileUrls.push({
        url: blob.url,
        label: f.label || f.file.name,
        size: f.file.size,
      });
    }
  }

  const res = await fetch('/api/send-inquiry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      formType: formType || 'Inquiry',
      subject: subject || null,
      fields: fields || {},
      fileUrls,
      replyTo: replyTo || null,
      honeypot: honeypot || '',
    }),
  });

  if (!res.ok) {
    let msg = 'Submission failed';
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return await res.json();
};

window.YMP.ready = true;
window.dispatchEvent(new Event('ymp-ready'));
