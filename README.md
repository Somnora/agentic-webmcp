# Agentic WebMCP

[![Verify](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml/badge.svg)](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml)

Agentic WebMCP is an open-source webpage converter and shared agent view over explicitly allowlisted product websites. The app Worker compiles public product JSON, Storefront GraphQL, JSON-LD, stripped page Markdown, and labeled fallback facts into the shared `Offer` protocol. Tool calls update the visible workspace so the human sees the same origin, facts, proposal, and result as the agent.

Live URL: [agentic-webmcp.somnora.workers.dev](https://agentic-webmcp.somnora.workers.dev/)

The `/health` response and page footer expose the deployed Git commit and Cloudflare Worker version so judges can match the live app to this repository.

## Registered WebMCP tools

The top-level document calls `document.modelContext.registerTool` for exactly eight tools:

- `list_origins`: list the exact HTTPS origins the Worker may read.
- `select_origin`: select one origin in page-local state.
- `search_products`: search normalized offers on the selected origin.
- `get_product`: inspect one offer and its sampled variants.
- `compare_products`: compare two to four handles on one origin.
- `interpolate_page`: strip an allowlisted product path into compact Markdown plus an `Offer`.
- `create_catalog_brief`: build deterministic Markdown from selected offers.
- `propose_add_to_cart`: stage a quote and visible human confirmation banner.

The first seven tools are read-only and untrusted-content annotated. `propose_add_to_cart` is non-destructive and does not change the cart. There is no WebMCP commit or checkout tool. Only the visible human confirmation button can call `/api/cart/commit`, which creates an in-page `Receipt` with status `in_cart`.

## Default origin and adapter chain

`src/origins.ts` contains two public origin records. The default recording origin is:

- id: `catalog-lab`
- mode: `controlled-demo`
- hostname: `agentic-webmcp-origin.somnora.workers.dev`
- vertical: `retail`
- primary adapter: `public-products-json`
- catalog content: four original fixture products with no external images
- page projection: `html-markdown` with JSON-LD extraction when present
- mutations: none

The origin is a separate public Worker with real HTTPS JSON and semantic HTML responses. The interface labels it `controlled-demo` and `LIVE DEMO`; it is not presented as current merchant inventory. The secondary `review-shop` record preserves the Shopify adapter and labeled snapshot fallback but remains password protected because it is a Shopify development store.

Every Offer includes field-level provenance for title, description, pricing, availability, and variants. The origin health endpoint reports the active catalog adapter and whether the representative product page is publicly readable.

`CATALOG_STOREFRONT_TOKEN` is optional and applies only to the secondary Shopify origin. It must be stored as a Wrangler secret or in an ignored `.dev.vars` file. The controlled origin requires no credentials and serves `/products.json`, `/products/{handle}.json`, and `/products/{handle}`.

As verified on August 26, 2026, the secondary Shopify storefront redirects public catalog and product paths to `/password`. Selecting that origin without a token uses the labeled snapshot. A deployed read-only Storefront token can restore live structured data, but it does not make a password-protected HTML page publicly readable.

## Security boundary

The Worker never accepts an arbitrary upstream URL. Every upstream request must satisfy all of these checks:

- HTTPS only.
- Exact hostname match against `src/origins.ts`.
- Product path match against the origin record.
- No off-origin redirects and no redirect to a non-allowlisted path.
- Bounded request bodies and bounded upstream response bytes.
- Strict handles, limits, origin ids, and comparison counts.
- Untrusted origin strings rendered with `textContent`.
- Short Cache API entries keyed only by the validated same-origin request URL.
- Structured API errors with stable codes and retry guidance.

Responses preserve a restrictive CSP, `Permissions-Policy: tools=(self)`, `Origin-Agent-Cluster: ?1`, framing denial, MIME-sniffing protection, and no-referrer behavior. The build has no checkout, payment, Admin API, accounts, cookies, analytics identifiers, or commercial application integration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

No credentials are required. The default controlled origin returns live public product JSON and live product HTML. The Shopify origin retains the labeled snapshot behavior while it is protected.

For WebMCP discovery, use a client that exposes the Imperative API. Other browsers retain the complete manual preview and accurately report that WebMCP is not detected.

## Presenter mode

Click `Presenter mode` in the header or add `?present=1` to the app URL. At 1280 by 720, presenter mode removes the landing-page sections and gives the workspace the full recording viewport. It adds:

- One focus frame that smoothly changes position, size, and corner radius between affected workspace regions.
- A precise SVG pointer that follows actual mouse input and moves to the result of a WebMCP call.
- A tool overlay with validated input, narration copy, and a concise under-the-hood explanation.
- A 2 minute 28 second rehearsal with pause and next controls.
- A required stop at the cart proposal. The rehearsal cannot advance past that boundary until the visible human confirmation button is clicked.

Presenter mode observes the existing action functions. It does not register another tool, fabricate a commit tool, or weaken the human confirmation boundary. Use the timed rehearsal to practice narration. For the final recording, leave presenter mode open and invoke the real WebMCP tools from the browser agent.

## Verify

```bash
npm run typecheck
npm test
npm run verify
```

`npm run verify` runs strict TypeScript, the Vitest suite, and Wrangler deployment dry runs for both Workers. It does not deploy.

After James explicitly deploys this branch, the separate live smoke command is:

```bash
AGENTIC_WEBMCP_URL=https://agentic-webmcp.somnora.workers.dev npm run verify:live
```

`npm run deploy` refuses a dirty worktree, deploys the controlled origin and app Workers, records the exact app commit in `/health`, and runs the live smoke suite. A separate manually triggered GitHub workflow can repeat the public smoke check.

## Architecture

```text
Top-level browser document
  -> document.modelContext.registerTool(...)
  -> shared manual and WebMCP actions
  -> same-origin Worker API
  -> selected Origin record from src/origins.ts
  -> controlled public product JSON or Shopify adapter chain
  -> optional allowlisted HTML and JSON-LD interpolation
  -> one normalized Offer graph
  -> visible provenance, origin health, grid, comparison, stripped view, proposal, cart, and exportable activity rail
```

See the [judge guide](docs/JUDGE_GUIDE.md), [demo script](docs/DEMO_SCRIPT.md), [evaluation plan](docs/EVALS.md), [threat model](docs/THREAT_MODEL.md), [offer protocol](docs/OFFER_PROTOCOL.md), and [submission draft](docs/SUBMISSION_COPY.md).

## Project boundary

This public repository is the complete Challenge application. The separate commercial Agentic project is not imported, called, or required. This build uses no commercial secrets, Worker, App Proxy, HMAC, storage, or Admin API.

## License

[MIT](LICENSE)
