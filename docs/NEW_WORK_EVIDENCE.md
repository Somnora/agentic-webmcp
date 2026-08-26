# New work created during the WebMCP Challenge

## Project boundary

Commercial Agentic existed before the Challenge. It did not register the WebMCP tools or include the standalone shared workspace in this public repository. The public commit history is the timestamped source for Challenge work.

The current origin interpolation change stays entirely inside `agentic-webmcp`. It does not read, import, call, or modify the commercial application.

## Challenge work in this repository

- Standalone top-level WebMCP workspace.
- Eight imperative `document.modelContext.registerTool(...)` tools.
- Origin records stored as data in `src/origins.ts`.
- One Offer protocol used by controlled public product JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, HTML interpolation, and the bundled snapshot projection.
- Exact-host and path allowlists, redirect restrictions, and bounded upstream bodies.
- Shared origin badge, offer grid, comparison, stripped Markdown, activity, proposal, and in-page cart receipt.
- Human-confirmed proposal protocol with no registered commit or checkout tool.
- Strict input bounds, source labels, security headers, tests, judge prompts, and submission documentation.

## Earlier public milestones

| Commit | Date | Challenge work |
| --- | --- | --- |
| `75f0392` | August 25, 2026 | Initial standalone workspace, tools, Worker, tests, and documentation |
| `de31e91` | August 25, 2026 | Public deployment and verification evidence |
| `75ddaac` | August 25, 2026 | Earlier submission media captures |
| `4887e77` | August 25, 2026 | GitHub Actions verification workflow |
| `c5dfbb7` | August 25, 2026 | Earlier four-tool WebMCP browser evidence |
| `7b4b81e` | August 25, 2026 | Last commit before the allowlisted origin interpolation WIP |

The older screenshots and four-tool browser evidence do not represent the current eight-tool origin flow. They must not be used as current proof after this branch changes.

## Current verification boundary

On August 26, 2026, local strict TypeScript and 40 unit and route tests passed after adding the controlled origin. Both Worker dry-runs passed. All 12 production checks passed against the app and controlled origin Workers, including exact deployment identity, controlled origin health, catalog and page liveness, provenance, proposal isolation, and allowlist rejection.

At 1280 by 720, Chrome loaded the production workspace with exactly eight registered WebMCP tools, the `LIVE DEMO | public-products-json` badge, live catalog and page health, four controlled offers, and the deployed commit. The complete interactive interpolation, comparison, proposal, human confirmation, and receipt flow passed in the local 1280 by 720 browser pass. No QA screenshots were added to the repository, and no YouTube recording was performed during this task. The live commit identity remains available from `/health` and in the page footer.

## Current origin access evidence

On August 26, 2026, unauthenticated checks against `agentic-app-review-test.myshopify.com` observed:

- `/products.json` redirected to `/password`.
- `/products/the-complete-snowboard` redirected to `/password`.
- Tokenless Storefront GraphQL reported that the Online Store channel was locked.

The implementation therefore labels no-token local catalog results as `bundled-snapshot` and marks the blocked page projection as not live. This access state can change and should be checked again before deployment and recording.

The Shopify admin also identified the shop as a development store and disabled its public-access control. James approved the controlled fallback. `agentic-webmcp-origin.somnora.workers.dev` serves four original fixture products over public HTTPS JSON and semantic HTML, has no external product images, and has no checkout, payment, accounts, cookies, or analytics. The app labels this origin `controlled-demo` and `LIVE DEMO`.
