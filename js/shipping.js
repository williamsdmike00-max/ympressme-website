/* Shipping rates — the ONE place to change them.
   Used by the cart (to show the customer) and by the checkout API
   (to actually charge). Both read this file, so they can't disagree.

   Rates go up by total item count in the cart. Each tier applies when the
   cart has at most `maxItems` items; the last tier catches everything else.

   Right now every order ships at $9.99 (Cassandra: "match USPS").
   To add quantity tiers, add rows above the last one, e.g.
     { maxItems: 10,       cents: 999,  label: 'Standard shipping' },
     { maxItems: 25,       cents: 1499, label: 'Standard shipping' },
     { maxItems: Infinity, cents: 1999, label: 'Standard shipping' },
*/

export const SHIPPING_TIERS = [
  { maxItems: Infinity, cents: 999, label: 'Standard shipping (USPS)' },
];

export const DELIVERY_DAYS = { min: 5, max: 10 };   // business days

export function shippingFor(totalItems) {
  const n = Math.max(0, Number(totalItems) || 0);
  return SHIPPING_TIERS.find(t => n <= t.maxItems) || SHIPPING_TIERS[SHIPPING_TIERS.length - 1];
}
