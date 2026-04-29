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
├── css/
│   ├── styles.css             — Light theme (forms, configurator, calculator)
│   └── cinematic.css          — Dark cinematic theme (homepage only)
├── js/
│   ├── main.js                — Navigation, scroll animations, toast, tabs, accordion
│   ├── pricing.js             — Live pricing calculators (DTF, gang sheets, t-shirts)
│   ├── upload.js              — Drag-and-drop file upload with preview
│   ├── gang-sheet-builder.js  — Canvas-based interactive gang sheet builder
│   ├── homepage.js            — Cinematic homepage effects (cursor, parallax, marquee)
│   └── inquiry-submit.js      — Shared form-submit helper (Supabase upload + Web3Forms POST)
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

### 2. Set Up Email Delivery (Supabase Storage + Web3Forms)
All quote forms upload artwork directly to Supabase Storage from the browser, then POST the inquiry (with the Supabase URL) to Web3Forms, which emails it to `ympressme@yahoo.com`. No backend, no serverless functions, no Node deps — pure static site.

**Configuration lives in `js/inquiry-submit.js`** (the Supabase URL, Supabase anon key, bucket name, and Web3Forms access key are baked in — both vendors design these keys to be public).

**One-time Supabase setup:**
1. In your Supabase project (`allstar-prints`) → **Storage** → create bucket `ympressme-uploads` with **Public bucket** ON
2. On that bucket → **Policies** tab → New policy:
   - Operation: **INSERT**
   - Target roles: `anon`
   - WITH CHECK expression: `bucket_id = 'ympressme-uploads'`
   - This allows anonymous browser uploads (otherwise the form will fail at upload time)

**One-time Web3Forms setup:**
1. Sign up at [web3forms.com](https://web3forms.com) using `ympressme@yahoo.com`
2. Copy your access key — paste it into `js/inquiry-submit.js` as `WEB3FORMS_ACCESS_KEY`

> **Why this stack?** Supabase Storage handles files up to 50MB (free tier: 1GB total, 5GB/mo bandwidth). Web3Forms free tier covers 250 submissions/month with built-in spam protection. Zero backend code — Vercel just serves the static files.

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
- [ ] Supabase bucket `ympressme-uploads` created in `allstar-prints` project (public, with anon-INSERT policy)
- [ ] Web3Forms account created and access key set in `js/inquiry-submit.js`
- [ ] Email address in HTML updated (`ympressme@yahoo.com` → current contact email if changed)
- [ ] Phone number updated
- [ ] Location updated
- [ ] Social media links updated
- [ ] Prices reviewed and adjusted to your actual rates
- [ ] Test a form submission end-to-end on the live URL
- [ ] Custom domain connected (optional)
