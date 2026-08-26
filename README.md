# Agentic WebMCP

[![Verify](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml/badge.svg)](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml)

Agentic WebMCP is an open-source agent view over explicitly allowlisted merchant websites. One Worker compiles Storefront GraphQL, public products JSON, JSON-LD, stripped page text, and a labeled snapshot fallback into the shared `Offer` protocol. Tool calls update the visible workspace so the human sees the same origin, facts, proposal, and result as the agent.

Live URL: [agentic-webmcp.somnora.workers.dev](https://agentic-webmcp.somnora.workers.dev/)

The current branch is the source of truth until it is deployed. A prior deployment can show the earlier tool surface.

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

`src/origins.ts` contains one public origin record:

- id: `review-shop`
- hostname: `agentic-app-review-test.myshopify.com`
- vertical: `retail`
- primary adapter: `shopify-storefront`
- catalog fallback: `shopify-products-json`
- page projection: `html-markdown` with JSON-LD extraction when present
- final data fallback: a clearly labeled bundled snapshot from that origin

`CATALOG_STOREFRONT_TOKEN` is optional and must be stored as a Wrangler secret or in an ignored `.dev.vars` file. If the token is absent or rejected, the Worker requests only `/products.json` and `/products/{handle}.js` on the exact allowlisted host. If those public endpoints are unavailable, the UI and API say `bundled-snapshot` and `live: false`.

As verified on August 26, 2026, the default storefront currently redirects public catalog and product paths to `/password`. Local no-credential runs therefore use the labeled snapshot. A deployed read-only Storefront token can restore live structured data, but it does not make a password-protected HTML page publicly readable.

## Security boundary

The Worker never accepts an arbitrary upstream URL. Every upstream request must satisfy all of these checks:

- HTTPS only.
- Exact hostname match against `src/origins.ts`.
- Product path match against the origin record.
- No off-origin redirects and no redirect to a non-allowlisted path.
- Bounded request bodies and bounded upstream response bytes.
- Strict handles, limits, origin ids, and comparison counts.
- Untrusted origin strings rendered with `textContent`.

Responses preserve a restrictive CSP, `Permissions-Policy: tools=(self)`, `Origin-Agent-Cluster: ?1`, framing denial, MIME-sniffing protection, and no-referrer behavior. The build has no checkout, payment, Admin API, accounts, cookies, analytics identifiers, or commercial application integration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

No credentials are required. Without a Storefront token, expect live public products JSON when the origin is open and the labeled snapshot when it is protected.

For WebMCP discovery, use a client that exposes the Imperative API. Other browsers retain the complete manual preview and accurately report that WebMCP is not detected.

## Verify

```bash
npm run typecheck
npm test
npm run verify
```

`npm run verify` runs strict TypeScript, the Vitest suite, and a Wrangler deployment dry run. It does not deploy.

After James explicitly deploys this branch, the separate live smoke command is:

```bash
AGENTIC_WEBMCP_URL=https://agentic-webmcp.somnora.workers.dev npm run verify:live
```

## Architecture

```text
Top-level browser document
  -> document.modelContext.registerTool(...)
  -> shared manual and WebMCP actions
  -> same-origin Worker API
  -> selected Origin record from src/origins.ts
  -> Storefront GraphQL, then products JSON, then labeled snapshot
  -> optional allowlisted HTML and JSON-LD interpolation
  -> one normalized Offer graph
  -> visible grid, comparison, stripped view, proposal, cart, and activity rail
```

See the [judge guide](docs/JUDGE_GUIDE.md), [demo script](docs/DEMO_SCRIPT.md), [evaluation plan](docs/EVALS.md), [threat model](docs/THREAT_MODEL.md), [offer protocol](docs/OFFER_PROTOCOL.md), and [submission draft](docs/SUBMISSION_COPY.md).

## Project boundary

This public repository is the complete Challenge application. The separate commercial Agentic project is not imported, called, or required. This build uses no commercial secrets, Worker, App Proxy, HMAC, storage, or Admin API.

## License

[MIT](LICENSE)
