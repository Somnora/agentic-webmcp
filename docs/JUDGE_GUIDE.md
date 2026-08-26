# Judge testing guide

## Access

- App URL: https://agentic-webmcp.somnora.workers.dev/
- Credentials: none
- Current code expectation after deployment: `8 WebMCP tools registered`
- Default origin: `review-shop`
- Hostname: `agentic-app-review-test.myshopify.com`
- Deployment identity: `/health` and the footer show the exact deployed commit.

If the browser does not expose `document.modelContext`, the page reports that state and keeps the same manual controls available.

## Exact evaluation flow

1. Ask: `List the allowlisted origins and show which adapter each one uses.`
   - Expected tool: `list_origins`
   - Expected result: one origin with id `review-shop`, exact hostname, primary Storefront adapter, and public products JSON fallback.

2. Ask: `Select review-shop for the rest of this task.`
   - Expected tool: `select_origin`
   - Expected visible change: the origin switcher and badge show the review shop. Selection is page-local and sessionless.
   - The origin health line separately reports catalog adapter access and product page access.

3. Ask: `Search the selected origin for wax and return the stable handles.`
   - Expected tool: `search_products`
   - Expected handle: `selling-plans-ski-wax`
   - Expected visible change: the offer grid and activity rail update.

4. Ask: `Interpolate /products/the-complete-snowboard into a stripped page view and show the canonical URL and structured Offer.`
   - Expected tool: `interpolate_page`
   - Expected handle: `the-complete-snowboard`
   - Expected visible change: the stripped Markdown panel shows the canonical origin URL as text and the workspace shows the normalized Offer.
   - Expected provenance: title, description, pricing, availability, and variants identify their adapter.
   - Current access note: if the merchant page redirects to `/password`, the result must say `pageLive: false` and identify the labeled fallback. It must never claim that blocked HTML was read.

5. Ask: `Compare the-complete-snowboard and selling-plans-ski-wax using only origin facts.`
   - Expected tool: `compare_products`
   - Expected visible change: two comparison cards and a compact result.

6. Ask: `Propose adding quantity 1 of the Ice variant of the-complete-snowboard to the cart, then stop for my confirmation.`
   - Expected tool: `propose_add_to_cart`
   - Expected visible change: a banner says it is waiting for human confirmation and the cart remains empty.
   - Human action: click `Confirm add to cart`.
   - Expected receipt: status `in_cart` appears in the shared cart.

No agent tool can confirm, commit, checkout, or pay.

The activity rail can be exported with `Copy trace` to show tool names, validated arguments, actors, source origin, and compact results.

## Source labels

The origin itself is a live merchant hostname. The data badge separately reports the adapter state:

- `LIVE | shopify-storefront` when a valid read-only Storefront token succeeds.
- `LIVE | shopify-products-json` when the public JSON endpoints succeed.
- `FALLBACK | bundled-snapshot` when neither live catalog adapter is readable.

Never interpret the fallback label as current live inventory.

## Security spot checks

- Try `originId=unknown-shop`: expected HTTP 400 with `ORIGIN_NOT_ALLOWED`.
- Try interpolating `/collections/all`: expected HTTP 400 with `PATH_NOT_ALLOWED`.
- Try an absolute URL on another host: expected HTTP 400.
- Call `/api/cart/commit` without the human confirmation header: expected HTTP 400.
- Inspect response headers for CSP, `tools=(self)`, origin agent clustering, and framing denial.
- Inspect `X-Agentic-Cache` on repeated validated GET requests for `MISS` or `HIT`.

## Reproduction

```bash
git clone https://github.com/Somnora/agentic-webmcp.git
cd agentic-webmcp
npm ci
npm run verify
```

The local gate requires no credentials and does not deploy.
