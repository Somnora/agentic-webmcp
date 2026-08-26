# Agentic WebMCP: Devpost working draft

## Summary

Agentic WebMCP is a shared agent view over explicitly allowlisted merchant websites. One Cloudflare Worker normalizes Storefront GraphQL, public products JSON, JSON-LD, Cloudflare HTMLRewriter page text, and a labeled snapshot fallback into a common Offer graph with field-level provenance. The agent receives compact tools while the human sees the same origin, facts, comparison, proposal, and result.

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
  -> Storefront GraphQL or public products JSON or labeled snapshot
  -> allowlisted HTML and JSON-LD interpolation
  -> normalized Offer graph
  -> visible origin badge, grid, comparison, stripped view, activity, proposal, and cart receipt
```

The Worker accepts no arbitrary upstream URL. It enforces HTTPS, exact hostnames, declared paths, redirect restrictions, response byte limits, request bounds, strict handles, and origin consistency. It preserves CSP, self-only tools permission, origin agent clustering, framing denial, no-referrer behavior, and Worker-side validation.

## Testing instructions

1. Open https://agentic-webmcp.somnora.workers.dev/ in a WebMCP-capable browser after deploying the current branch.
2. No account or credentials are required.
3. Confirm `8 WebMCP tools registered`.
4. Ask: `List the allowlisted origins and select review-shop.`
5. Ask: `Search the selected origin for wax and return the stable handles.`
6. Ask: `Interpolate /products/the-complete-snowboard into stripped Markdown and a structured Offer.`
7. Ask: `Compare the-complete-snowboard and selling-plans-ski-wax using only origin facts.`
8. Ask: `Propose adding quantity 1 of the Ice variant of the-complete-snowboard and wait for me.`
9. Verify the cart is unchanged until you click `Confirm add to cart`, then verify an `in_cart` receipt appears.

If the source badge says `FALLBACK | bundled-snapshot`, treat the result as a labeled demonstration snapshot, not current live inventory. On August 26, 2026, the default storefront redirected public catalog and product paths to `/password`.

## Public links

- App: https://agentic-webmcp.somnora.workers.dev/
- Repository: https://github.com/Somnora/agentic-webmcp
- Privacy: https://agentic-webmcp.somnora.workers.dev/privacy.html
- Demo video: `TODO: public YouTube URL after James records it`

## Verification

- Strict TypeScript: passed locally on August 26, 2026.
- Unit and route tests: 34 of 34 passed locally.
- Worker dry run: passed locally on August 26, 2026.
- Updated production smoke check: pending deployment by James.
- Updated WebMCP browser pass: pending deployment by James.
- Public YouTube video: missing and required.

## Known limitations

- Only one real public Origin record is configured.
- The default storefront is currently password-protected for public catalog and HTML reads.
- Live Storefront GraphQL depends on an optional read-only secret whose production presence was not inspected in this task.
- A password-protected HTML page cannot be honestly shown as a live stripped page without changing origin access or adding another permitted real hostname.
- Browser tool discovery requires a WebMCP-capable client. Manual controls remain available elsewhere.
- The receipt is page-local and not a merchant cart.

## Submission readiness

- Public repository: present.
- Live URL: present but not updated by this task.
- Privacy disclosure: updated in source.
- Judge flow and prompt script: updated in source.
- Automated local gate: strict TypeScript, 34 of 34 tests, and Worker dry run passed.
- Public YouTube video: missing and required.

Do not paste this file into Devpost until the current branch is deployed, the live judge flow is verified, current screenshots are captured outside the repository, and the public YouTube URL exists.
