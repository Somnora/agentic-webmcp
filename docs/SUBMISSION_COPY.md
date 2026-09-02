# Devpost submission copy

## Project title

Agentic WebMCP

## Tagline

An explainable market decision layer for people and web agents.

## Inspiration

Visual websites make agents infer controls and reconstruct product facts from presentation markup. We wanted a page where the agent and the person share the same source, evidence, recommendation, and approval boundary.

## What it does

Agentic WebMCP exposes nine WebMCP tools over explicitly allowlisted product origins. It converts public product JSON, Storefront GraphQL, JSON-LD, and stripped page content into a common Offer protocol. On the default guitar marketplace, an agent can search, rank options by visible evidence, inspect a product page as Markdown plus structured data, compare listings, and prepare a purchase review.

The final decision stays human-controlled. The agent cannot place an order or pay. A visible button creates only a page-local approved selection and links back to the merchant. Before recording it, the Worker rereads the Offer and requires every line and total to match the Quote the person reviewed.

## How we built it

- Cloudflare Workers serve the application and a separate controlled public origin.
- `src/origins.ts` is a validated authorization manifest with exact hosts, paths, capabilities, response limits, freshness policy, and review dates.
- All adapters normalize into the same `Offer` structure.
- Every normalized Offer is checked against its origin manifest and exposes provenance, freshness, and live-only handoff eligibility.
- Product JSON and page JSON-LD reconcile price, availability, condition, shipping, and returns into verified, single-source, or conflict evidence states.
- The recommender uses deterministic factor scores for relevance, condition, delivered price, seller confidence, and returns.
- The interpolation route validates the origin and path, extracts structured facts, removes page chrome, and returns compact Markdown.
- Browser tools call the same actions as the manual UI and update the shared workspace.
- The browser generates a portable Markdown decision dossier with the goal, ranked evidence, canonical sources, conflicts, selected Offer, and human decision.
- The origin diagnostics drawer shows correlation, adapter timing, time limits, normalized failure reasons, and evidence state without exposing upstream content or secrets.
- Worker-side validation, response time and byte bounds, restrictive headers, and human-only approval limit the trust boundary.

## Challenges

The main challenge was making a useful live-web demonstration without claiming access to unrelated retailers or weakening the security model with arbitrary URL fetching. We chose a controlled public guitar marketplace with original listings, kept the Shopify adapter as a secondary labeled origin, and made provenance and limitations visible.

## Accomplishments

- Nine coherent WebMCP tools, including explainable recommendation and page interpolation.
- One Offer model across public JSON, Shopify, JSON-LD, and HTML projections.
- Exact-host and restrictive path allowlisting with bounded fetches and redirect checks.
- Fail-closed rejection of fallback, stale, or unavailable Offers before purchase review.
- Cross-source evidence verification with visible conflict handling.
- A downloadable decision dossier that remains local to the browser.
- A polished shared workspace with source-visible ranking and smooth presentation focus.
- A quote-bound, human-only purchase handoff with no agent checkout or payment capability.

## What we learned

The strongest agent interface is not just hidden structure. It gives the person enough visibility to understand why the agent chose an option, where every fact came from, and exactly where automation stops.

## What's next

With merchant permission, the same protocol can support additional real origins and richer marketplace evidence. A production handoff could use a merchant-owned checkout link or account system, but payments and orders remain outside this Challenge build.

## Judge flow

1. Confirm nine tools are registered.
2. Ask: `List the allowlisted origins and select catalog-lab.`
3. Ask: `Find the best electric guitars under 900 USD. Rank them by condition, delivered price, seller confidence, and returns.`
4. Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`
5. Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`
6. Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`
7. Click `Approve for handoff` as the human and show the decision record.
8. Download the decision dossier and show the portable evidence record.

## Disclosure

The default origin is a first-party controlled public demonstration marketplace with original guitar listings. Its HTTPS responses and interpolation are live, but the listings are not presented as eBay or another third-party merchant. The secondary Shopify development store is operator-authorized but remains research-only while Shopify password protection blocks public inventory. The app does not place orders or handle payment.
