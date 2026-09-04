# Threat model

## Protected assets

- Integrity of the shared human and agent workspace.
- Correct attribution of controlled demo data, live adapter transport, and bundled fallback facts.
- Exact scope of upstream network access.
- Human control over the page-local approved selection.
- No leakage of private tokens, commercial application secrets, or merchant administration data.

## Trust boundaries

1. Origin HTML, JSON-LD, product JSON, service JSON, and GraphQL strings are external and untrusted.
2. WebMCP arguments are model-controlled and untrusted.
3. Manual form input is user-controlled and untrusted.
4. The Worker API is public and must enforce every limit independently of browser schemas.
5. A purchase review is agent-triggerable, but approval is a separate human UI action.
6. Static assets and APIs share one origin. No cross-origin tool exposure is configured.

## Upstream controls

- `src/origins.ts` is the only source of allowed hostnames and path patterns.
- Registry validation rejects anchored catch-all patterns, paths outside the declared product or service prefix, nested paths, and overlapping scopes before an origin can load.
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
- HTML interpolation accepts only product or service paths declared on the selected Origin.

## Data and UI controls

- Controlled public product JSON, public service JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, HTML interpolation, and the bundled snapshot all project into one `Offer` protocol.
- Marketplace evidence is accepted only when condition, seller, shipping, returns, and delivered price form a complete bounded record.
- Service evidence is accepted only when provider label, coarse location, duration, price basis, party-size limits, timezone, published windows, and cancellation terms form a complete bounded record. Lodging additionally requires a bounded stay-length range before it can enter a vacation package.
- Recommendation scores are deterministic and expose relevance, preference fit, condition, delivered price, seller confidence, returns, and delivery factors.
- Taste, recipient context, priorities, must-have terms, and avoid terms are bounded decision inputs. They use a no-store POST request, never enter the request URL, and are not retained by the Worker.
- A refinement answer is accepted only when the same bounded inputs produce a genuine competing-tradeoff checkpoint and the answer matches one of its evidence-derived choices. Clear leaders, insufficient candidates, unknown choices, and unavailable choices fail closed.
- Each Offer records structured field provenance. Marketplace fields and service fields carry `verified`, `single-source`, or `conflict` evidence states appropriate to their vertical.
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
- The controlled service scope contains original provider fixtures, coarse public locations, and no booking, messaging, account, or payment routes.
- `create_activity_itinerary` is read-only. It checks destination, calendar date, one-to-three-day range, party size, budget, pace, day hours, evidence, availability, published windows, and explicit transition buffers. It preserves source URLs and returns typed conflicts. Proposed times are not reservations, and transition buffers are planning allowances rather than measured travel time.
- `plan_personalized_vacation` is read-only and page-specific. Its bounded no-store request filters location, party size, availability, stay length, evidence conflicts, and hard dislikes before combination scoring. It itemizes published subtotals and unknown costs, and cannot save a profile, contact a provider, book, or pay.
- `plan_decision` is read-only and page-specific. It accepts one validated `DecisionContext`, then dispatches only by its typed vertical to a fixed strategy registry. Gift is pinned to `catalog-lab`; date, vacation, and staffing are pinned to `services-lab`. It cannot infer a route from free-form prompt text, switch to a caller-selected source, or dispatch a staffing decision without verified provider and credential Offers. Staffing plans verified provider crews using twenty controlled provider fixtures in `services-lab`. Provider fixtures carry declared roles, service areas with planning travel radii, typed credentials (`controlled-verified`, `provider-attested`, `unverified`, `not-required`), listed equipment, and quote accounting (`published-rate` or `estimate-only`). Opening a provider source requires explicit, visible two-step human review with transmitted-information disclosures. Automated provider contact, quote requests, booking, contracts, and payment remain strictly unavailable.
- The unified decision body is capped at 16 KiB and returns `Cache-Control: no-store`. A bounded `revisionOf` id links a replacement request, but the Worker keeps no mutable decision or profile state. The complete visible context is resubmitted on every revision.
- Outcome proposals are bounded to date and vacation self-profile facts. Gift-recipient and partner-specific outcome memory is not persisted by the unified loop. The proposal route validates the decision id, option id, option title, outcome, feedback, and allowed-use scope, returns `persistence: none`, and stores nothing.
- A proposal remains tentative until a human reviews the exact fact text and clicks the on-device approval control. Approval, correction, and two-step deletion occur only in browser IndexedDB and are not exposed through WebMCP or Worker routes. Approved facts are never selected automatically for a later decision.

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
- Validated catalog and legacy recommendation GET responses use short Cloudflare Cache API entries. Cache keys remain same-origin and include the selected origin and bounded query parameters. Taste and intent recommendations are POST-only and return `Cache-Control: no-store`.
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
| Proposal for a service Offer | HTTP 409 with `SERVICE_BOOKING_NOT_ENABLED` and no quote |
| Itinerary with a goods Offer | HTTP 400 with no itinerary |
| Non-eligible, cross-destination, unavailable, conflicted, out-of-window, over-budget, or party-size-incompatible service | Planning-only itinerary returns `needs-attention` with a typed blocking conflict and no reservation action |
| Vacation request with unsupported hard evidence, excluded required categories, or no complete package under its tier ceiling | Planning-only package response returns `needs-attention`; no booking, contact, or payment action exists |
| Oversized personalized vacation request | HTTP 400 before profile context is parsed or used |
| Unified decision with an incompatible caller-selected origin | HTTP 400 before an origin fetch |
| Unified staffing decision without verified provider and credential Offers | HTTP 400 with no provider recommendation or contact action |
| Malformed revision id or unified request above 16 KiB | HTTP 400 with no stored partial decision |
| Outcome proposal for gift, staffing, an unsupported scope, empty feedback, unknown fields, or a body above 4 KiB | HTTP 400 with no saved fact |
| Agent attempts to approve, edit, delete, or select an on-device memory | Impossible because no WebMCP or Worker mutation route is registered |
| Approved memory exists but the user did not select it for the current decision | The fact remains on-device and is absent from the Worker request |
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
