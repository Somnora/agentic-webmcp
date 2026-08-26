# Devpost submission draft

## Project name

Agentic WebMCP: Allowlisted Origin Tools for Commerce Agents

## One-line description

A shared agent view that compiles allowlisted product origins into structured Offers, stripped Markdown, comparisons, and human-confirmed cart proposals.

## Problem

Browser agents often encounter commerce facts through presentation-heavy pages. They must infer controls, reconstruct product relationships, and hide their work from the human sharing the task. A page can provide a clearer contract.

## Solution

Agentic WebMCP registers eight explicit tools on the top-level document. The agent can list and select allowlisted origins, search and inspect normalized offers, compare products, strip one approved product page into Markdown plus an Offer, create a grounded brief, and stage a cart proposal. Every call updates the same workspace the human sees.

The agent cannot commit a cart add. `propose_add_to_cart` returns a quote and displays a confirmation banner. Only a human click calls the commit route, which creates an in-page receipt with status `in_cart`. There is no merchant cart mutation, checkout, account, order, or payment.

## WebMCP implementation

The page calls `document.modelContext.registerTool` for:

1. `list_origins`
2. `select_origin`
3. `search_products`
4. `get_product`
5. `compare_products`
6. `interpolate_page`
7. `create_catalog_brief`
8. `propose_add_to_cart`

The first seven tools are read-only and untrusted-content annotated. The proposal tool is non-destructive, cancellation-aware, schema-constrained, and compact. No commit or checkout tool is registered.

## Origin interpolation

The default Origin record is `catalog-lab` at `agentic-webmcp-origin.somnora.workers.dev`. It is explicitly labeled `controlled-demo` and serves four original fixture products through public `/products.json`, `/products/{handle}.json`, and semantic product pages. The app fetches those HTTPS responses live but never calls them current merchant inventory. The secondary `review-shop` record preserves optional Storefront GraphQL, Shopify products JSON, and a clearly labeled bundled snapshot.

Page interpolation accepts only a product path declared in the selected Origin record. It strips navigation, footer, scripts, styles, frames, and forms, extracts Product JSON-LD when present, and returns the canonical URL as text rather than framing an external page.

Every adapter projects into the same `Offer` protocol with field-level provenance. The Worker rejects unknown origins, alternate hostnames, non-HTTPS targets, non-allowlisted paths, and redirects to unapproved paths. Upstream bodies and tool outputs are bounded. Stable error codes distinguish invalid input from retryable origin failures.

## Human experience

The visible workspace includes an origin switcher, adapter health, live/fallback badge, stable suggested prompts, offer grid, comparison cards, dual-projection interpolation panel, exportable activity rail, compact result panel, confirmation banner, and in-page cart. Manual controls call the same actions as WebMCP tools.

## Project boundary

The public repository is the complete Challenge application. The pre-existing commercial Agentic project is separate and is not read, imported, called, or required. This build uses no commercial Worker, App Proxy, HMAC, storage, secrets, Shopify Admin API, accounts, cookies, analytics, checkout, or payment.

## Required links

- Live project: https://agentic-webmcp.somnora.workers.dev/
- Public source: https://github.com/Somnora/agentic-webmcp
- Privacy disclosure: https://agentic-webmcp.somnora.workers.dev/privacy.html
- Demo video: `TBD after James records and uploads the public YouTube video`

## Testing instructions

Open the app in a WebMCP-capable browser after the current branch is deployed. No credentials are required.

1. Confirm the header says `8 WebMCP tools registered`.
2. Ask: `List the allowlisted origins and select catalog-lab.`
3. Ask: `Search the selected origin for notebook and return the stable handles.`
4. Ask: `Interpolate /products/field-notebook into stripped Markdown and a structured Offer.`
5. Ask: `Compare field-notebook and modular-desk-tray using only origin facts.`
6. Ask: `Propose adding quantity 1 of the Sand variant of field-notebook and wait for me.`
7. Confirm the cart is still empty, then click `Confirm add to cart` and observe the `in_cart` receipt.

The badge must say `LIVE DEMO | public-products-json`, origin health must report both catalog and page live, and interpolation must show the controlled origin canonical URL. The secondary Shopify development store remains password protected and is not used for the recording flow.

## Verification status

Local strict TypeScript and 40 unit and route tests passed on August 26, 2026. All 12 production checks passed against the app and controlled origin Workers. A 1280 by 720 Chrome production pass showed eight registered tools, the controlled origin badge, live catalog and page health, four offers, and the deployed commit. The full interactive judge flow also passed locally at 1280 by 720. The public YouTube video remains the required submission artifact.
