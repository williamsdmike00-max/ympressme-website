# YMPRESSME Website

**"Because you look so good when we do!"**

A complete, production-ready custom t-shirt printing and DTF transfer website.

---

## File Structure

```
Ympressme website/
├── index.html                 — Homepage
├── tshirts.html               — Custom T-Shirt Printing + quote form
├── dtf-transfers.html         — DTF Transfers (single-size + gang sheets) + quote form
├── gang-sheet-builder.html    — Interactive gang sheet builder + quote form
├── about.html                 — About page
├── faq.html                   — FAQ (accordion)
├── contact.html               — General contact + quote form
├── package.json               — Declares @vercel/blob + resend deps for serverless functions
├── api/
│   ├── upload-token.js        — Issues Vercel Blob upload tokens for direct browser uploads
│   └── send-inquiry.js        — Receives form data + Blob URLs, emails inquiry via Resend
├── css/
│   ├── styles.css             — Light theme (forms, configurator, calculator)
│   └── cinematic.css          — Dark cinematic theme (homepage only)
├── js/
│   ├── main.js                — Navigation, scroll animations, toast, tabs, accordion
│   ├── pricing.js             — Live pricing calculators (DTF, gang sheets, t-shirts)
│   ├── upload.js              — Drag-and-drop file upload with preview
│   ├── gang-sheet-builder.js  — Canvas-based interactive gang sheet builder
│   ├── homepage.js            — Cinematic homepage effects (cursor, parallax, marquee)
│   └── inquiry-submit.js      — Shared form-submit helper (Blob upload + JSON to /api)
└── assets/
    └── logo.png               — YMPRESSME logo (place your file here)
```

---

## Setup (5 Steps)

### 1. Add Your Logo
Place your logo PNG file at:
```
assets/logo.png
```
It's referenced throughout the site as `assets/logo.png`.

### 2. Set Up Email Delivery (Vercel + Resend + Blob)
All quote forms POST to a Vercel serverless function (`api/send-inquiry`). Files are uploaded directly from the browser to Vercel Blob storage and emailed as download links via Resend.

**One-time setup (Vercel project dashboard):**
1. **Enable Vercel Blob:** Storage tab → Create Blob store → Vercel auto-creates `BLOB_READ_WRITE_TOKEN`
2. **Create Resend account** at [resend.com](https://resend.com) using the email address you want inquiries to land in. Generate an API key.
3. **Add Vercel environment variables** (Settings → Environment Variables):
   - `RESEND_API_KEY` — paste your Resend API key
   - `INQUIRY_TO_EMAIL` — the inbox where inquiries should arrive (must match the email you signed up for Resend with, until a custom domain is verified)
   - *(Optional)* `INQUIRY_FROM_ADDRESS` — defaults to `YMPRESSME Inquiries <onboarding@resend.dev>`. Override only after verifying a domain in Resend.
4. **Redeploy** (push any commit, or click "Redeploy" in the dashboard) so the env vars take effect.

> **Why this stack?** Vercel Blob handles files up to the 50MB form cap (bypasses Vercel's 4.5MB function body limit). Resend free tier covers 3,000 emails/month. No third-party form middleware required.

### 3. Update Contact Info
Search for and replace these placeholders across all HTML files:
| Placeholder | Replace With |
|---|---|
| `hello@ympressme.com` | Your actual email |
| `(555) 123-4567` | Your phone number |
| `Your City, State` | Your location |

### 4. Update Social Media Links
In `contact.html` and `index.html`, find the social link `href="#"` anchors and replace with your actual Instagram, Facebook, and TikTok URLs.

### 5. Deploy
The site is 100% static — no server needed. Deploy to any of these for free:

**Netlify (Recommended)**
1. Drag and drop the entire `Ympressme website/` folder to [app.netlify.com](https://app.netlify.com)
2. Your site is live in ~30 seconds
3. Connect a custom domain in Netlify settings

**GitHub Pages**
1. Push to a GitHub repo
2. Enable GitHub Pages in Settings → Pages

**Vercel**
1. Import your GitHub repo at [vercel.com](https://vercel.com)
2. Zero config needed for static sites

---

## Customizing Prices

All pricing is centralized in `js/pricing.js`. To update prices:

**DTF Single-Size Transfers** — edit `DTF_SIZES` object (~line 18):
```js
'4x4': {
  pricePerUnit: [2.50, 2.00, 1.75, 1.50, 1.25, 1.00], // tiers: 1-5, 6-11, 12-23, 24-47, 48-99, 100+
}
```

**Gang Sheet Prices** — edit `GANG_SHEETS` object (~line 72):
```js
'22x36': { price: 28.00, ... }
```

**T-Shirt Base Prices** — edit `SHIRT_TYPES` object (~line 90):
```js
'gildan5000': { basePrice: 14.00 }
```

The pricing table in `index.html` and `dtf-transfers.html` is static HTML — update those manually to match.

---

## Brand Colors (CSS Variables)

Defined in `css/styles.css` at the top of `:root {}`:

```css
--primary:   #007bff;   /* Primary Blue */
--accent:    #ff69b4;   /* Accent Pink */
--secondary: #0056b3;   /* Secondary Blue (darker) */
--white:     #ffffff;
--dark:      #0d1b2a;   /* Dark navy (nav, footer) */
```

---

## Gang Sheet Builder

The interactive builder (`gang-sheet-builder.html` + `js/gang-sheet-builder.js`) works entirely in the browser — no server needed.

**How customers use it:**
1. Select sheet size (13×19, 22×24, or 22×36)
2. Select a transfer size from the left panel
3. Click anywhere on the canvas to place a design
4. Drag placed designs to reposition them
5. The fill meter shows % of sheet used
6. Click "Add to Quote" to populate the order form below
7. Upload design files and submit

**Builder features:**
- Canvas scales to fit mobile/tablet/desktop
- Touch support for mobile users
- Overlap detection (turns red when designs overlap)
- Fill percentage meter
- Per-design remove button
- Clear all button

---

## Testing the Forms

The forms only work end-to-end on a deployed Vercel preview/production (the Blob upload + email serverless functions need to actually run). Local `python -m http.server` will load the pages but submit attempts will fail.

**Live testing (after deploy):**
1. Visit a form page on the deployed URL (e.g., `https://ympressme-website.vercel.app/contact.html`)
2. Fill it out, attach a small test PNG, submit
3. Confirm the email lands in `INQUIRY_TO_EMAIL` within ~30 seconds with a download link to the artwork
4. Check Vercel function logs (Project → Functions tab) if anything fails — they'll show what went wrong

---

## Browser Support

Tested and working in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Chrome / Safari (iOS 14+, Android 10+)

---

## Quick Checklist Before Going Live

- [ ] Logo added to `assets/logo.png`
- [ ] Vercel Blob enabled (Storage tab in Vercel project)
- [ ] `RESEND_API_KEY` env var set in Vercel
- [ ] `INQUIRY_TO_EMAIL` env var set in Vercel (must match Resend signup email)
- [ ] Email address in HTML updated (`ympressme@yahoo.com` → current contact email if changed)
- [ ] Phone number updated
- [ ] Location updated
- [ ] Social media links updated
- [ ] Prices reviewed and adjusted to your actual rates
- [ ] Test a form submission end-to-end on the live URL
- [ ] Custom domain connected (optional)
