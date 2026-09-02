# Previous deployment evidence

This file records the August 26, 2026 deployment before the guitar recommendation redesign. It is historical evidence, not the current judge script. Use `docs/JUDGE_GUIDE.md` and `docs/DEMO_SCRIPT.md` for the current nine-tool flow.

## Project boundary

Commercial Agentic existed before the Challenge. It did not register the WebMCP tools or include the standalone shared workspace in this public repository. The public commit history is the timestamped source for Challenge work.

The current origin interpolation change stays entirely inside `agentic-webmcp`. It does not read, import, call, or modify the commercial application.

## Challenge work in this repository

- Standalone top-level WebMCP workspace.
- Nine imperative `document.modelContext.registerTool(...)` tools.
- Origin records stored as data in `src/origins.ts`.
- One Offer protocol used by controlled public product JSON, Storefront GraphQL, Shopify products JSON, JSON-LD, HTML interpolation, and the bundled snapshot projection.
- Reconciled `verified`, `single-source`, and `conflict` evidence states for price, availability, condition, shipping, and returns.
- A local Markdown decision dossier containing the goal, ranked options, scoring, sources, conflicts, selection, and human decision.
- A repeatable origin conformance command for manifest, authorization, hostname, path, redirect, byte limit, adapter, provenance, freshness, and fallback behavior.
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

The older screenshots and four-tool browser evidence do not represent the current nine-tool origin flow. They must not be used as current proof after this branch changes.

## August 26 verification boundary

On August 26, 2026, local strict TypeScript and 40 unit and route tests passed after adding the controlled origin. Both Worker dry-runs passed. All 12 production checks passed against the app and controlled origin Workers, including exact deployment identity, controlled origin health, catalog and page liveness, provenance, proposal isolation, and allowlist rejection.

At 1280 by 720, Chrome loaded the production workspace with exactly eight registered WebMCP tools, the `LIVE DEMO | public-products-json` badge, live catalog and page health, four controlled offers, and the deployed commit. The complete interactive interpolation, comparison, proposal, human confirmation, and receipt flow passed in the local 1280 by 720 browser pass. No QA screenshots were added to the repository, and no YouTube recording was performed during this task. The live commit identity remains available from `/health` and in the page footer.

The presenter release added a nine-phase 2 minute 28 second rehearsal, one smoothly morphing focus frame, a bounded SVG cursor, live tool inputs, and implementation captions. The local 1280 by 720 pass verified edge-safe cursor placement, `AGENT` and `HUMAN` pointer roles, side-switching overlay placement, the required confirmation interruption, a clean rehearsal reset, and no console warnings. All 13 production checks passed after deployment, including the new presenter asset.

## September 1 release verification

Strict TypeScript, all 79 tests across 13 files, and dry runs for both Workers passed after the evidence reconciliation, decision dossier, origin conformance, reliability, runtime authorization, restrictive path validation, honest health labeling, and quote-bound approval work. At the exact `reviewAfter` timestamp, tests prove that an expired origin disappears from discovery, catalog and proposal requests return 403 before upstream access, and conformance reports the expiry without contacting the origin. A running local pair of Workers returned live product JSON plus live page JSON-LD for `catalog-lab`. The conformance command passed all 10 checks and reported `Verified across product JSON and page` for price, availability, condition, shipping, and returns.

The reliability pass added request correlation, adapter timings, normalized failure reasons, full-body timeouts, and a compact origin diagnostics drawer. Local logs proved that the app Worker and controlled origin received the same correlation id. Selecting `review-shop` changed the drawer to a labeled `password-protected` fallback without claiming live inventory.

The release was committed to `main`, pushed to the public repository, and deployed to both Workers. All 17 production checks passed, including deployment identity, controlled origin health, catalog and page liveness, verified provenance, proposal isolation, quote-bound human approval, receipt integrity, and allowlist rejection.

A fresh in-app browser pass at 2560 by 1440 with device pixel ratio 2 showed nine registered WebMCP tools and no console warnings. The browser called `list_origins`, `select_origin`, `find_best_options`, `interpolate_page`, `compare_products`, and `propose_add_to_cart` through WebMCP. The visible workspace showed `Verified across product JSON and page`, blocked mutation before human approval, then recorded the exact reviewed Quote after the visible button was used. The dossier control generated the page-local Markdown export. The browser sandbox did not expose its download directory for a filesystem-level file check.

## August 26 origin access evidence

On August 26, 2026, unauthenticated checks against `agentic-app-review-test.myshopify.com` observed:

- `/products.json` redirected to `/password`.
- `/products/the-complete-snowboard` redirected to `/password`.
- Tokenless Storefront GraphQL reported that the Online Store channel was locked.

The implementation therefore labels no-token local catalog results as `bundled-snapshot` and marks the blocked page projection as not live. This access state can change and should be checked again before deployment and recording.

The Shopify admin also identified the shop as a development store and disabled its public-access control. James approved the controlled fallback. `agentic-webmcp-origin.somnora.workers.dev` serves four original fixture products over public HTTPS JSON and semantic HTML, has no external product images, and has no checkout, payment, accounts, cookies, or analytics. The app labels this origin `controlled-demo` and `LIVE DEMO`.
