# Judge testing guide

## Access

- App URL: https://agentic-webmcp.somnora.workers.dev/
- Credentials: none
- Current code expectation after deployment: `8 WebMCP tools registered`
- Default origin: `catalog-lab`
- Origin mode: `controlled-demo`
- Hostname: `agentic-webmcp-origin.somnora.workers.dev`
- Deployment identity: `/health` and the footer show the exact deployed commit.

If the browser does not expose `document.modelContext`, the page reports that state and keeps the same manual controls available.

Optional presentation aid: click `Presenter mode` or add `?present=1`. This changes only the recording layout. Real WebMCP calls move one focus frame to the workspace they updated and show the tool input plus an implementation note. The guided demo uses the same application actions, shows no voice-over countdown, and stops for the real human confirmation button.

## Exact evaluation flow

1. Ask: `List the allowlisted origins and show which adapter each one uses.`
   - Expected tool: `list_origins`
   - Expected result: `catalog-lab` is the default controlled demo origin and `review-shop` is the secondary password-protected Shopify development store.

2. Ask: `Select catalog-lab for the rest of this task.`
   - Expected tool: `select_origin`
   - Expected visible change: the origin switcher shows Agentic Catalog Lab and the badge says `LIVE DEMO | public-products-json`. Selection is page-local and sessionless.
   - The origin health line separately reports catalog adapter access and product page access.

3. Ask: `Search the selected origin for notebook and return the stable handles.`
   - Expected tool: `search_products`
   - Expected handles include `field-notebook` and `modular-desk-tray`.
   - Expected visible change: the offer grid and activity rail update.

4. Ask: `Interpolate /products/field-notebook into a stripped page view and show the canonical URL and structured Offer.`
   - Expected tool: `interpolate_page`
   - Expected handle: `field-notebook`
   - Expected visible change: the stripped Markdown panel shows the canonical origin URL as text and the workspace shows the normalized Offer.
   - Expected provenance: title, description, pricing, availability, and variants identify their adapter.
   - Expected status: `live: true` and `pageLive: true`. Navigation, footer, script, style, frame, and form content must not appear in the stripped projection.

5. Ask: `Compare field-notebook and modular-desk-tray using only origin facts.`
   - Expected tool: `compare_products`
   - Expected visible change: two comparison cards and a compact result.

6. Ask: `Propose adding quantity 1 of the Sand variant of field-notebook to the cart, then stop for my confirmation.`
   - Expected tool: `propose_add_to_cart`
   - Expected visible change: a banner says it is waiting for human confirmation and the cart remains empty.
   - Human action: click `Confirm add to cart`.
   - Expected receipt: status `in_cart` appears in the shared cart.

No agent tool can confirm, commit, checkout, or pay.

The activity rail can be exported with `Copy trace` to show tool names, validated arguments, actors, source origin, and compact results.

## Source labels

The default origin is a controlled public demo catalog, not merchant inventory. Its data badge reports:

- `LIVE DEMO | public-products-json` when the public JSON service succeeds.
- `LIVE PAGE MARKDOWN` when the allowlisted HTML page is fetched and stripped.
- `FALLBACK | bundled-snapshot` only when the secondary Shopify origin cannot use a live catalog adapter.

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
