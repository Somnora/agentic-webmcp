# Paste this entire prompt to GPT 5.6 Sol

Assumed model: GPT 5.6 Sol. Effort: high. Repo-only implementation. Do not touch the commercial Shopify app.

```
You are working in /Users/jamesmcshane/APP_PROJECTS/Agentic/agentic-webmcp on branch main after commit 7b4b81e or newer.

Current known state (verify before editing; do not trust README):
- Public repo: https://github.com/Somnora/agentic-webmcp
- Live URL: https://agentic-webmcp.somnora.workers.dev/
- HEAD at 7b4b81e is the last commit. Working tree is DIRTY with an unfinished move off mock.shop:
  modified: .env.example, .gitignore, public/index.html, public/tools.js, src/catalog.ts, src/demo-catalog.ts, src/index.ts, wrangler.jsonc
  untracked: src/cart.ts
- wrangler.jsonc vars.CATALOG_SHOP is already agentic-app-review-test.myshopify.com
- public/tools.js and public/index.html already add propose_add_to_cart (5 tools) plus a human confirm banner
- src/cart.ts implements proposeCartAdd (status awaiting_human_confirmation) and commitCartAdd
- src/index.ts already has POST /api/cart/propose and /api/cart/commit
- test/tools.spec.js still expects exactly 4 tools and hoodie search
- test/catalog.spec.ts still expects source shopify-mock-shop
- README.md, docs/JUDGE_GUIDE.md, docs/DEMO_SCRIPT.md, docs/THREAT_MODEL.md, privacy.html, and devpost-submission.md still describe a 4-tool Mock Shop hoodie/slides/sweatpants demo
- docs/OFFER_PROTOCOL.md is the kernel. Implement it. Do not invent a parallel model.
- Commercial app at /Users/jamesmcshane/APP_PROJECTS/Agentic/agentic is OUT OF SCOPE. Never read its secrets, never call its App Proxy, never import its Worker.

Hackathon: https://webmcp.devpost.com/
Deadline: 2026-09-03 13:00 Pacific. Video is the remaining required artifact after this work.
Judges include Shopify's Ilya Grigorik. Mock.shop and Shopify's generated snowboard sample catalog both look like a sandbox. James does not want a mock-website demo.

Goal: Make Agentic WebMCP an agent view over one or more allowlisted REAL websites, with interpolation (structured catalog plus stripped page) and a human-confirmed cart proposal, then leave the repo green and deployable.

Constraints:
- Stay inside agentic-webmcp. Do not modify the commercial Shopify app, vault notes, or Devpost form.
- Do not commit secrets, .dev.vars, Storefront tokens, screenshots, mp4, or node_modules.
- Do not fetch arbitrary URLs. Allowlist only. HTTPS only. Exact hostname match. No off-host redirects. Bound response bytes.
- Do not scrape Amazon, Allbirds, Nike, Booking.com, Airbnb, or any famous brand. Third-party trademarks in the YouTube video are a rules violation.
- Do not add checkout, payment, Shopify Admin API, commercial HMAC, cookies, accounts, or analytics IDs.
- Do not register a WebMCP commit/checkout tool. Commit is a human button only.
- Keep CSP, Permissions-Policy tools=(self), Origin-Agent-Cluster ?1, framing denial, and Worker-side validation.
- Tool descriptions <= 500 chars. Tool JSON outputs stay compact (~1.5K).
- No em dashes, no en dashes, no emojis, no markdown blockquotes in any copy, comments, docs, or UI strings.
- Do not claim sales impact, token-savings percentages as a customer outcome, or crawler adoption.
- If CATALOG_STOREFRONT_TOKEN is missing, fail over to shopify-products-json for the allowlisted shop, then to the bundled snapshot, and label the source in the UI. Never silently present fallback as live.
- James may later add origin hostnames he owns. Put origins in src/origins.ts as data, not hardcoded through the Worker router.

Tasks:
1. Read docs/OFFER_PROTOCOL.md, src/catalog.ts, src/cart.ts, src/index.ts, public/tools.js, public/app.js, public/index.html, and the failing tests. Finish or rebase the dirty WIP; do not leave a second catalog model beside it.
2. Add src/origins.ts with Origin records. Default live origin: id review-shop, hostname agentic-app-review-test.myshopify.com, vertical retail, adapter shopify-storefront with products-json fallback. Do not add a second public brand. If you need a second origin to prove the selector, make it a clearly labeled local/demo travel or wholesale fixture only when a real hostname is not supplied; prefer one real Shopify merchant plus interpolate_page on that same host over a fake second storefront.
3. Implement adapters that all normalize to Offer:
   - shopify-storefront (existing GraphQL path, keep token optional)
   - shopify-products-json (GET /products.json and /products/{handle}.js on the allowlisted host)
   - html-markdown interpolator for allowlisted paths only (strip nav/footer/script/style/iframe/form, extract JSON-LD if present, return Offer plus compact Markdown)
   Reject any hostname or path that is not on the origin record.
4. Worker routes (same-origin, validated):
   - GET /api/origins
   - POST /api/origins/select  { originId }  (sessionless: selected origin is a query param originId on subsequent reads, default review-shop)
   - GET /api/catalog?query&limit&originId
   - GET /api/products/:handle?originId
   - GET /api/compare?handles&originId
   - POST /api/brief
   - GET /api/interpolate?originId&path
   - POST /api/cart/propose
   - POST /api/cart/commit   (called only from the human confirm button)
5. WebMCP tools in public/tools.js, registered via document.modelContext.registerTool:
   list_origins, select_origin, search_offers (keep search_products as an alias if you must not break the judge guide overnight; prefer renaming consistently and updating the judge guide), get_offer/get_product, compare_offers/compare_products, interpolate_page, create_brief/create_catalog_brief, propose_add_to_cart.
   Minimum coherent set if you need to cut: list_origins, select_origin, search_products, get_product, compare_products, interpolate_page, create_catalog_brief, propose_add_to_cart.
   interpolate_page is the "strip down a real website" demo. It must update the visible workspace with the stripped Markdown and the structured Offer, and it must show the canonical origin URL as text (not as a framed third-party page, which CSP and trademarks both forbid).
6. Human UI:
   - Origin switcher showing display name, hostname, adapter, live/fallback
   - Same grid, comparison, activity rail, result panel
   - interpolate control (path or product URL path only)
   - propose banner + Confirm add to cart / Dismiss
   - Cart list after confirm
   - Copy must say this is a live merchant origin (or labeled fallback), not Mock Shop
   - Suggested prompts must use real handles from the live review shop (snowboard, Ice, wax, etc.), never hoodies/slides/sweatpants
7. Tests: update tools, catalog, interpolate allowlist rejection, cart propose-does-not-commit, and origin mismatch 400s. No remaining shopify-mock-shop assertions unless you keep a compatibility alias that tests explicitly mark as legacy.
8. Docs that judges and the video will use, keep them in lockstep with the running app:
   README.md, docs/JUDGE_GUIDE.md, docs/DEMO_SCRIPT.md, docs/EVALS.md, docs/THREAT_MODEL.md, docs/SUBMISSION_COPY.md, public/privacy.html, devpost-submission.md
   Judge flow (no credentials):
   a. Confirm tools registered
   b. list/select the live review shop
   c. search a real product on that shop
   d. interpolate that product path and show stripped facts
   e. compare two live products
   f. propose add to cart, show the human confirm banner, confirm, show in-cart receipt
9. Run npm run typecheck, npm test, and npm run verify. Fix until green.
10. Do not record the YouTube video and do not deploy unless James asks. Do leave the app recordable: suggested prompts, origin badge, interpolate view, and confirm banner must be visible at 1280x720.

Commit: feat: interpolate allowlisted live origins for WebMCP commerce tools
Report:
- files changed
- tool names actually registered
- default origin and adapters
- test counts
- remaining gaps (token presence, password-protected storefront, second origin)
- exact judge prompts that match live handles
- anything you did not verify
```
