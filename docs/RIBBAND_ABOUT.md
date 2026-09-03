# Ribband: About

## Inspiration

Most of the web is designed to be seen, not understood by an agent. Commerce and service pages bury important facts inside presentation markup, forcing agents to infer controls, reconstruct relationships, and work out of sight of the person who asked for help.

Ribband explores a clearer contract for the next era of surfing the web: move quickly across explicitly authorized sources, preserve the evidence, and keep the final decision with the person. The name nods to the Blue Riband, the historic distinction associated with speed records on Atlantic passenger crossings.

## What it does

Ribband is an open-source, evidence-first decision workspace for people and web agents. It exposes ten WebMCP tools over explicitly allowlisted product and service origins and compiles public product or service JSON, Shopify Storefront GraphQL, JSON-LD, stripped page Markdown, and clearly labeled fallbacks into one normalized `Offer` protocol.

For goods, an agent can search, rank, inspect, compare, create a grounded brief, and prepare a purchase review. Ranking combines session-only taste and intent with visible deterministic factors, reasons, tradeoffs, and evidence confidence. When credible options have competing strengths, Ribband asks one bounded refinement question and shows whether the answer changed the best fit.

For services, the same `Offer` model carries provider, location, duration, price basis, party limits, published windows, cancellation terms, and itinerary eligibility. An agent can assemble one to four selected services into a planning-only itinerary across one to three days. The planner checks destination, date, party size, budget, pace, day hours, published windows, evidence state, and conservative transition buffers. It separates scheduled activities from typed conflicts without claiming a reservation or measured travel time.

Every agent or manual action updates the same visible workspace. The activity rail records sources and results, and the browser can export a local Markdown decision dossier containing the goal, ranking rationale, provenance, conflicts, selected Offer, itinerary, and human decision.

## How I built it

Ribband is a standalone TypeScript application running on Cloudflare Workers. The primary Worker serves the static human workspace, same-origin APIs, security controls, diagnostics, and WebMCP handlers. A separate controlled public Worker serves original goods and service fixtures over live HTTPS. An operator-authorized Shopify origin remains available through a labeled adapter chain when its public storefront permits access.

The top-level document registers exactly ten WebMCP tools:

1. `list_origins`
2. `select_origin`
3. `search_products`
4. `find_best_options`
5. `get_product`
6. `compare_products`
7. `interpolate_page`
8. `create_catalog_brief`
9. `create_activity_itinerary`
10. `propose_add_to_cart`

The first nine tools are read-only. `propose_add_to_cart` is also non-destructive: it stages a short-lived quote for visible human review but cannot approve it, mutate a merchant cart, contact a provider, book, check out, place an order, or pay. Only the on-page human button can create a page-local goods decision record. Before recording that decision, the Worker rereads the Offer and requires the current line and total to match the exact quote the person reviewed.

All source adapters normalize into the same `Offer` graph. Product feeds and page JSON-LD reconcile price, availability, condition, shipping, and returns. Service feeds and page JSON-LD reconcile price, availability, provider, location, duration, scheduling, and cancellation. Each decision field is labeled `verified`, `single-source`, or `conflict`, and the interface preserves canonical source links and freshness information.

## Trust boundary

Ribband never accepts an arbitrary upstream URL. Every upstream request must use HTTPS, match an exact authorized hostname and path, remain within byte and time limits, and reject off-origin or out-of-scope redirects. Each origin is defined by a validated authorization manifest containing its adapter capabilities, response limits, freshness policy, and review date. Expired origins fail closed before an upstream request is made.

For an Offer $o$, goods handoff is allowed only when

$$
\operatorname{HandoffReady}(o)
= L(o) \land F(o) \land A(o) \land \neg C(o) \land G(o),
$$

where $L$ means the source is live, $F$ means the evidence is fresh, $A$ means the Offer is available, $C$ means a cross-source conflict exists, and $G$ means the Offer is a good rather than a service. Snapshot, stale, unavailable, conflicted, and service Offers remain research-only.

For an itinerary with budget limit $B$ and selected activity costs $p_i$, the visible remainder is

$$
B_{\mathrm{remaining}} = B - \sum_{i=1}^{n} p_i.
$$

If the total exceeds $B$, Ribband exposes a budget conflict instead of silently hiding or scheduling an excluded activity. Proposed times remain planning suggestions, not availability checks or reservations.

Origin content is always treated as untrusted and rendered safely. The application has no checkout, payment, Admin API, merchant account, booking, provider-contact, cookies, analytics identifiers, or hidden approval path.

## Challenges and learning

The central challenge was making the agent experience genuinely useful without giving it hidden or irreversible authority. Extending one Offer protocol across both goods and services also required separating facts that can be normalized from actions that remain specific to a vertical.

The strongest lesson was that an agent interface should expose more than tools. Trust improves when authorization, source state, field-level provenance, ranking factors, uncertainty, conflicts, activity, and the human boundary are visible in the same place. A safe refusal is part of the product: Ribband should stop when evidence is stale, contradictory, out of scope, or insufficient for the requested action.

## Current verification

The current local working build passes strict TypeScript checking, 114 automated tests across 16 test files, and deployment dry runs for both Cloudflare Workers. These checks do not by themselves confirm that every local Ribband update has been deployed; the public build should be verified again immediately before submission.
