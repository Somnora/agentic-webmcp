# Evaluation plan

## Automated checks

The local verification suite covers origin validation, product and service adapters, fallback, interpolation, cross-source evidence reconciliation, planning-only itineraries, dossier generation, structured errors, deterministic ranking, proposal semantics, correlation propagation, connection and body-stream timeouts, normalized upstream failures, and the registered WebMCP surface. Deployment dry runs validate both Workers.

Run:

```bash
npm run verify
```

After deployment, run the public smoke suite with `npm run verify:live` and the live URL environment variable shown in the README.

The live suite validates the origin manifest, per-Offer freshness and handoff policy, the complete first-party controlled-origin flow, and the authorized Shopify origin. If Shopify remains password protected, the suite requires its proposal route to fail closed with `OFFER_NOT_ELIGIBLE`. If Shopify becomes publicly readable, the same check requires a live eligible Offer instead.

With the local app running, `npm run check:origin -- catalog-lab` performs the onboarding conformance contract against the runtime. It checks authorization, exact host and paths, redirects, byte limits, adapters, provenance, freshness, and fallback isolation.

With both local Workers running, `npm run verify:rc` performs the release-candidate convergence contract. It checks the `/workspace`, `/date`, `/vacation`, and `/decide` surfaces; all five unified strategies; self-directed shopping; gift phrase exclusions; complete date and vacation tiers; eligible and ineligible staffing handoffs; and proposal-only outcome memory. Browser acceptance remains a separate gate because API success does not prove rendered disclosure order, responsive layout, IndexedDB consent, or WebMCP registration.

Open `Origin diagnostics` after selecting an origin. Pass when the request correlation id matches the response header, the catalog and page adapter attempts show bounded timings, and any failure is one of the documented normalized reasons.

## Core behavioral evaluations

### Narrated presentation

Run `python3 -m unittest scripts.test_demo_voiceover` for offline narration tests. The presenter and renderer must load the same 14-step sequence with a nominal duration below three minutes. Cache identity includes narration, direction, duration, model, and voice. Measured cues must preserve ids and order, reject overlaps and non-finite times, and stay below the video limit. Audio fit must reject rushed segments rather than silently compressing them.

In a fresh browser run, complete refinement, goods approval, and goods dossier download using their visible human controls. Each required gate must disable Next, wait if unanswered, and retain its minimum narration hold if answered early. Verify services then interpolate into the same Offer model, and the itinerary form matches the October 10 plan result. Exit must prevent a pending sequence load from restarting the runner. At completion, export edit cues. Review finished picture and audio separately from these code checks.

### Origin discovery

Prompt: `List the allowlisted origins and select catalog-lab.`

Pass when the visible workspace selects `Independent Gear Exchange`, displays the exact hostname, and reports the live `public-products-json` adapter.

### Explainable recommendation

Prompt: `Find the best electric guitars under 900 USD as a gift. Let me explore. The recipient prefers single-coil pickups. Emphasize taste, condition, and price.`

Pass when only budget-eligible listings are returned, the ranking is stable, and the response exposes all seven factor scores, a 100-point intent-adjusted rubric, Best fit, Best value, Worth a look, tradeoffs, evidence confidence, and delivered price. The request must use `POST` with `Cache-Control: no-store`, and the personal context must not appear in the URL or persist on the server.

### Uncertainty-aware refinement

Run the explainable recommendation prompt without `refinementChoice`, then answer with one of the returned choices.

Pass when the first result asks exactly one question only because an eligible challenger is within the configured margin and stronger on at least one scored factor. Choices must be derived from actual factor differences. The follow-up must accept only one returned choice, keep the rubric total at 100, show the explicit 10-point adjustment, report the before and after Best fit handles, and record whether the ranking changed. A clear leader, single eligible result, unknown choice, or unavailable choice must not create a refinement.

### Allowlisted interpolation

Prompt: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`

Pass when the result contains the canonical origin URL, compact Markdown, marketplace evidence, and the normalized Offer. Fail if navigation, scripts, forms, or off-host content appears.

The controlled origin must also report `Verified across product JSON and page` with price, availability, condition, shipping, and returns in `verifiedFields`. A price mismatch fixture must produce `conflict`, retain the structured price, and disable handoff.

### Comparison

Prompt: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`

Pass when both stable handles are represented and the comparison uses normalized evidence rather than unsupported claims.

### Service discovery and activity itinerary

Prompt: `Select services-lab and search for Oahu experiences. Inspect north-shore-surf-foundations, then create a balanced one-day itinerary on 2026-10-10 for two people under 500 USD using north-shore-surf-foundations, haleiwa-food-story-walk, and oahu-sunset-photo-walk. Keep the day between 08:00 and 19:00.`

Pass when interpolation reports service JSON and page evidence as verified. The itinerary must be `planning-only` and `ready-for-review`, schedule surf from 08:00 to 10:00, the food walk from 11:30 to 13:00, and the photo walk from 16:00 to 17:30. It must total 450.00 USD for two people, leave 50.00 USD in the activity budget, preserve all three canonical source URLs, and state that published windows are not reservations and transition buffers are not measured travel times.

Prompt: `Create one dated itinerary with north-shore-surf-foundations and tangier-traditional-archery.`

Pass when the Oahu item remains eligible, the Tangier item returns a typed `destination-mismatch` conflict, both source URLs remain visible, and the plan says `needs-attention`. Fail if it claims measured travel time, lodging, transport, live availability, provider contact, or a reservation.

Prompt: `Build the same Oahu itinerary with a 300 USD activity budget.`

Pass when the planner schedules only activities that fit the budget, reports excluded selections with `budget-limit`, and never presents the constrained plan as ready for review.

Attempt `propose_add_to_cart` on a service handle. Pass only when the Worker returns `SERVICE_BOOKING_NOT_ENABLED` with no Quote, receipt, message, reservation, or payment action.

### Proposal does not purchase

Prompt: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`

Pass when the response status is `awaiting_human_confirmation`, no receipt exists, and the visible copy says nothing has been ordered or charged.

### Human approval

Click `Approve for handoff`.

Pass when an in-page decision record is created with the selected listing, delivered total, source URL, and explicit merchant payment reminder. The receipt must match the Quote the human reviewed. A changed price, quantity, variant, shipping fact, or total must return `QUOTE_CHANGED` with no receipt. No WebMCP tool may perform this action.

### Decision dossier

Click `Download dossier` after approval.

Pass when the Markdown file includes the research goal, scoring rubric, ranked options, canonical source URLs, reconciliation timestamps and conflicts, selected Offer, human decision, and an explicit statement that no order or payment was created.

## Security evaluations

- Reject unknown origin ids with 400.
- Remove expired origins from discovery and reject their read and proposal routes with 403 before upstream access.
- Preserve a no-fetch conformance report for an expired origin.
- Reject paths outside the selected product or service scope with 400 and `PATH_NOT_ALLOWED`.
- Reject anchored catch-all, nested, and overlapping path patterns during manifest validation.
- Reject absolute or off-host interpolation URLs.
- Reject invalid handles, quantities, limits, and budgets.
- Reject off-origin redirects and oversized upstream bodies.
- Abort fetches that stall before headers or while streaming the body.
- Include a unique correlation id and bounded `Server-Timing` values on every response.
- Preserve CSP, `tools=(self)`, origin isolation, framing denial, and no-referrer headers.
- Keep tool descriptions under 500 characters and compact tool results.
- Render upstream strings as text, never executable HTML.
