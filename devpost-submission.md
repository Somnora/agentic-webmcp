# Agentic WebMCP: Devpost working draft

## Summary

Agentic WebMCP is a webpage converter and shared agent view over explicitly allowlisted product websites. The app Worker normalizes controlled public product JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, stripped Markdown, and labeled fallback facts into a common Offer graph with field-level provenance. The agent receives compact tools while the human sees the same origin, facts, comparison, proposal, and result.

## What it does

- Lists exact HTTPS origins allowed by the Worker.
- Selects an origin in sessionless page state.
- Searches and inspects normalized offers.
- Compares two to four stable handles on one origin.
- Interpolates one allowlisted product path into stripped Markdown plus a structured Offer.
- Creates deterministic, source-only catalog briefs.
- Stages a cart quote and waits for a visible human confirmation.
- Creates only an in-page `in_cart` receipt after the human clicks the button.
- Reports origin health, stable error codes, exact deployment identity, and an exportable shared activity trace.
- Includes a 1280 by 720 presenter mode whose focus frame, precise cursor, tool inputs, and implementation captions react to the same actions as real WebMCP calls.

## Registered tools

- `list_origins`
- `select_origin`
- `search_products`
- `get_product`
- `compare_products`
- `interpolate_page`
- `create_catalog_brief`
- `propose_add_to_cart`

There is no WebMCP commit, checkout, order, or payment tool.

## Architecture

```text
Top-level document
  -> eight document.modelContext.registerTool calls
  -> shared manual and agent action functions
  -> same-origin Worker routes
  -> Origin record from src/origins.ts
  -> controlled public product JSON or Shopify adapter chain
  -> allowlisted HTML and JSON-LD interpolation
  -> normalized Offer graph
  -> visible origin badge, grid, comparison, stripped view, activity, proposal, and cart receipt
  -> optional presenter observes the same actions without registering another tool
```

The Worker accepts no arbitrary upstream URL. It enforces HTTPS, exact hostnames, declared paths, redirect restrictions, response byte limits, request bounds, strict handles, and origin consistency. It preserves CSP, self-only tools permission, origin agent clustering, framing denial, no-referrer behavior, and Worker-side validation.

## Testing instructions

1. Open https://agentic-webmcp.somnora.workers.dev/?present=1 in a WebMCP-capable browser after deploying the current branch.
2. No account or credentials are required.
3. Confirm `8 WebMCP tools registered`.
4. Ask: `List the allowlisted origins and select catalog-lab.`
5. Ask: `Search the selected origin for notebook and return the stable handles.`
6. Ask: `Interpolate /products/field-notebook into stripped Markdown and a structured Offer.`
7. Ask: `Compare field-notebook and modular-desk-tray using only origin facts.`
8. Ask: `Propose adding quantity 1 of the Sand variant of field-notebook and wait for me.`
9. Verify the cart is unchanged until you click `Confirm add to cart`, then verify an `in_cart` receipt appears.

The default badge must say `LIVE DEMO | public-products-json`. This means the app fetched the controlled origin over HTTPS; it does not mean the fixture is merchant inventory. The secondary Shopify development store remains password protected and is not used in the recording flow.

## Public links

- App: https://agentic-webmcp.somnora.workers.dev/
- Repository: https://github.com/Somnora/agentic-webmcp
- Privacy: https://agentic-webmcp.somnora.workers.dev/privacy.html
- Demo video: `TODO: public YouTube URL after James records it`

## Verification

- Strict TypeScript: passed locally on August 26, 2026.
- Unit and route tests: 43 of 43 passed locally.
- Worker dry run: passed locally on August 26, 2026.
- Updated production smoke check: 13 of 13 checks passed against both Workers on August 26, 2026, including the presenter asset.
- Updated browser pass: the 1280 by 720 presenter rehearsal completed interpolation, comparison, proposal, required human confirmation, and receipt with no console warnings. The production workspace reported the controlled origin badge, live catalog and page health, four offers, and the deployed commit.
- WebMCP discovery evidence: connected Chrome reported eight registered tools on the prior production commit. The final presenter change did not alter `public/tools.js`; the current Chrome extension connection was unavailable for a redundant post-deploy pass.
- Public YouTube video: missing and required.

## Known limitations

- The default recording origin is controlled demonstration data, not a real merchant catalog.
- The secondary Shopify development store is password protected and its public access toggle is disabled without a plan or transfer change.
- Live Storefront GraphQL for the secondary origin depends on an optional read-only secret whose production presence was not inspected.
- Browser tool discovery requires a WebMCP-capable client. Manual controls remain available elsewhere.
- The receipt is page-local and not a merchant cart.

## Submission readiness

- Public repository: present.
- Live URL: updated and verified on August 26, 2026.
- Privacy disclosure: updated and deployed.
- Judge flow and prompt script: updated and deployed.
- Automated local gate: strict TypeScript, 43 of 43 tests, and both Worker dry runs passed.
- Public YouTube video: missing and required.

Do not paste this file into Devpost until current screenshots are captured outside the repository and the public YouTube URL exists.
