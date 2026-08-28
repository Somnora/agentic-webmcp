# Agentic Offer Protocol (hackathon kernel)

This is the shared model for turning a real website into something an agent can use.
It is not a scraper manifesto. It is a compiler: one offer graph, several projections.

Do not invent a second product per vertical. Retail, wholesale, and travel fill the same types.

## Why this exists

The demo presents one shared decision workspace over a controlled public guitar marketplace. The origin uses original listing content, real HTTPS product JSON, and semantic product pages. It is clearly labeled demonstration data and does not impersonate eBay or another merchant.

The secondary Shopify development store preserves the Storefront and public products JSON adapters with a labeled snapshot fallback. It is not the default recording origin.

The page the agent visits must remain this origin (`agentic-webmcp.somnora.workers.dev`).
WebMCP tools are registered on the top-level document (`tools=(self)`). You cannot inject
tools into amazon.com. The honest architecture is: Agentic is the agent view of one or more
allowlisted real origins.

## Non-goals for the Challenge

- No arbitrary URL fetch. That is SSRF and a ToS trap.
- No Amazon, Allbirds, Booking.com, or other famous-brand scraping.
- No third-party trademarks in the demo video unless James has permission.
  Official rule: the video must not include third-party trademarks or copyrighted material
  without permission.
- No Admin API tokens, commercial `AGENTIC_KV`, App Proxy HMAC, or checkout/payment.
- No claiming conversion lift, crawler adoption, or sales impact.

## Origin allowlist

Every upstream fetch must match an explicit origin record. Reject everything else.

```ts
export type Vertical = "retail" | "marketplace" | "wholesale" | "travel";

export type Adapter =
  | "shopify-storefront"      // Storefront GraphQL with a read-only token
  | "shopify-products-json"   // GET https://{host}/products.json and /products/{handle}.js
  | "json-ld"                 // Product, Offer, Hotel, TouristTrip on an allowlisted page
  | "html-markdown";          // last-resort strip of an allowlisted page

export type Origin = {
  id: string;                 // stable, lowercase, hyphenated
  vertical: Vertical;
  displayName: string;
  hostname: string;           // exact hostname, lowercase
  canonicalUrl: string;       // https origin, no path
  adapter: Adapter;
  productPathPattern?: string; // e.g. "^/products/([a-z0-9-]+)/?$"
  notes?: string;             // human-visible source label
};
```

Hostname matching is exact. No wildcard suffix except a documented `*.myshopify.com`
pattern that still requires the shop to appear in the allowlist. HTTPS only. Do not
follow redirects off-host. Bound response bytes. Cache briefly. Label `live` vs fallback.

## Offer graph

```ts
export type Money = { amount: string; currencyCode: string };

export type Variant = {
  id: string;
  title: string;
  available: boolean;
  quantityAvailable: number | null;
  price: Money;
  options: Array<{ name: string; value: string }>;
};

export type Constraints = {
  available: boolean;
  quantityAvailable?: number | null;
  moq?: number;                 // wholesale
  leadDays?: number;            // wholesale
  accountRequired?: boolean;    // wholesale
  refundable?: boolean;         // travel
  occupancy?: { min: number; max: number };
  stayNights?: { min: number; max: number };
};

export type Offer = {
  originId: string;
  handle: string;
  title: string;
  description: string;          // untrusted, truncated
  url: string;                  // canonical page on the origin
  vendor?: string;
  productType?: string;
  vertical: Vertical;
  priceRange: { min: Money; max: Money };
  variants: Variant[];          // cap at 8
  constraints: Constraints;
  image?: { url: string; altText: string | null };
  source: {
    adapter: Adapter;
    live: boolean;
    fetchedAt: string;
    untrusted: true;
  };
  marketplace?: {
    condition: "new" | "open-box" | "excellent" | "very-good" | "good" | "fair";
    conditionDescription: string;
    seller: { name: string; feedbackPercent: number; feedbackCount: number };
    shipping: { price: Money; method: string; estimatedDays: { min: number; max: number } };
    returns: { accepted: boolean; windowDays: number | null; paidBy: "seller" | "buyer" | null };
    deliveredPrice: Money;
  };
};
```

