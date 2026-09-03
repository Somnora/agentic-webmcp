# Devpost submission copy

## Project title

Agentic WebMCP

## Tagline

An explainable market decision layer for people and web agents.

## Inspiration

Visual websites make agents infer controls and reconstruct product facts from presentation markup. We wanted a page where the agent and the person share the same source, evidence, recommendation, and approval boundary.

## What it does

Agentic WebMCP exposes ten WebMCP tools over explicitly allowlisted product and service origins. It converts public catalog JSON, Storefront GraphQL, JSON-LD, and stripped page content into a common Offer protocol. On the default guitar marketplace, an agent can search, rank options against session-only taste and intent, ask one evidence-derived refinement when credible choices have competing strengths, inspect a product page as Markdown plus structured data, compare listings, and prepare a purchase review. On the controlled services scope, the same Offer contract can represent a local professional or destination activity and assemble selected options into a planning-only itinerary.

The final decision stays human-controlled. The agent cannot place an order or pay. A visible button creates only a page-local approved selection and links back to the merchant. Before recording it, the Worker rereads the Offer and requires every line and total to match the Quote the person reviewed.

## How we built it

- Cloudflare Workers serve the application and a separate controlled public origin.
- `src/origins.ts` is a validated authorization manifest with exact hosts, paths, capabilities, response limits, freshness policy, and review dates.
- All adapters normalize into the same `Offer` structure.
- Every normalized Offer is checked against its origin manifest and exposes provenance, freshness, and live-only handoff eligibility.
- Product JSON and page JSON-LD reconcile price, availability, condition, shipping, and returns into verified, single-source, or conflict evidence states.
- Service JSON and page JSON-LD reconcile price, availability, provider, location, duration, scheduling, and cancellation in the same provenance system.
- The Oahu itinerary planner projects selected service Offers into a one-to-three-day timeline. It checks destination, date, party size, budget, pace, day hours, published windows, evidence, and conservative transition buffers, then separates scheduled activities from typed conflicts.
- The recommender uses session-only taste and intent plus deterministic factor scores for relevance, preference fit, condition, delivered price, seller confidence, returns, and delivery.
- Ranked output distinguishes Best fit, Best value, Worth a look, and Strong alternative with a reason, tradeoff, and evidence confidence.
- The uncertainty checkpoint exposes competing evidence, accepts only a returned priority, applies a visible rubric adjustment, and reports whether the human answer changed Best fit.
- The interpolation route validates the origin and path, extracts structured facts, removes page chrome, and returns compact Markdown.
- Browser tools call the same actions as the manual UI and update the shared workspace.
- The browser generates a portable Markdown decision dossier with the goal, ranked evidence, canonical sources, conflicts, selected Offer, and human decision.
- The origin diagnostics drawer shows correlation, adapter timing, time limits, normalized failure reasons, and evidence state without exposing upstream content or secrets.
- Worker-side validation, response time and byte bounds, restrictive headers, and human-only approval limit the trust boundary.

## Challenges

The main challenge was making a useful live-web demonstration without claiming access to unrelated retailers or weakening the security model with arbitrary URL fetching. We chose a controlled public guitar marketplace with original listings, kept the Shopify adapter as a secondary labeled origin, and made provenance and limitations visible.

## Accomplishments

- Ten coherent WebMCP tools, including explainable recommendation, page interpolation, and constraint-aware activity itinerary planning.
- One Offer model across public JSON, Shopify, JSON-LD, and HTML projections.
- Exact-host and restrictive path allowlisting with bounded fetches and redirect checks.
- Fail-closed rejection of fallback, stale, or unavailable Offers before purchase review.
- Cross-source evidence verification with visible conflict handling.
- A downloadable decision dossier with the goal, taste and intent, ranking rationale, tradeoffs, evidence, selection, and human decision that remains local to the browser.
- A polished shared workspace with source-visible ranking and smooth presentation focus.
- A quote-bound, human-only purchase handoff with no agent checkout or payment capability.

## What we learned

The strongest agent interface is not just hidden structure. It gives the person enough visibility to understand why the agent chose an option, where every fact came from, and exactly where automation stops.

## What's next

With operator permission, the same protocol can support additional real origins, richer marketplace evidence, live provider availability, and itinerary-aware destination services. A production handoff could use an operator-owned booking or checkout link, but provider contact, reservations, payments, and orders remain outside this Challenge build.

## Judge flow

1. Confirm ten tools are registered.
2. Ask: `List the allowlisted origins and select catalog-lab.`
3. Ask: `Find the best electric guitars under 900 USD as a gift. Let me explore. The recipient prefers single-coil pickups. Emphasize taste, condition, and price.`
4. Choose one priority at the decision checkpoint and show the resolved ranking.
5. Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`
6. Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`
7. Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`
8. Click `Approve for handoff` as the human and show the decision record.
9. Download the decision dossier and show the portable evidence record.

## Disclosure

The default origin is a first-party controlled public demonstration marketplace with original guitar listings. Its HTTPS responses and interpolation are live, but the listings are not presented as eBay or another third-party merchant. The secondary Shopify development store is operator-authorized but remains research-only while Shopify password protection blocks public inventory. The app does not place orders or handle payment.

The optional services scope uses seven original controlled fixtures on the same first-party hostname under a disjoint `/services/*` allowlist. Five Oahu experiences create a coherent destination set, while Tangier and a non-itinerary home service demonstrate destination and eligibility conflicts. It demonstrates data shape, provenance, page conversion, budget-aware scheduling, and itinerary planning. It does not claim real provider inventory, measured travel time, bookings, messages, or payment.
