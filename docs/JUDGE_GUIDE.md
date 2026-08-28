# Judge guide

## What to verify

Agentic WebMCP turns allowlisted public product pages into structured, source-visible decisions. The default origin is a controlled public guitar marketplace served over real HTTPS. It is clearly labeled demonstration data and does not impersonate eBay or another merchant.

The key interaction is not a chatbot transcript. Each WebMCP call updates the same visible workspace the human is viewing. Ranking factors, canonical source links, normalized offers, and the approval boundary remain inspectable.

## No-credential flow

Open [the live app](https://agentic-webmcp.somnora.workers.dev/) in a WebMCP-capable client. Presenter mode is optional and changes only the recording layout.

1. Confirm the page reports nine registered tools.
2. Ask: `List the allowlisted origins and select catalog-lab.`
3. Ask: `Find the best electric guitars under 900 USD. Rank them by condition, delivered price, seller confidence, and returns.`
4. Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`
5. Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`
6. Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`
7. Confirm the review says nothing has been ordered or charged.
8. Click `Approve for handoff` yourself.
9. Verify the approved selection includes a source link and still says payment remains with the merchant.

## Expected evidence

- Origin: `Independent Gear Exchange`
- Host: `agentic-webmcp-origin.somnora.workers.dev`
- Source mode: `controlled-demo`
- Live adapter: `public-products-json`
- Representative handles: `sunburst-s-style-electric`, `mahogany-single-cut-electric`, `natural-dreadnought-acoustic`, `offset-electric-ocean-blue`
- Interpolation output: canonical URL, compact Markdown, structured `Offer`, and provenance
- Recommendation output: deterministic scores for relevance, condition, delivered price, seller confidence, and returns
- Human boundary: no commit, checkout, order, or payment tool exists

## Important limits

The public origin and page fetches are live, but the four listings are original controlled demonstration data. The app does not search arbitrary websites, scrape eBay, place an order, handle money, or create a merchant account. The secondary Shopify origin may show a labeled snapshot when public inventory is unavailable.
