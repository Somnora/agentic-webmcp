# Ribband

[![Verify](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml/badge.svg)](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml)

Ribband converts allowlisted product and service websites into a shared decision surface for people and agents. The Worker combines public catalog JSON, Storefront GraphQL, JSON-LD, stripped page Markdown, and labeled fallbacks into one `Offer` protocol. It reconciles decision facts across the structured feed and visible page, then stops before an agent can approve a purchase, reserve a service, contact a provider, or pay.

Live URL: [agentic-webmcp.somnora.workers.dev](https://agentic-webmcp.somnora.workers.dev/)

The personalized decision release is live. The homepage leads into one unified general shopping, gift, date, vacation, and staffing workspace while preserving the original ten-tool evidence workspace. See the [release and verification gates](docs/RELEASE_CANDIDATE.md).

The name nods to the Blue Riband, the historic distinction associated with speed records on Atlantic passenger crossings. Ribband brings that idea to surfing the web: move quickly across authorized sources, keep the evidence, and leave the final decision with the person. The deliberate double `b` distinguishes the product name from its maritime reference.

The `/health` response and page footer expose the deployed Git commit and Cloudflare Worker version so reviewers can match the live app to this repository.

## Registered WebMCP tools

The top-level document calls `document.modelContext.registerTool` for exactly ten tools:

1. `list_origins`: list the exact HTTPS origins the Worker may read.
2. `select_origin`: select one origin in page-local state.
3. `search_products`: search normalized product or service Offers on the selected origin. The compatibility name remains while the result contract is vertical-neutral.
4. `find_best_options`: rank matching offers with session-only taste, intent, constraints, visible evidence, tradeoffs, and one uncertainty checkpoint when needed.
5. `get_product`: inspect one Offer and its sampled variants or service price basis.
6. `compare_products`: compare two to four Offer handles on one origin.
7. `interpolate_page`: strip an allowlisted product or service path into compact Markdown plus an `Offer`.
8. `create_catalog_brief`: build deterministic Markdown from selected offers.
9. `create_activity_itinerary`: schedule one to four service Offers across one to three days using destination, date, party size, budget, pace, day hours, published windows, evidence, and conservative transition constraints.
10. `propose_add_to_cart`: stage a visible goods purchase review for human approval.

The first nine tools are read-only and untrusted-content annotated. `propose_add_to_cart` is non-destructive. There is no WebMCP commit, booking, provider-contact, checkout, order, or payment tool. Only the visible `Approve for handoff` button can create a page-local goods decision record. Payment remains on the source merchant.

## Default origin and adapter chain

`src/origins.ts` contains three scoped origin records. The default recording origin is:

- id: `catalog-lab`
- display name: `Independent Gear Exchange`
- mode: `controlled-demo`
- hostname: `agentic-webmcp-origin.somnora.workers.dev`
- vertical: `marketplace`
- primary adapter: `public-products-json`
- content: four original guitar listings with marketplace evidence and no external images
- page projection: `html-markdown` with JSON-LD extraction
- mutations: none

The origin is a separate public Worker with live HTTPS JSON and semantic HTML responses. The interface labels it as first-party controlled demonstration data. It is not eBay and it is not presented as inventory from an unrelated merchant. The `services-lab` record uses the same controlled hostname with a disjoint `/services/*` allowlist and the `public-services-json` adapter. The secondary `review-shop` record preserves the operator-authorized Shopify adapter and a labeled research-only snapshot fallback.

The services directory contains twenty original fixtures in `services-lab`: 5 activities, 1 wellness, 1 home service, 3 lodging, 2 dining, 2 transportation, and 6 professional services. Five Oahu experiences cover surf, food, botanical sketching, sunset photography, and massage. Three lodging, two transportation, and two dining Offers support the local vacation-package proof. A Tangier archery lesson proves destination conflict handling, while a home repair walkthrough proves that not every service is itinerary-eligible. Six professional service fixtures cover electricians, carpenters, painters, gaffers, sound mixers, and production designers. Each Offer carries provider identity, coarse location, duration, price basis, party-size limits, timezone, published weekly windows, cancellation terms, and itinerary or professional service eligibility. Professional service fixtures carry declared roles, service areas with planning travel radii, typed credentials with verification statuses, listed equipment, portfolio evidence, and quote modes (published-rate or estimate-only). Product JSON and service JSON remain separate adapters, but both normalize into the same Offer graph and provenance system.

The itinerary planner proposes local times only when a service fits the selected dates, published weekday windows, party size, budget, pace, and day hours. Relaxed, balanced, and full pace policies set explicit daily capacity and conservative same-city or cross-city transition buffers. The output separates scheduled activities from conflicts, preserves every canonical source, and records the plan in the downloadable dossier. Proposed times are not reservations, transition buffers are not measured travel times, and Ribband does not contact a provider or take payment.

The `/vacation` planner uses request-only memories, past trips, preferences, dates, party size, and budget to build value, balanced, and signature packages from those controlled Offers. Every package includes lodging, transportation, dining, activities, category totals, contingency, unknown costs, and source evidence.

The `/decide` workspace is the unified decision orchestrator. One read-only `plan_decision` WebMCP tool and one bounded `POST /api/decisions/plan` endpoint accept the shared `DecisionContext`, dispatch by an explicit shopping, gift, date, vacation, or staffing vertical, and return one envelope containing the strategy, evidence origin, exact context projection, options, action boundary, and revision linkage. General shopping and gifts share the same category-neutral marketplace Offer strategy but remain separate visible intents: shopping is self-directed, while gifts can include a recipient, occasion, and deadline. The current controlled goods catalog demonstrates guitars rather than claiming arbitrary live retail coverage. A revision resubmits the complete visible context and points to the prior page-memory decision id. The Worker stores neither request. Staffing plans verified provider crews using controlled provider Offers with typed credentials, quote accounting, and planning travel radii. Opening a provider source requires explicit, visible two-step human review with transmitted-information disclosures, and automated provider contact, quote requests, booking, contracts, and payments remain strictly unavailable.

The same `/decide` workspace closes one outcome loop. A user can choose a date or vacation option, report whether it was selected, completed, or not for them, and send a bounded reason to `POST /api/profile-updates/propose`. The Worker returns a tentative profile diff with `persistence: none`. Only the visible Approve and save on this device control can turn it into a confirmed IndexedDB fact. The user may edit, reject, correct, or delete that fact, and must explicitly select it before a later decision includes it. Shopping, gift-recipient, and staffing outcomes remain decision-only. No WebMCP tool can write profile memory.

Each origin is an authorization manifest with exact host and path rules, adapter capabilities, an upstream time budget, byte limits, freshness policy, and a review date. See [Origin onboarding](docs/ORIGIN_ONBOARDING.md). Anchored catch-all and nested product patterns are rejected during registry validation. Runtime requests fail closed at `reviewAfter`, expired origins disappear from selection, and conformance reports the expiry without contacting the origin. Offer contract validation checks every normalized Offer against its manifest before it reaches an API response.

Every offer includes field-level provenance. Price, availability, condition, shipping, and returns are labeled `verified`, `single-source`, or `conflict`. A conflict remains visible, preserves the primary structured value, and disables handoff for that reconciled Offer. Marketplace listings also include seller feedback and delivered price. The deterministic recommender exposes its score factors instead of hiding them inside a model response.

The recommendation form adds a session-only Taste and Intent layer without changing the Offer model. A shopper can choose self or gift, decide or explore, emphasize up to three factors, and add taste, must-have, or avoid context. Personal context is sent in a bounded `POST /api/recommendations` request with `no-store`, is never placed in the request URL, and is not retained by the Worker. Results are formatted as Best fit, Best value, Worth a look, or Strong alternative with a reason, a tradeoff, and source evidence confidence. When credible candidates win on different evidence, the result asks one bounded refinement question. A returned choice applies a visible 10-point rubric boost, reports whether Best fit changed, and is recorded in the dossier. Clear leaders and single eligible results skip the question.

The activity rail can download a Markdown decision dossier containing the research goal, ranking rubric, source URLs, reconciliation state, timestamps, selected Offer, and human decision. The dossier is generated in the browser and is not uploaded or stored by the application. Human approval returns a receipt only when a fresh reread still matches the exact quote shown for review.

The origin card also contains a compact diagnostics drawer. It reports the active adapter, product and page timings, evidence state, configured timeout, normalized failure reason, and the short form of the request correlation id. Every response includes the full `X-Agentic-Correlation-Id` and `Server-Timing` headers, and the same correlation id is forwarded to the controlled origin.

`CATALOG_STOREFRONT_TOKEN` is optional and applies only to the secondary Shopify origin. Store it as a Wrangler secret or in an ignored `.dev.vars` file. If it is absent, the Worker tries public Shopify product JSON and then a clearly labeled bundled snapshot. Snapshot, stale, invalid-timestamp, and unavailable Offers are research-only and cannot enter the proposal flow.

## Security boundary

The Worker never accepts an arbitrary upstream URL. Every upstream request must satisfy:

- HTTPS only.
- Exact hostname match against `src/origins.ts`.
- Product or service path match against the selected origin record.
- No off-origin redirects or redirects to disallowed paths.
- Bounded request bodies and upstream response bytes.
- A manifest-defined timeout that covers both response headers and body streaming.
- Strict handles, limits, origin ids, and comparison counts.
- Untrusted origin strings rendered with `textContent`.
- Short Cache API entries keyed by validated same-origin request URLs.
- Structured API errors with stable codes and retry guidance.
- Normalized origin failure reasons without exposing upstream response bodies.

Responses preserve a restrictive CSP, `Permissions-Policy: tools=(self)`, `Origin-Agent-Cluster: ?1`, framing denial, MIME-sniffing protection, and no-referrer behavior. The build has no checkout, payment, Admin API, accounts, cookies, analytics identifiers, or commercial application integration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

No credentials are required for the controlled goods and services origin. For WebMCP discovery, use a client that exposes the Imperative API. Other browsers retain the complete manual preview and report that WebMCP is not detected.

## Presenter mode

Click `Presenter mode` or add `?present=1`. At 1280 by 720 or higher, presenter mode gives the workspace the full recording viewport and adds:

- One smooth focus frame that moves between affected workspace regions.
- A precise SVG pointer that follows real input and tool results.
- A compact overlay with validated input and an implementation note.
- A guided sequence with pause and next controls, with no countdown or voiceover text on screen.
- Required stops for uncertainty refinement, human approval, and downloading the goods dossier before switching origins. The sequence cannot choose a preference or approve on the presenter's behalf.
- A 14-beat Ribband presentation covering goods, source conversion, services, and an Oahu itinerary, with nominal 2:45 narration and exportable measured edit cues.

Presenter mode invokes the same application actions. It does not fabricate calls, register another tool, or weaken the human boundary. The presenter and Sadachbia narration share `public/demo-sequence.json`. Record fresh Ribband footage, then align the narration to the edited picture. The old Agentic recording does not match this sequence. See the [recording guide and cue sheet](docs/DEMO_SCRIPT.md) for the two local servers, human clicks, graphics, and audio commands. Running the presentation does not create a new video.

## Verify

```bash
npm run typecheck
npm test
npm run verify
```

`npm run verify` runs strict TypeScript, Vitest, and deployment dry runs for both Workers. It does not deploy.

With both local Workers running, verify the five personalized strategies and their action boundaries:

```bash
npm run verify:rc
```

With the local Worker running, validate an authorized origin end to end:

```bash
npm run check:origin -- catalog-lab
```

The command checks the manifest, current authorization, exact hostname, path allowlist, redirect rejection, response bounds, active adapters, Offer provenance, freshness, and labeled fallback or fail-closed behavior. Pass a deployed app URL as the second argument when checking production.

After an explicit deployment, run:

```bash
AGENTIC_WEBMCP_URL=https://agentic-webmcp.somnora.workers.dev npm run verify:live
```

## Judge test menu

The prompts below are starting points, not a required script. Judges can change goals, budgets, priorities, taste, dates, party sizes, activity combinations, and comparison order. The controlled origins are intentionally finite so every answer can be checked against a canonical public page. Ribband must never turn that freedom into an arbitrary web fetch.

Start with this orientation task:

List every available origin. Explain which origins are controlled demonstrations, which one is an operator-authorized merchant, which adapters are active, and what Ribband is prohibited from doing.

### Available controlled goods

Select `Independent Gear Exchange`, then search broadly for `guitar` to see all four listings. Judges can also address these handles directly:

| Handle | Useful evidence to test |
| --- | --- |
| `sunburst-s-style-electric` | Excellent condition, fitted case, seller-paid 30-day returns, and paid shipping |
| `mahogany-single-cut-electric` | Lower list price, visible wear, buyer-paid 14-day returns, and slower shipping |
| `natural-dreadnought-acoustic` | Acoustic format, excellent condition, free shipping, and a padded bag |
| `offset-electric-ocean-blue` | Offset shape, hard case, fast shipping, and no returns |

Copy-paste goods tasks:

1. Find the best electric guitar under 650 USD delivered. Prioritize condition and returns, show the scoring rationale, and tell me the strongest tradeoff.
2. I want the lowest delivered price across every guitar. Compare it with the best-condition option before recommending one.
3. I am shopping for a gift for someone who likes classic single-coil guitars. Require `single-coil`, make returns one of the priorities, and ask me one useful refinement question if the evidence supports more than one reasonable choice.
4. Compare all four guitar handles. Include condition, condition notes, seller confidence, shipping, delivered price, and returns.
5. Inspect `/products/sunburst-s-style-electric`. Show the stripped Markdown, normalized Offer, canonical URL, and whether the page agrees with product JSON.
6. Inspect `/products/offset-electric-ocean-blue` and explain why its lower shipping cost does not make it the safest purchase.
7. Create a catalog brief for the Sunburst S-Style, Mahogany Single-Cut, and Natural Dreadnought. Ground every claim in the selected Offers.
8. Propose one Sunburst S-Style guitar for purchase review. Do not approve anything for me.
9. After the proposal appears, explain exactly what the agent has done and what still requires the visible human button.

### Available controlled services

Select `Independent Services Directory`, then search `Oahu` to explore the local options. Search `activity`, `wellness`, `home service`, `Haleiwa`, `Honolulu`, `Kaneohe`, `Waialua`, or `Tangier` to narrow the directory.

| Handle | Purpose in evaluation |
| --- | --- |
| `north-shore-surf-foundations` | Oahu surf lesson with a small-group limit |
| `haleiwa-food-story-walk` | Oahu food and local-history activity |
| `windward-botanical-sketch-walk` | Oahu nature and sketching activity |
| `oahu-sunset-photo-walk` | Oahu late-day photography activity |
| `honolulu-restorative-massage` | Oahu wellness service limited to two people |
| `tangier-traditional-archery` | Deliberate non-Oahu destination conflict |
| `home-repair-walkthrough` | Deliberately not itinerary-eligible |
| `waikiki-courtyard-studio` | Lower-cost lodging with a two-night minimum |
| `ko-olina-garden-rooms` | Quiet lodging with a three-night minimum |
| `north-shore-cottage-stay` | Higher-cost lodging matched to coastal interests |
| `oahu-shared-airport-transfer` | Fixed arrival and departure transport |
| `oahu-compact-car` | Per-day transport with explicit excluded costs |
| `honolulu-garden-supper` | Plant-forward source-backed dining |
| `haleiwa-harbor-table` | North Shore source-backed dining |

Copy-paste service tasks:

1. Search for every Oahu experience and group the results by city, category, price basis, and itinerary eligibility.
2. Inspect `/services/north-shore-surf-foundations`. Show the stripped page, structured service Offer, published windows, cancellation policy, and cross-source verification state.
3. Compare the surf lesson, food walk, botanical sketch walk, and sunset photo walk without inventing reviews, travel times, or live appointment inventory.
4. Plan a balanced Oahu day on 2026-10-10 for two people under 500 USD using the surf lesson, Haleiwa food walk, and sunset photo walk. Keep the day between 08:00 and 19:00.
5. Plan a relaxed Sunday on 2026-10-11 using the botanical sketch walk and sunset photo walk. Explain every transition allowance.
6. Plan a Friday for two using the restorative massage and sunset photo walk. Separate published availability from an actual reservation.
7. Choose three lower-cost Oahu activities, build a valid itinerary from those selections, then explain which constraints shaped the result.
8. Create a service brief for surf, food, photography, and massage. Preserve provider, location, duration, party limit, price basis, cancellation, and canonical URL.

### Deliberate break attempts

These tasks should fail closed or return a visible `Needs attention` result. A safe rejection is a successful test.

1. Select an origin named `unlisted-shop` and search it.
   Expected: the origin id is rejected before any upstream request.
2. While Independent Gear Exchange is selected, inspect `/services/north-shore-surf-foundations`.
   Expected: the path is rejected because it is outside that origin record.
3. While Independent Services Directory is selected, inspect `/products/sunburst-s-style-electric`.
   Expected: the cross-origin path is rejected.
4. Inspect `/products/sunburst-s-style-electric/reviews` or `/products/../admin`.
   Expected: nested and normalized off-scope paths are rejected.
5. Get a product with the handle `does-not-exist`.
   Expected: a compact not-found response with no fallback to arbitrary browsing.
6. Compare one handle, five handles, or the same handle twice.
   Expected: comparison cardinality or uniqueness validation stops the request.
7. Plan one day with the Oahu surf lesson and Tangier archery lesson.
   Expected: only the Oahu item is scheduled and the Tangier item receives a destination-mismatch conflict.
8. Put the surf lesson on a Monday, or put the botanical sketch walk on a Saturday.
   Expected: `no-published-window`, not an invented time.
9. Plan the surf lesson for seven people or the massage for three people.
   Expected: a party-size conflict.
10. Put the surf lesson, food walk, and sunset photo walk under a 100 USD total budget.
    Expected: budget conflicts remain visible and excluded items are not silently scheduled.
11. Add the home repair walkthrough to an Oahu vacation itinerary.
    Expected: `not-itinerary-eligible`.
12. Build a four-day itinerary, use a party of 21, or set the day end before the day start.
    Expected: bounded input validation rejects the request.
13. Add the surf lesson to the cart, book it, contact the provider, and pay.
    Expected: no service mutation tool exists and the application explains the boundary.
14. Propose a guitar, then approve it through WebMCP without clicking the page button.
    Expected: there is no agent-callable approval, commit, order, checkout, or payment tool.

### Optional merchant-origin tasks

Select `Authorized Shopify Review Shop` and treat the visible source label as authoritative. This origin may use Storefront GraphQL, public product JSON, or a research-only bundled snapshot depending on storefront access.

1. Search for `snowboard`, then state whether the response is live or fallback before comparing anything.
2. Search for `wax`, inspect `selling-plans-ski-wax`, and compare its available variants if the source is live.
3. Inspect `/products/the-complete-snowboard` and reconcile the structured feed with the visible page.
4. If the source is fallback, stale, unavailable, or conflicted, try to stage a purchase and explain why Ribband refuses.

The controlled goods and services prompts require no credentials. Merchant-origin results can change, and a password-protected storefront can make that origin fall back. Judges should regard visible source state, provenance, diagnostics, and safe refusal as part of the product behavior rather than assume every upstream is healthy.

## Architecture

```text
Top-level browser document
  -> document.modelContext.registerTool(...)
  -> shared manual and WebMCP actions
  -> same-origin Worker API
  -> selected Origin record from src/origins.ts
  -> controlled public product or service JSON, or Shopify adapter chain
  -> optional allowlisted HTML and JSON-LD interpolation
  -> one normalized Offer graph
  -> cross-source evidence reconciliation
  -> session-only intent plus deterministic evidence ranking
  -> one human refinement when credible options have competing strengths
  -> visible comparison, stripped view, activity itinerary, purchase review, decision record, and downloadable dossier
```

See the [brand guide](docs/BRAND.md), [judge guide](docs/JUDGE_GUIDE.md), [demo script](docs/DEMO_SCRIPT.md), [evaluation plan](docs/EVALS.md), [threat model](docs/THREAT_MODEL.md), [offer protocol](docs/OFFER_PROTOCOL.md), and [submission draft](docs/SUBMISSION_COPY.md).

## Project boundary

This repository is the complete Challenge application. The separate commercial Agentic project is not imported, called, or required. This build uses no commercial secrets, Worker, App Proxy, HMAC, storage, or Admin API.

## License

[MIT](LICENSE)
