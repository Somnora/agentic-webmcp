# Devpost submission draft

## Project name

Agentic WebMCP: Allowlisted Origin Tools for Commerce Agents

## One-line description

A shared agent view that compiles an allowlisted live merchant origin into structured Offers, stripped Markdown, comparisons, and human-confirmed cart proposals.

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

The default Origin record is `review-shop` at `agentic-app-review-test.myshopify.com`. The Worker prefers optional read-only Storefront GraphQL, falls back to public `/products.json` and `/products/{handle}.js`, and finally uses a clearly labeled bundled snapshot. Page interpolation accepts only a product path declared in that Origin record. It strips navigation, footer, scripts, styles, frames, and forms, extracts Product JSON-LD when present, and returns the canonical URL as text rather than framing an external page.

Every adapter projects into the same `Offer` protocol. The Worker rejects unknown origins, alternate hostnames, non-HTTPS targets, non-allowlisted paths, and redirects to unapproved paths. Upstream bodies and tool outputs are bounded.

## Human experience

The visible workspace includes an origin switcher, adapter and live/fallback badge, stable suggested prompts, offer grid, comparison cards, interpolation panel, activity rail, compact result panel, confirmation banner, and in-page cart. Manual controls call the same actions as WebMCP tools.

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
2. Ask: `List the allowlisted origins and select review-shop.`
3. Ask: `Search the selected origin for wax and return the stable handles.`
4. Ask: `Interpolate /products/the-complete-snowboard into stripped Markdown and a structured Offer.`
5. Ask: `Compare the-complete-snowboard and selling-plans-ski-wax using only origin facts.`
6. Ask: `Propose adding quantity 1 of the Ice variant of the-complete-snowboard and wait for me.`
7. Confirm the cart is still empty, then click `Confirm add to cart` and observe the `in_cart` receipt.

The badge must say whether facts came from a live adapter or `bundled-snapshot`. The default storefront was password-protected during local verification on August 26, 2026, so a no-token run correctly used the labeled snapshot and reported that the HTML page was not publicly readable.

## Verification status

Local strict TypeScript, 27 unit and route tests, the Worker dry run, and a visible 1280 x 720 local QA pass completed on August 26, 2026. The current branch was not deployed during this task, so updated production and WebMCP browser checks remain pending. The public YouTube video remains the required submission artifact.