Interpolation means: fetch allowlisted origin, extract the richest available structured
facts, normalize into `Offer`, discard chrome (nav, footer, scripts, forms). Prefer
Storefront GraphQL, then `products.json`, then JSON-LD, then HTML-to-Markdown. Never
present HTML interpolation as live inventory if a structured adapter succeeded.

## Purchase review, approval, and decision record

Agents may not mutate a merchant checkout in this Challenge build.

```ts
export type QuoteLine = {
  originId: string;
  handle: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
  unitPrice: Money;
};

export type Quote = {
  quoteId: string;
  originId: string;
  lines: QuoteLine[];
  total: Money;
  createdAt: string;
  expiresAt: string;            // short TTL, e.g. 15 minutes
  status: "proposed";
};

export type Confirmation = {
  quoteId: string;
  status: "awaiting_human_confirmation" | "confirmed" | "dismissed";
};

export type Receipt = {
  receiptId: string;
  quoteId: string;
  originId: string;
  lines: QuoteLine[];
  total: Money;
  status: "in_cart";            // compatibility value for page-local approval only
  confirmedAt: string;
};
```

`propose_add_to_cart` returns a `Quote` plus `awaiting_human_confirmation`. Only a human click on this page may call commit. Commit writes a page-local decision record using the legacy `Receipt` and `in_cart` compatibility names. It does not create a merchant cart, place an order, or pay.

## WebMCP tool surface

Keep the tool count small. Register on the top-level document.

Read-only (`readOnlyHint: true`, `untrustedContentHint: true`):

1. `list_origins` : show allowlisted real websites the agent may use.
2. `select_origin` : `{ originId }` : bind subsequent tools to that origin; update the UI.
3. `search_products` : `{ query, maxResults? }` : search the selected origin.
4. `find_best_options` : `{ query, maxDeliveredPrice?, maxResults? }` : rank marketplace offers using visible deterministic evidence.
5. `get_product` : `{ handle }` : inspect one offer and sampled variants.
6. `compare_products` : `{ handles }` : two to four handles on the selected origin.
7. `interpolate_page` : `{ path }` : strip one allowlisted path on the selected origin
   into an Offer plus compact Markdown. Path only, never a free-form URL.
8. `create_catalog_brief` : `{ goal, handles }` : deterministic Markdown from selected offers.

Confirm-write (`readOnlyHint: false`, `destructiveHint: false`):

9. `propose_add_to_cart` : `{ handle, variantTitle?, quantity? }` : stage a visible
   purchase review. Does not create an order or charge.

Do not register a commit tool. Commit is a human button.

## Human-visible contract

Every tool call must update:

- origin badge (display name, hostname, adapter, live/fallback)
- offer grid or comparison
- activity rail (tool, args, origin, time)
- latest result panel
- purchase review banner, when applicable

Manual controls call the same functions as the tools.

## Projections

The Worker is the only compiler. From one Offer graph it may emit:

- JSON for tools (bounded, ~1.5K characters at the tool boundary)
- compact Markdown for briefs and interpolated pages
- the visible workspace

Do not add a remote MCP server, UCP, or commercial App Proxy to this repository.

## Default Challenge origins

1. `catalog-lab`: controlled public guitar marketplace with original listings, public product JSON, and allowlisted product pages.
2. `review-shop`: `agentic-app-review-test.myshopify.com`, using optional Storefront GraphQL, public product JSON, then a labeled bundled snapshot.

Do not add unrelated retailer names or scrape third-party catalogs without permission.

## Video-safe rule

The live judge app may list every allowlisted origin. The YouTube video may only
show origins James owns or has permission to display, and must not linger on
third-party logos, packshots, or brand wordmarks.
