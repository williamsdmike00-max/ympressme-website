import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.INQUIRY_TO_EMAIL;
  const fromAddress = process.env.INQUIRY_FROM_ADDRESS || 'YMPRESSME Inquiries <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    console.error('Missing env vars: RESEND_API_KEY or INQUIRY_TO_EMAIL');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const body = req.body || {};
  const { formType, subject, fields, fileUrls, replyTo, honeypot } = body;

  if (honeypot && String(honeypot).trim()) {
    return res.status(200).json({ ok: true });
  }

  if (!formType || !fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'Missing formType or fields' });
  }

  const resend = new Resend(apiKey);

  const fieldRows = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => {
      const value = escapeHtml(String(v)).replace(/\n/g, '<br/>');
      return (
        '<tr>' +
        '<td style="padding:8px 12px;background:#f7f7f9;border:1px solid #e0e0e6;font-weight:600;vertical-align:top;width:38%;">' +
        escapeHtml(k) +
        '</td>' +
        '<td style="padding:8px 12px;border:1px solid #e0e0e6;">' +
        value +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const fileLinks = (Array.isArray(fileUrls) ? fileUrls : [])
    .filter((f) => f && f.url)
    .map((f) => {
      const sizeStr = f.size ? ' &middot; ' + formatSize(f.size) : '';
      return (
        '<li style="margin-bottom:6px;">' +
        '<a href="' +
        escapeHtml(f.url) +
        '" style="color:#007bff;font-weight:600;">' +
        escapeHtml(f.label || 'Download file') +
        '</a>' +
        '<span style="color:#666;font-size:0.85rem;">' +
        sizeStr +
        '</span>' +
        '</li>'
      );
    })
    .join('');

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">' +
    '<h2 style="border-bottom:3px solid #007bff;padding-bottom:8px;margin-top:0;">' +
    escapeHtml(subject || 'New YMPRESSME Inquiry') +
    '</h2>' +
    '<p style="color:#555;margin-top:0;"><strong>Form:</strong> ' +
    escapeHtml(formType) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:0.92rem;">' +
    fieldRows +
    '</table>' +
    (fileLinks
      ? '<h3 style="margin-bottom:8px;">Attached Files</h3>' +
        '<ul style="padding-left:20px;">' +
        fileLinks +
        '</ul>' +
        '<p style="font-size:0.82rem;color:#666;">Click any link to download the customer&rsquo;s artwork. Links remain active.</p>'
      : '<p style="color:#888;"><em>No artwork attached.</em></p>') +
    (replyTo
      ? '<p style="margin-top:24px;padding:12px;background:#f0f8ff;border-left:4px solid #007bff;font-size:0.9rem;">' +
        '&#x1F4AC; <strong>Reply directly</strong> to this email and your message will go straight to ' +
        escapeHtml(replyTo) +
        '.</p>'
      : '') +
    '<hr style="margin-top:32px;border:none;border-top:1px solid #e0e0e6;"/>' +
    '<p style="font-size:0.78rem;color:#999;">Sent from the YMPRESSME website inquiry system.</p>' +
    '</div>';

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      replyTo: replyTo || undefined,
      subject: subject || ('New ' + formType + ' — YMPRESSME'),
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return res.status(500).json({ error: result.error.message || 'Email send failed' });
    }

    return res.status(200).json({ ok: true, id: result.data?.id });
  } catch (err) {
    console.error('send-inquiry exception:', err);
    return res.status(500).json({ error: err?.message || 'Email send failed' });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
