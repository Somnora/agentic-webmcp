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
  | "public-products-json"    // first-party public catalog JSON
  | "json-ld"                 // Product, Offer, Hotel, TouristTrip on an allowlisted page
  | "html-markdown";          // last-resort strip of an allowlisted page

export type Origin = {
  id: string;                 // stable, lowercase, hyphenated
  vertical: Vertical;
  displayName: string;
  hostname: string;           // exact hostname, lowercase
  canonicalUrl: string;       // https origin, no path
  adapter: Adapter;
  fallbackAdapters: readonly Adapter[];
  productPathPattern: string; // e.g. "^/products/([a-z0-9-]+)/?$"
  interpolatePathPatterns: readonly string[];
  notes: string;              // human-visible source label
  authorization: {
    status: "first-party-controlled" | "operator-authorized" | "inactive";
    evidence: "repository-controlled-worker" | "operator-attestation";
    dataRights: "first-party-fixture" | "operator-controlled-store";
    scopes: readonly ("catalog-read" | "page-interpolation" | "video-display")[];
    attestedAt: string;
    reviewAfter: string;
  };
  capabilities: {
    catalogRead: true;
    pageInterpolation: true;
    merchantHandoff: "live-fresh-offer-only";
    checkout: false;
    payment: false;
  };
  policy: {
    maxOfferAgeSeconds: number;
    upstreamTimeoutMs: number;
    maxGraphqlResponseBytes: number;
    maxCatalogResponseBytes: number;
    maxPageResponseBytes: number;
  };
};
```

Hostname matching is exact. Wildcards are not accepted. HTTPS only. Do not
follow redirects off-host. Bound response time and bytes. Cache briefly. Label `live` vs fallback.

Authorization is also a runtime boundary. Normal origin resolution requires an active status, a valid attestation time, and a current time before `reviewAfter`. At expiration the origin is removed from discovery and all catalog, interpolation, comparison, brief, diagnostics, proposal, and commit routes reject it before upstream access. Conformance may inspect the expired manifest, but it skips the live adapter probe.

Each request receives a new correlation id. Adapter attempts record only the adapter, operation, duration, outcome, HTTP status, byte count, and a normalized failure reason. They never record query text, request bodies, upstream response bodies, tokens, or cookies. The public diagnostics route exposes a compact projection of this evidence for the selected origin.

Normalized failure reasons are `timeout`, `network`, `http-error`, `off-origin-redirect`, `redirect-blocked`, `password-protected`, `response-too-large`, `invalid-response`, `contract-failure`, and `unknown`.

See `docs/ORIGIN_ONBOARDING.md` for the authorization, adapter acceptance, and revocation workflow.

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
  provenance: {
    title: EvidenceClaim;
    description: EvidenceClaim;
    pricing: EvidenceClaim;
    availability: EvidenceClaim;
    variants: EvidenceClaim;
    condition?: EvidenceClaim;
    seller?: EvidenceClaim;
    shipping?: EvidenceClaim;
    returns?: EvidenceClaim;
    verification: EvidenceVerification;
  };
  handoff: {
    eligible: boolean;
    reason: "eligible" | "source-not-live" | "source-stale" | "source-timestamp-invalid" | "unavailable" | "evidence-conflict";
    freshness: "fresh" | "stale" | "invalid" | "not-live";
    freshUntil: string | null;
    maxAgeSeconds: number;
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

type EvidenceClaim = {
  state: "verified" | "single-source" | "conflict";
  primary: Adapter | "bundled-snapshot";
  sources: Array<Adapter | "bundled-snapshot">;
  note?: string;
};

type EvidenceVerification = {
  state: "verified" | "single-source" | "conflict";
  label: string;
  checkedAt: string | null;
  sources: Array<Adapter | "bundled-snapshot">;
  verifiedFields: Array<"pricing" | "availability" | "condition" | "shipping" | "returns">;
  singleSourceFields: Array<"pricing" | "availability" | "condition" | "shipping" | "returns">;
  conflictFields: Array<"pricing" | "availability" | "condition" | "shipping" | "returns">;
};
```

Interpolation means: fetch allowlisted origin, extract the richest available structured
facts, normalize into `Offer`, discard chrome (nav, footer, scripts, forms). Prefer
Storefront GraphQL, then `products.json`, then JSON-LD, then HTML-to-Markdown. Never
present HTML interpolation as live inventory if a structured adapter succeeded.

When a structured Offer and page JSON-LD both exist for the same handle, the compiler reconciles price, availability, condition, shipping, and returns. Matching values become `verified`; missing corroboration remains `single-source`; mismatches become `conflict`. The structured adapter remains primary, conflict details remain visible, and a conflicted reconciled Offer is research-only.

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

`propose_add_to_cart` returns a `Quote` plus `awaiting_human_confirmation`. Only a human click on this page may call commit. The button returns the complete reviewed Quote, the Worker rereads the current Offer, and approval fails with `QUOTE_CHANGED` if any line or total differs. A successful receipt copies the exact reviewed facts. Commit writes a page-local decision record using the legacy `Receipt` and `in_cart` compatibility names. It does not create a merchant cart, place an order, or pay.

The Worker rejects a proposal unless the Offer is live, fresh, and available. Bundled snapshots remain usable for clearly labeled research but never enter the merchant handoff flow. The current default freshness window is five minutes and is enforced again when the proposal is created.

## WebMCP tool surface

Keep the tool count small. Register on the top-level document.

Read-only (`readOnlyHint: true`, `untrustedContentHint: true`):

1. `list_origins` : show allowlisted real websites the agent may use.
2. `select_origin` : `{ originId }` : bind subsequent tools to that origin; update the UI.
3. `search_products` : `{ query, maxResults? }` : search the selected origin.
4. `find_best_options` : `{ query, maxDeliveredPrice?, maxResults?, shoppingFor?, mode?, priorities?, tasteContext?, mustHave?, avoid?, refinementChoice? }` : rank marketplace offers using session-only intent and visible deterministic evidence. `refinementChoice` must match a choice that the same bounded inputs produce.
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
- a browser-generated Markdown decision dossier

Do not add a remote MCP server, UCP, or commercial App Proxy to this repository.

The dossier is not a second product model. It is a human-readable projection of the goal, session-only intent, ranked Offers, recommendation reasons and tradeoffs, reconciliation state, canonical URLs, timestamps, selection, and human decision.

Taste and intent are decision inputs, not Offer fields. They are accepted only through the bounded no-store recommendation request and remain in browser state long enough to render and optionally download the decision dossier. The Worker does not create a shopper profile, account, cookie, or persistent preference record.

Uncertainty refinement extends the recommendation projection, not the Offer model. The Worker first computes the deterministic baseline. It asks one question only when at least two eligible candidates exist, the relevant challenger is within 25 points, and that challenger is stronger on at least one scored factor. Up to three choices are derived from the actual factor differences. The answer must match one returned choice and adds an explicit 10-point boost to that factor while keeping the rubric total at 100. The result reports the before and after handles, whether Best fit changed, and the applied choice. Clear leaders and insufficient option sets reject unsolicited refinement answers.

## Default Challenge origins

1. `catalog-lab`: controlled public guitar marketplace with original listings, public product JSON, and allowlisted product pages.
2. `review-shop`: `agentic-app-review-test.myshopify.com`, using optional Storefront GraphQL, public product JSON, then a labeled bundled snapshot.

Do not add unrelated retailer names or scrape third-party catalogs without permission.

## Video-safe rule

The live judge app may list every allowlisted origin. The YouTube video may only
show origins James owns or has permission to display, and must not linger on
third-party logos, packshots, or brand wordmarks.
