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
│   └── styles.css             — All styles (brand colors, components, responsive)
├── js/
│   ├── main.js                — Navigation, scroll animations, toast, tabs, accordion
│   ├── pricing.js             — Live pricing calculators (DTF, gang sheets, t-shirts)
│   ├── upload.js              — Drag-and-drop file upload with preview
│   └── gang-sheet-builder.js  — Canvas-based interactive gang sheet builder
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

### 2. Set Up Formspree (Email Submissions)
All quote forms use [Formspree](https://formspree.io) to send emails with file attachments.

**To set it up:**
1. Go to [formspree.io](https://formspree.io) and create a free account
2. Create a new form — copy your form endpoint (looks like `https://formspree.io/f/abcdefgh`)
3. Find and replace `YOUR_FORM_ID` across all HTML files:
   - `tshirts.html` — line with `action="https://formspree.io/f/YOUR_FORM_ID"`
   - `dtf-transfers.html` — same
   - `gang-sheet-builder.html` — same
   - `contact.html` — same

> **Note on file attachments:** Formspree's free plan supports form submissions but file attachments require a paid plan (~$8/mo). Alternatively, use [Netlify Forms](https://docs.netlify.com/forms/setup/) which supports file uploads on its free tier when hosted on Netlify.

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

To test form submissions locally without Formspree:
1. Open browser DevTools → Network tab
2. Submit a form
3. You'll see the POST request — verify all fields are populated

For live testing, set up a Formspree account (free tier works for initial testing, no file attachments).

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
- [ ] `YOUR_FORM_ID` replaced in all 4 HTML files
- [ ] Email address updated (`hello@ympressme.com` → your email)
- [ ] Phone number updated
- [ ] Location updated
- [ ] Social media links updated
- [ ] Prices reviewed and adjusted to your actual rates
- [ ] Test a form submission end-to-end
- [ ] Custom domain connected (optional)
