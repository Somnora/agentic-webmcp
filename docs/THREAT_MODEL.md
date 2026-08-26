# Threat model

## Protected assets

- Integrity of the shared human and agent workspace.
- Correct attribution of controlled demo data, live adapter transport, and bundled fallback facts.
- Exact scope of upstream network access.
- Human control over the in-page cart receipt.
- No leakage of private tokens, commercial application secrets, or merchant administration data.

## Trust boundaries

1. Origin HTML, JSON-LD, product JSON, and GraphQL strings are external and untrusted.
2. WebMCP arguments are model-controlled and untrusted.
3. Manual form input is user-controlled and untrusted.
4. The Worker API is public and must enforce every limit independently of browser schemas.
5. A cart proposal is agent-triggerable, but confirmation is a separate human UI action.
6. Static assets and APIs share one origin. No cross-origin tool exposure is configured.

## Upstream controls

- `src/origins.ts` is the only source of allowed hostnames and path patterns.
- Upstream URLs are constructed from an Origin record, never accepted as arbitrary URLs.
- HTTPS is required.
- Hostname comparison is exact and lowercase.
- Ports, usernames, and passwords are rejected.
- Fetch uses `redirect: manual`.
- Off-origin redirects are rejected.
- Same-origin redirects are also rejected when the destination path is not explicitly allowlisted.
- Password redirects are classified explicitly and never followed.
- Catalog and HTML responses are read through byte-bounded streams.
- Product HTML interpolation accepts only product paths declared on the selected Origin.

## Data and UI controls

- Controlled public product JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, HTML interpolation, and the bundled snapshot all project into one `Offer` protocol.
- Each Offer records field-level provenance for title, description, pricing, availability, and variants.
- Descriptions, titles, vendor text, option text, and image URLs are normalized and truncated.
- Tool JSON output is compacted to about 1.5K characters in the browser action layer.
- The UI creates nodes and uses `textContent`; origin content is never inserted as HTML.
- Production interpolation uses Cloudflare HTMLRewriter to remove nav, footer, script, style, iframe, and form content before collecting compact semantic text. Deterministic Node tests use a bounded fallback projection.
- Structured adapters remain the inventory authority when they succeed.
- Fallback offers have `source.live: false` and the UI says `FALLBACK | bundled-snapshot`.
- The controlled origin has `mode: controlled-demo`; successful reads say `LIVE DEMO`, not live merchant inventory.
- The controlled origin contains original fixture text, no external images, no forms, and no checkout or payment routes.

## Cart controls

- `propose_add_to_cart` returns a short-lived quote and `awaiting_human_confirmation`.
- Proposal does not return a receipt and does not mutate a merchant cart.
- No WebMCP commit, checkout, order, or payment tool is registered.
- The commit route requires `X-Agentic-Human-Confirm: true` and revalidates origin, handle, variant, quantity, and current offer facts.
- Commit creates only an in-page `Receipt` with status `in_cart`.
- The header is a UI contract, not user authentication. It is sufficient only because the route has no durable or merchant-side effect.

## Browser and response controls

- CSP allows scripts, styles, connections, and forms only on self, with HTTPS images permitted.
- `Permissions-Policy` exposes tools only to self.
- `Origin-Agent-Cluster: ?1` is preserved.
- Framing is denied by CSP and `X-Frame-Options: DENY`.
- MIME sniffing is disabled and referrers are suppressed.
- Request bodies, query length, result count, handles, comparison size, brief goals, quantities, and quote ids are bounded in Worker code.
- Validated read responses use short Cloudflare Cache API entries. Cache keys remain same-origin and include the selected origin and bounded query parameters.
- Errors expose stable codes and retry guidance while operational error logs include only route path, code, and retryability.

## Considered attacks

| Attack | Expected result |
| --- | --- |
| Arbitrary URL or alternate hostname | HTTP 400 before fetch |
| Encoded path traversal | HTTP 400 |
| Off-host redirect | Fetch stops and live data is not claimed |
| Redirect to `/password` | Fetch stops with an explicit password-protected warning; fallback is labeled |
| Oversized upstream body | Stream is cancelled and live data is not claimed |
| Prompt injection in origin text | Shown as untrusted text and never executed |
| Malformed JSON-LD | Ignored; richer structured or labeled fallback facts remain available |
| Controlled origin mistaken for merchant inventory | Public origin metadata and the visible badge identify `controlled-demo` and `LIVE DEMO` |
| Unknown origin id | HTTP 400 |
| Query and body origin mismatch | HTTP 400 |
| Proposal tool attempts to commit | Impossible because no commit tool is registered |
| Direct commit without human header | HTTP 400 and no receipt |
| Unsupported API route or method | HTTP 404 or 405 |

## Intentionally absent

- No arbitrary proxy.
- No checkout, payment, Admin API, order, customer, billing, or merchant mutation.
- No accounts, authentication, cookies, persistent cart, database, or analytics identifiers.
- No commercial application Worker, App Proxy, HMAC, storage, or secrets.
- No unrelated retailer data, logos, product images, or third-party catalog scraping.

Any future durable or merchant-side write requires authentication, CSRF protection, signed action-time confirmation, replay protection, and a separate security review.
