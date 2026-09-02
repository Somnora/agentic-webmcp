# Agentic WebMCP

[![Verify](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml/badge.svg)](https://github.com/Somnora/agentic-webmcp/actions/workflows/verify.yml)

Agentic WebMCP converts allowlisted product websites into a shared decision surface for people and agents. The Worker combines public product JSON, Storefront GraphQL, JSON-LD, stripped page Markdown, and labeled fallbacks into one `Offer` protocol. It reconciles decision facts across the structured feed and visible page, then stops at a human-controlled merchant handoff.

Live URL: [agentic-webmcp.somnora.workers.dev](https://agentic-webmcp.somnora.workers.dev/)

The `/health` response and page footer expose the deployed Git commit and Cloudflare Worker version so reviewers can match the live app to this repository.

## Registered WebMCP tools

The top-level document calls `document.modelContext.registerTool` for exactly nine tools:

1. `list_origins`: list the exact HTTPS origins the Worker may read.
2. `select_origin`: select one origin in page-local state.
3. `search_products`: search normalized offers on the selected origin.
4. `find_best_options`: rank matching offers by relevance, condition, delivered price, seller confidence, and returns.
5. `get_product`: inspect one offer and its sampled variants.
6. `compare_products`: compare two to four handles on one origin.
7. `interpolate_page`: strip an allowlisted product path into compact Markdown plus an `Offer`.
8. `create_catalog_brief`: build deterministic Markdown from selected offers.
9. `propose_add_to_cart`: stage a visible purchase review for human approval.

The first eight tools are read-only and untrusted-content annotated. `propose_add_to_cart` is non-destructive. There is no WebMCP commit, checkout, order, or payment tool. Only the visible `Approve for handoff` button can create a page-local decision record. Payment remains on the source merchant.

## Default origin and adapter chain

`src/origins.ts` contains two public origin records. The default recording origin is:

- id: `catalog-lab`
- display name: `Independent Gear Exchange`
- mode: `controlled-demo`
- hostname: `agentic-webmcp-origin.somnora.workers.dev`
- vertical: `marketplace`
- primary adapter: `public-products-json`
- content: four original guitar listings with marketplace evidence and no external images
- page projection: `html-markdown` with JSON-LD extraction
- mutations: none

The origin is a separate public Worker with live HTTPS JSON and semantic HTML responses. The interface labels it as first-party controlled demonstration data. It is not eBay and it is not presented as inventory from an unrelated merchant. The secondary `review-shop` record preserves the operator-authorized Shopify adapter and a labeled research-only snapshot fallback.

Each origin is an authorization manifest with exact host and path rules, adapter capabilities, an upstream time budget, byte limits, freshness policy, and a review date. See [Origin onboarding](docs/ORIGIN_ONBOARDING.md). Anchored catch-all and nested product patterns are rejected during registry validation. Runtime requests fail closed at `reviewAfter`, expired origins disappear from selection, and conformance reports the expiry without contacting the origin. Offer contract validation checks every normalized Offer against its manifest before it reaches an API response.

Every offer includes field-level provenance. Price, availability, condition, shipping, and returns are labeled `verified`, `single-source`, or `conflict`. A conflict remains visible, preserves the primary structured value, and disables handoff for that reconciled Offer. Marketplace listings also include seller feedback and delivered price. The deterministic recommender exposes its score factors instead of hiding them inside a model response.

The activity rail can download a Markdown decision dossier containing the research goal, ranking rubric, source URLs, reconciliation state, timestamps, selected Offer, and human decision. The dossier is generated in the browser and is not uploaded or stored by the application. Human approval returns a receipt only when a fresh reread still matches the exact quote shown for review.

The origin card also contains a compact diagnostics drawer. It reports the active adapter, product and page timings, evidence state, configured timeout, normalized failure reason, and the short form of the request correlation id. Every response includes the full `X-Agentic-Correlation-Id` and `Server-Timing` headers, and the same correlation id is forwarded to the controlled origin.

`CATALOG_STOREFRONT_TOKEN` is optional and applies only to the secondary Shopify origin. Store it as a Wrangler secret or in an ignored `.dev.vars` file. If it is absent, the Worker tries public Shopify product JSON and then a clearly labeled bundled snapshot. Snapshot, stale, invalid-timestamp, and unavailable Offers are research-only and cannot enter the proposal flow.

## Security boundary

The Worker never accepts an arbitrary upstream URL. Every upstream request must satisfy:

- HTTPS only.
- Exact hostname match against `src/origins.ts`.
- Product path match against the selected origin record.
- No off-origin redirects or redirects to disallowed paths.
- Bounded request bodies and upstream response bytes.
- A manifest-defined timeout that covers both response headers and body streaming.
- Strict handles, limits, origin ids, and comparison counts.
- Untrusted origin strings rendered with `textContent`.
- Short Cache API entries keyed by validated same-origin request URLs.
- Structured API errors with stable codes and retry guidance.
- Normalized origin failure reasons without exposing upstream response bodies.

Responses preserve a restrictive CSP, `Permissions-Policy: tools=(self)`, `Origin-Agent-Cluster: ?1`, framing denial, MIME-sniffing protection, and no-referrer behavior. The build has no checkout, payment, Admin API, accounts, cookies, analytics identifiers, or commercial application integration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

No credentials are required for the controlled guitar origin. For WebMCP discovery, use a client that exposes the Imperative API. Other browsers retain the complete manual preview and report that WebMCP is not detected.

## Presenter mode

Click `Presenter mode` or add `?present=1`. At 1280 by 720 or higher, presenter mode gives the workspace the full recording viewport and adds:

- One smooth focus frame that moves between affected workspace regions.
- A precise SVG pointer that follows real input and tool results.
- A compact overlay with validated input and an implementation note.
- A guided sequence with pause and next controls, with no countdown or voiceover text on screen.
- A required stop at human approval. The sequence cannot approve on the presenter's behalf.

Presenter mode invokes the same application actions. It does not fabricate calls, register another tool, or weaken the human boundary. Record the silent screen sequence, then add the prepared Lapetus narration in post-production.

## Verify

```bash
npm run typecheck
npm test
npm run verify
```

`npm run verify` runs strict TypeScript, Vitest, and deployment dry runs for both Workers. It does not deploy.

With the local Worker running, validate an authorized origin end to end:

```bash
npm run check:origin -- catalog-lab
```

The command checks the manifest, current authorization, exact hostname, path allowlist, redirect rejection, response bounds, active adapters, Offer provenance, freshness, and labeled fallback or fail-closed behavior. Pass a deployed app URL as the second argument when checking production.

After an explicit deployment, run:

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
  -> controlled public product JSON or Shopify adapter chain
  -> optional allowlisted HTML and JSON-LD interpolation
  -> one normalized Offer graph
  -> cross-source evidence reconciliation
  -> deterministic evidence ranking
  -> visible comparison, stripped view, purchase review, decision record, and downloadable dossier
```

See the [judge guide](docs/JUDGE_GUIDE.md), [demo script](docs/DEMO_SCRIPT.md), [evaluation plan](docs/EVALS.md), [threat model](docs/THREAT_MODEL.md), [offer protocol](docs/OFFER_PROTOCOL.md), and [submission draft](docs/SUBMISSION_COPY.md).

## Project boundary

This repository is the complete Challenge application. The separate commercial Agentic project is not imported, called, or required. This build uses no commercial secrets, Worker, App Proxy, HMAC, storage, or Admin API.

## License

[MIT](LICENSE)
