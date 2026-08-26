# Devpost submission draft

## Project name

Agentic WebMCP — Commerce Tools for Browser Agents

## One-line description

An open commerce workspace where agents call explicit catalog tools while humans see every result reflected in the page.

## Why this is a strong WebMCP fit

Commerce sites are rich in structured facts but agents often encounter them through presentation-heavy interfaces. Agentic WebMCP gives the page an explicit tool layer: an agent can search products, inspect variants, compare facts, and create a grounded catalog brief without guessing which controls to click or extracting data from rendered layout.

## Better human experience

Tool calls are not hidden background automation. Every agent invocation updates the same product grid, comparison view, and activity timeline the human sees. The human can inspect the requested arguments, catalog source, live/fallback state, and returned products. Manual controls use the same functions, so the page remains useful without agent support.

## What becomes possible

A human can ask an agent to explore a catalog in natural language while retaining a transparent visual workspace. The agent gets concise structured results; the human gets shared state and source visibility. Neither side must surrender context to an opaque screen-scraping process.

## WebMCP implementation

The top-level page statically registers four focused tools with the WebMCP Imperative API: `search_products`, `get_product`, `compare_products`, and `create_catalog_brief`. Each has a JSON Schema, cancellation-aware execution, read-only and untrusted-content annotations, and a compact output. Tool functions call a same-origin Cloudflare Worker API backed by Shopify's public Mock Shop GraphQL demo and update human-visible state after completion.

The Worker validates all inputs independently of JSON Schema, bounds request and output sizes, normalizes external catalog strings, and applies CSP, self-only tools permissions, origin isolation, framing denial, and related security headers. If the public catalog is unavailable, the application uses a clearly labeled bundled snapshot rather than fabricating a live result.

## New versus existing work

Commercial Agentic existed before the Challenge as private Shopify middleware publishing signed catalog Markdown. The standalone WebMCP workspace, registered tools, shared activity UI, public demo adapter, tests, and open-source repository were created after the Challenge period opened. The public commit history and `docs/NEW_WORK_EVIDENCE.md` document the boundary.

## Required links

- Live project: https://agentic-webmcp.somnora.workers.dev/
- Public source: https://github.com/Somnora/agentic-webmcp
- Privacy disclosure: https://agentic-webmcp.somnora.workers.dev/privacy.html
- Demo video: `TBD after recording and YouTube upload`

## Suggested tags

WebMCP, ecommerce, Shopify, Cloudflare Workers, browser agents, human-agent collaboration, open web
