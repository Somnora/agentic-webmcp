# New work created during the WebMCP Challenge

## Project boundary

Commercial Agentic existed before the Challenge. It did not register the WebMCP tools or include the standalone shared workspace in this public repository. The public commit history is the timestamped source for Challenge work.

The current origin interpolation change stays entirely inside `agentic-webmcp`. It does not read, import, call, or modify the commercial application.

## Challenge work in this repository

- Standalone top-level WebMCP workspace.
- Eight imperative `document.modelContext.registerTool(...)` tools.
- Origin records stored as data in `src/origins.ts`.
- One Offer protocol used by Storefront GraphQL, public products JSON, JSON-LD, HTML interpolation, and the bundled snapshot projection.
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

On August 26, 2026, local strict TypeScript, 27 unit and route tests, and the Worker deployment dry run passed for the origin interpolation implementation. A visible 1280 x 720 local QA pass also completed for origin labeling, search, interpolation, proposal, human confirmation, and the in-page receipt. QA screenshots were written only to a temporary directory and were not added to the repository.

No deployment, updated production smoke run, updated WebMCP browser pass, screenshot capture, or YouTube recording was performed during this task. The final commit hash should be added after commit.

## Current origin access evidence

On August 26, 2026, unauthenticated checks against `agentic-app-review-test.myshopify.com` observed:

- `/products.json` redirected to `/password`.
- `/products/the-complete-snowboard` redirected to `/password`.
- Tokenless Storefront GraphQL reported that the Online Store channel was locked.

The implementation therefore labels no-token local catalog results as `bundled-snapshot` and marks the blocked page projection as not live. This access state can change and should be checked again before deployment and recording.
