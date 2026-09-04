# Judge guide

The public Challenge URL currently presents the submitted ten-tool evidence workspace described below. A local post-submission release candidate adds a discoverable `/decide` workspace with one `plan_decision` tool for gift, date, vacation, and staffing strategies. It has not replaced the submitted build or been deployed. See [Personalized decision release candidate](RELEASE_CANDIDATE.md) for its exact test flow and claim boundary.

## What to verify

Ribband turns allowlisted public product pages into structured, source-visible decisions. The default origin is a controlled public guitar marketplace served over real HTTPS. It is clearly labeled demonstration data and does not impersonate eBay or another merchant.

The key interaction is not a chatbot transcript. Each WebMCP call updates the same visible workspace the human is viewing. Ranking factors, canonical source links, normalized offers, and the approval boundary remain inspectable.

## No-credential flow

Open [the live app](https://agentic-webmcp.somnora.workers.dev/) in a WebMCP-capable client. Presenter mode is optional and changes only the recording layout.

The updated guided presentation follows the goods flow below, then the services and Oahu proof. It uses the same application actions but is not an autonomous agent session. Its nominal 2:45 sequence pauses for genuine human decisions. See [the recording guide](DEMO_SCRIPT.md) for timing and controls.

1. Confirm the page reports ten registered tools.
2. Ask: `List the allowlisted origins and select catalog-lab.`
3. Ask: `Find the best electric guitars under 900 USD as a gift. Let me explore. The recipient prefers single-coil pickups. Emphasize taste, condition, and price.`
4. At the decision checkpoint, choose one of the visible priorities. Confirm the resolved state names the applied choice, its 10-point rubric adjustment, and whether Best fit changed.
5. Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`
6. Confirm the result says `Verified across product JSON and page` and lists the verified decision fields.
7. Open `Origin diagnostics` and confirm both the product JSON and page attempts report a duration with no failure.
8. Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`
9. Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`
10. Confirm the source and listing both say `HANDOFF READY`, then confirm the review says nothing has been ordered or charged.
11. Click `Approve for handoff` yourself. The Worker rereads the Offer and records only the exact Quote that was visible for review.
12. Download the decision dossier and verify it records the goal, taste and intent, refinement choice, ranked evidence, recommendation tradeoffs, canonical URLs, reconciliation, selection, and human decision.

## Expected evidence

- Origin: `Independent Gear Exchange`
- Host: `agentic-webmcp-origin.somnora.workers.dev`
- Source mode: `controlled-demo`
- Live adapter: `public-products-json`
- Representative handles: `sunburst-s-style-electric`, `mahogany-single-cut-electric`, `natural-dreadnought-acoustic`, `offset-electric-ocean-blue`
- Interpolation output: canonical URL, compact Markdown, structured `Offer`, and cross-source evidence state
- Trust output: first-party authorization, live source, fresh-until time, and handoff eligibility
- Reliability output: request trace, adapter timing, time budget, evidence state, and normalized failure reason
- Recommendation output: Best fit, Best value, Worth a look, reasons, tradeoffs, evidence confidence, seven deterministic score factors, and an evidence-derived refinement when credible options have competing strengths
- Human boundary: no commit, checkout, order, or payment tool exists
- User artifact: a browser-generated Markdown decision dossier, with no server storage

## Important limits

The public origin and page fetches are live, but the four listings are original controlled demonstration data. The app does not search arbitrary websites, scrape eBay, place an order, handle money, or create a merchant account. The secondary Shopify origin may show a labeled research-only snapshot when public inventory is unavailable. Snapshot and stale Offers cannot create a proposal.

The optional services proof uses `services-lab` on the same controlled hostname under a disjoint `/services/*` allowlist. Ask: `Select services-lab and search for Oahu experiences. Inspect north-shore-surf-foundations. Then create a balanced itinerary for two people on 2026-10-10 under 500 USD using north-shore-surf-foundations, haleiwa-food-story-walk, and oahu-sunset-photo-walk, between 08:00 and 19:00.` The result should verify the surf page across service JSON and JSON-LD, then schedule all three activities inside published windows with a 450.00 USD party total and 50.00 USD remaining. The visible timeline must label its times as proposals, preserve canonical sources, and stop before availability confirmation, provider contact, booking, or payment.
