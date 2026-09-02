# Threat model

## Protected assets

- Integrity of the shared human and agent workspace.
- Correct attribution of controlled demo data, live adapter transport, and bundled fallback facts.
- Exact scope of upstream network access.
- Human control over the page-local approved selection.
- No leakage of private tokens, commercial application secrets, or merchant administration data.

## Trust boundaries

1. Origin HTML, JSON-LD, product JSON, and GraphQL strings are external and untrusted.
2. WebMCP arguments are model-controlled and untrusted.
3. Manual form input is user-controlled and untrusted.
4. The Worker API is public and must enforce every limit independently of browser schemas.
5. A purchase review is agent-triggerable, but approval is a separate human UI action.
6. Static assets and APIs share one origin. No cross-origin tool exposure is configured.

## Upstream controls

- `src/origins.ts` is the only source of allowed hostnames and path patterns.
- Registry validation rejects anchored catch-all patterns, non-product paths, and nested product paths before an origin can load.
- Each origin record declares authorization status, data rights, capabilities, response limits, Offer freshness, and a review date. The complete registry is validated at Worker startup.
- Runtime origin resolution checks authorization on every request. At `reviewAfter`, the origin disappears from discovery and read or handoff routes return 403 before any upstream access. Conformance retains manifest inspection but skips the live adapter probe.
- Upstream URLs are constructed from an Origin record, never accepted as arbitrary URLs.
- HTTPS is required.
- Hostname comparison is exact and lowercase.
- Ports, usernames, and passwords are rejected.
- Fetch uses `redirect: manual`.
- Off-origin redirects are rejected.
- Same-origin redirects are also rejected when the destination path is not explicitly allowlisted.
- Password redirects are classified explicitly and never followed.
- Every origin manifest sets an upstream timeout that covers connection, headers, and streamed body reads.
- Catalog and HTML responses are read through byte-bounded streams.
- Product HTML interpolation accepts only product paths declared on the selected Origin.

## Data and UI controls

- Controlled public product JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, HTML interpolation, and the bundled snapshot all project into one `Offer` protocol.
- Marketplace evidence is accepted only when condition, seller, shipping, returns, and delivered price form a complete bounded record.
- Recommendation scores are deterministic and expose relevance, condition, delivered price, seller confidence, and returns factors.
- Each Offer records structured field provenance. Price, availability, condition, shipping, and returns carry `verified`, `single-source`, or `conflict` evidence states.
- Reconciliation keeps the structured adapter as primary. A page mismatch is recorded rather than silently replacing the primary value, and the reconciled Offer becomes ineligible for handoff.
- Each Offer exposes live status, fetch time, freshness expiry, and handoff eligibility. Adapter output is checked against the selected origin manifest before it reaches an API response.
- Descriptions, titles, vendor text, option text, and image URLs are normalized and truncated.
- Tool JSON output is compacted to about 1.5K characters in the browser action layer.
- The UI creates nodes and uses `textContent`; origin content is never inserted as HTML.
- Production interpolation uses Cloudflare HTMLRewriter to remove nav, footer, script, style, iframe, and form content before collecting compact semantic text. Deterministic Node tests use a bounded fallback projection.
- Structured adapters remain the inventory authority when they succeed.
- Fallback offers have `source.live: false`, the UI says `FALLBACK | bundled-snapshot | RESEARCH ONLY`, and proposal controls are disabled.
- The controlled origin has `mode: controlled-demo`; successful reads say `CONTROLLED LIVE`, not third-party merchant inventory.
- The controlled origin contains original guitar listing text, no external images, no forms, and no checkout or payment routes.

## Approval controls

