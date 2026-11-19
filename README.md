# YMPRESSME Website

**"Because you look so good when we do!"**

Online store + quote site for YMPRESSME — DFW custom apparel (custom t-shirts, DTF transfers, gang sheets, branded merch).

- Live site: https://ympressme.com (Vercel project `ympressme-website`)
- Owner contact / order inbox: `ympressme@yahoo.com`

> **For AI assistants:** read this whole file before changing anything. The owner is not a developer — explain in plain steps, never ask her to paste secret keys into chat, and always say how to undo a change before touching checkout, payments, or the database.

---

## How it works (the big picture)

```
Customer browses  ──►  shop.html / product.html   (reads products from Supabase)
Adds to cart      ──►  cart.html                   (cart lives in the browser)
Clicks checkout   ──►  /api/create-checkout-session  (re-prices from Supabase, opens Stripe)
Pays on Stripe    ──►  /api/stripe-webhook         (ONLY place an order is marked paid → saved in Supabase)
Lands on          ──►  order-confirmed.html        (emails the order + print-file links to the shop via Web3Forms)
```

| Piece | What it does | Where to manage it |
|---|---|---|
| **GitHub** (this repo) | All site code. Every push to `main` auto-deploys. | github.com |
| **Vercel** | Hosting, the `/api` functions, domain, secret keys | vercel.com → project → Settings |
| **Supabase** | Products, orders, customer accounts, uploaded artwork | supabase.com → project → Table Editor / Storage |
| **Stripe** | Takes payments, pays out to the owner's bank | dashboard.stripe.com |
| **Web3Forms** | Emails quote requests and new-order alerts to the shop | web3forms.com |

---

## Day-to-day: managing products (no code needed)

There is **no custom admin page** — products are edited directly in **Supabase → Table Editor**. Changes show on the site immediately (no deploy).

| Table | What's in it |
|---|---|
| `products` | One row per product: `title`, `handle` (the URL name, e.g. `custom-tee` → `/product.html?handle=custom-tee`), `description`, `status`, `sort_order`, `needs_artwork`, option names (`option1_name` = e.g. "Color", `option2_name` = "Size") |
| `variants` | One row per buyable combo (e.g. Black / XL): `option1`, `option2`, `option3`, **`price_cents`**, `available` |
| `product_images` | Photos: `src` (public image URL), `position` (0 = main photo) |

**Rules to remember**
- **Prices are in cents.** `1499` = $14.99.
- **Hide a product:** set `status` to anything other than `active` (e.g. `draft`). Only `active` products show.
- **Sold out size/color:** set that variant's `available` to `false`.
- **Product order on the shop page:** lower `sort_order` shows first.
- **Customer must upload a design:** set `needs_artwork` to `true`.
- **New product:** add the `products` row first, then its `variants` rows and `product_images` rows pointing to it.
- **Photos:** upload to Supabase Storage (a public bucket), copy the public URL, paste it into `product_images.src`.

## Day-to-day: orders

1. New paid order → email to the shop inbox with "NEW PAID ORDER", the items, ship-to address, and short **print-file links** (`ympressme.com/f/...`) that download the customer's original file.
2. Full record is also in Supabase → `orders` and `order_items`, and in Stripe → Payments.
3. **Stripe is the source of truth for money.** If an email ever doesn't arrive, the order is still in Stripe and Supabase.
4. Refunds are done in Stripe → Payments → the payment → Refund.

## Changing other settings

| To change… | Edit this file |
|---|---|
| Shipping price / delivery days | `js/shipping.js` (`SHIPPING_TIERS`, `DELIVERY_DAYS`) — cart and checkout both read it |
| Quote-calculator prices (DTF sizes, gang sheets, shirt base prices) | `js/pricing.js` |
| Where emails go / Web3Forms key / brand name | `js/site-config.js` |
| Colors / fonts | `css/styles.css` (`:root` variables), `css/store.css`, `css/cinematic.css` (homepage) |
| Page text | the matching `.html` file |

The pricing tables written into `index.html` and `dtf-transfers.html` are plain text — update them by hand when prices change.

---

## Secret keys (Vercel → Settings → Environment Variables)

These are **never** in the code. After changing any of them, redeploy (Vercel → Deployments → ⋯ → Redeploy).

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → the endpoint below → Signing secret (`whsec_...`) |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service role / secret key — server only) |
| `SITE_URL` | `https://ympressme.com` |

**Stripe webhook** must point to `https://ympressme.com/api/stripe-webhook` and listen for **`checkout.session.completed`**.

**Public keys (safe to be in code, by design):** the Supabase URL + publishable/anon key in `js/store.js` and `js/site-config.js`, and the Web3Forms access key in `js/site-config.js`. If the Supabase project or Web3Forms account ever changes, update those two files.

---

## Supabase setup (already done — for reference)

- Tables: `products`, `variants`, `product_images`, `orders`, `order_items`, `profiles`
- Row Level Security: the browser can only read **active** products; orders are only written by the server (webhook) with the service role key.
- Storage bucket `ympressme-uploads` (public) with an anon INSERT policy — customer artwork uploads land in `orders/`.
- Auth: customers sign in with an email code/magic link (`account.html`). In Supabase → Authentication → URL Configuration, the Site URL must be `https://ympressme.com`.

---

## File map

```
index.html, about.html, faq.html, contact.html   — info pages
tshirts.html, dtf-transfers.html                 — service pages + quote forms
gang-sheet-builder.html                          — interactive gang sheet builder
shop.html, product.html, cart.html               — the store
order-confirmed.html                             — thank-you page; sends the order email
account.html                                     — customer login / saved address

api/create-checkout-session.js  — builds the Stripe checkout (prices from DB, never the browser)
api/stripe-webhook.js           — records paid orders in Supabase
api/order-summary.js            — order details for the confirmation email
api/file.js                     — /f/<key> short print-file download links (see vercel.json)

js/store.js        — reads products from Supabase
js/cart.js         — cart + checkout button
js/shipping.js     — shipping rates (single source)
js/pricing.js      — quote calculators
js/artwork.js      — uploads customer designs to Supabase Storage
js/account.js      — customer login
js/site-config.js  — public config (Supabase, Web3Forms, brand)
js/inquiry-submit.js, js/upload.js — quote form submit + file upload
js/gang-sheet-builder.js            — builder logic
js/main.js, js/homepage.js          — nav, animations

process_product_photos.py — old one-time image script, not used by the site
```

---

## Testing after any change

1. Open the Vercel preview link (or live site) and click through: shop → product → add to cart → cart.
2. For checkout changes: place a real order for the cheapest item, confirm (a) the order email arrives, (b) a row appears in Supabase `orders`, (c) the payment shows in Stripe — then **refund it in Stripe**.
3. If something breaks, check in this order: **Vercel → Deployments → Functions/Logs** → **Stripe → Developers → Webhooks → recent deliveries** → **Supabase → Logs**.
4. To undo a bad deploy: Vercel → Deployments → pick the last good one → ⋯ → **Promote to Production**.

## Rules for anyone editing the code

- Never send prices from the browser to checkout — the server must look them up (`api/create-checkout-session.js`).
- Orders are created **only** by the webhook. Don't mark orders paid anywhere else.
- Never put `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in any file in this repo.
- Test checkout end-to-end (and refund) after touching anything in `api/`, `js/cart.js`, or `js/shipping.js`.
