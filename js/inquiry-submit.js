/**
 * Shared form-submission helper. Loaded as <script type="module">.
 * Per-site config (Supabase + Web3Forms keys) lives in js/site-config.js.
 *
 * Architecture (no backend, no Vercel functions):
 *  1. Customer uses Uppy's Dashboard widget (local files + webcam) to
 *     pick artwork. Files stay in Uppy's memory client-side.
 *  2. On form submit, each Uppy file is uploaded directly to Supabase
 *     Storage (public bucket; URLs are unguessable; bucket has anon
 *     INSERT policy).
 *  3. Form fields + Supabase URLs are POSTed to Web3Forms, which emails
 *     the inquiry to the recipient configured on the access key.
 *
 * Exposes:
 *   window.YMP.submitInquiry({...}) — submit a form
 *   window.YMP.getUppyFiles(mountId) — File[] currently picked in an Uppy
 *
 * Phase 2 (future): add Uppy's Url + GoogleDrive + Dropbox plugins +
 * deploy a Companion server to unlock cloud-source uploads.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Uppy from 'https://esm.sh/@uppy/core@4.2.3';
import Dashboard from 'https://esm.sh/@uppy/dashboard@4.1.2';
import Webcam from 'https://esm.sh/@uppy/webcam@4.1.0';
import { SITE_CONFIG } from './site-config.js';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const ALLOWED_TYPES = ['.png', '.jpg', '.jpeg', '.svg', '.pdf', '.zip', 'image/*', 'application/pdf', 'application/zip'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const supabase = createClient(SITE_CONFIG.supabaseUrl, SITE_CONFIG.supabaseAnonKey);

window.YMP = window.YMP || {};
window.YMP._uppyRegistry = new Map();

/**
 * Mount an Uppy Dashboard widget on a target element.
 * Called for every <div class="ymp-upload" id="..."> on the page.
 */
function mountUppy(mountEl) {
  const mountId = mountEl.id;
  if (!mountId) return;
  const maxFilesRaw = parseInt(mountEl.dataset.maxFiles, 10);
  // null = unlimited in Uppy's restrictions; default to a generous 20
  const maxFiles = Number.isFinite(maxFilesRaw) && maxFilesRaw > 0 ? maxFilesRaw : 20;
  const required = mountEl.dataset.required === 'true';
  const note = mountEl.dataset.note ||
    'Add multiple files at once — drag-drop, browse, or use your camera. Max 50MB per file.';

  const uppy = new Uppy({
    id: mountId,
    autoProceed: false,
    restrictions: {
      maxFileSize: MAX_FILE_SIZE,
      maxNumberOfFiles: maxFiles,
      allowedFileTypes: ALLOWED_TYPES,
    },
  })
    .use(Dashboard, {
      target: '#' + mountId,
      inline: true,
      width: '100%',
      height: 420,
      proudlyDisplayPoweredByUppy: false,
      showProgressDetails: true,
      hideUploadButton: true,
      hideRetryButton: true,
      hideCancelButton: true,
      hideProgressAfterFinish: true,
      singleFileFullScreen: false,
      note: note,
      doneButtonHandler: null,
    })
    .use(Webcam, {
      target: Dashboard,
      modes: ['picture'],
      mirror: true,
      showRecordingLength: false,
    });

  window.YMP._uppyRegistry.set(mountId, uppy);
  if (required) mountEl.dataset.required = 'true';

  // Defensive: any button Uppy renders inside a <form> defaults to
  // type="submit" if missing the type attribute, which triggers form
  // submission on click (instead of opening the file picker, etc.).
  // Force type="button" on every button Uppy renders, including ones
  // re-rendered later as files are added/removed.
  function fixButtonTypes() {
    mountEl.querySelectorAll('button:not([type])').forEach(function (btn) {
      btn.setAttribute('type', 'button');
    });
  }
  fixButtonTypes();
  const observer = new MutationObserver(fixButtonTypes);
  observer.observe(mountEl, { childList: true, subtree: true });
}

/** Retrieve the picked files (as native File objects) from an Uppy mount. */
window.YMP.getUppyFiles = function (mountId) {
  const uppy = window.YMP._uppyRegistry.get(mountId);
  if (!uppy) return [];
  return uppy.getFiles().map(function (uppyFile) {
    const data = uppyFile.data;
    if (data instanceof File) return data;
    return new File([data], uppyFile.name || 'upload', { type: uppyFile.type || 'application/octet-stream' });
  });
};

/** Clear all files from an Uppy mount (used after successful submit). */
window.YMP.clearUppyFiles = function (mountId) {
  const uppy = window.YMP._uppyRegistry.get(mountId);
  if (uppy) uppy.cancelAll();
};

/** Initialize all Uppy mounts present in the DOM at load time. */
function initAllUppyMounts() {
  document.querySelectorAll('.ymp-upload').forEach(mountUppy);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllUppyMounts);
} else {
  initAllUppyMounts();
}

/** Upload a single File to Supabase Storage; returns { url, path } */
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
  const safeFiles = (files || []).filter(Boolean);

  for (const f of safeFiles) {
    const file = (f && f.file) ? f.file : f;
    const label = (f && f.label) ? f.label : (file.name || 'Artwork');
    if (!file) continue;
    const result = await window.YMP.uploadToStorage(file);
    if (result && result.url) {
      uploaded.push({ url: result.url, label, size: file.size });
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