- `propose_add_to_cart` returns a short-lived quote and `awaiting_human_confirmation`.
- The proposal route re-fetches the Offer and requires a live source, an available variant, and a source timestamp inside the selected origin's freshness window.
- Fallback, stale, invalid-timestamp, and unavailable Offers fail closed with `OFFER_NOT_ELIGIBLE` before a quote is created.
- Proposal does not return a receipt and does not mutate a merchant cart.
- Human approval returns the complete reviewed Quote. The Worker rereads the Offer and rejects changed line or total facts with `QUOTE_CHANGED` before creating a page-local receipt.
- No WebMCP commit, checkout, order, or payment tool is registered.
- The commit route requires `X-Agentic-Human-Confirm: true` and revalidates origin, handle, variant, quantity, and current offer facts.
- Commit creates only a page-local decision record. Its legacy wire type is `Receipt` with status `in_cart` for compatibility.
- The header is a UI contract, not user authentication. It is sufficient only because the route has no durable or merchant-side effect.

## Browser and response controls

- CSP allows scripts, styles, connections, and forms only on self, with HTTPS images permitted.
- `Permissions-Policy` exposes tools only to self.
- `Origin-Agent-Cluster: ?1` is preserved.
- Framing is denied by CSP and `X-Frame-Options: DENY`.
- MIME sniffing is disabled and referrers are suppressed.
- Request bodies, query length, result count, handles, comparison size, brief goals, quantities, and quote ids are bounded in Worker code.
- Validated read responses use short Cloudflare Cache API entries. Cache keys remain same-origin and include the selected origin and bounded query parameters.
- Errors expose stable codes, normalized failure reasons, retry guidance, and a correlation id. Operational records include only correlation id, route path, status, duration, adapter timing, byte count, failure category, code, and retryability. Search terms, request bodies, upstream bodies, and secrets are not logged.
- `Server-Timing` reports total request time and bounded adapter timings. `X-Agentic-Correlation-Id` links the app request to the controlled origin without carrying visitor identity.
- Decision dossiers are assembled and downloaded in the browser. They are not posted to the Worker or stored by the application.

## Considered attacks

| Attack | Expected result |
| --- | --- |
| Arbitrary URL or alternate hostname | HTTP 400 before fetch |
| Encoded path traversal | HTTP 400 |
| Off-host redirect | Fetch stops and live data is not claimed |
| Redirect to `/password` | Fetch stops with an explicit password-protected warning; fallback is labeled |
| Proposal from a password-protected or fallback origin | HTTP 409 with `OFFER_NOT_ELIGIBLE` and no quote |
| Proposal from an expired Offer | HTTP 409 with `OFFER_NOT_ELIGIBLE` and no quote |
| Oversized upstream body | Stream is cancelled and live data is not claimed |
| Origin stalls before or during body streaming | Time budget aborts the attempt and reports `timeout` |
| Prompt injection in origin text | Shown as untrusted text and never executed |
| Malformed JSON-LD | Ignored; richer structured or labeled fallback facts remain available |
| Page fact conflicts with structured product data | Conflict is visible in provenance and the reconciled Offer is research-only |
| Controlled origin mistaken for eBay or another merchant | Public origin metadata and the visible badge identify controlled demonstration data |
| Unknown origin id | HTTP 400 |
| Expired origin authorization | Origin is hidden from discovery; API access returns HTTP 403 before fetch |
| Query and body origin mismatch | HTTP 400 |
| Proposal tool attempts to commit | Impossible because no commit tool is registered |
| Direct commit without human header | HTTP 400 and no receipt |
| Offer facts change after review | HTTP 409 with `QUOTE_CHANGED` and no receipt |
| Unsupported API route or method | HTTP 404 or 405 |

## Intentionally absent

- No arbitrary proxy.
- No checkout, payment, Admin API, order, customer, billing, or merchant mutation.
- No accounts, authentication, cookies, persistent cart, database, or analytics identifiers.
- No commercial application Worker, App Proxy, HMAC, storage, or secrets.
- No unrelated retailer data, logos, product images, or third-party catalog scraping.

Any future durable or merchant-side write requires authentication, CSRF protection, signed action-time confirmation, replay protection, and a separate security review.
