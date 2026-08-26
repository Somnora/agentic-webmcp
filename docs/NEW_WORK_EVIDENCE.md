# New work created during the WebMCP Challenge

## Pre-existing product baseline

Commercial Agentic existed before the Challenge. Its last pre-window commit was:

- Repository: private commercial Agentic Shopify application
- Commit: `78d920d6ebf6a439cb98d7feec596e0cd9c9e093`
- Commit time: August 25, 2026 at 1:48:55 AM Pacific
- Challenge submission window opened: August 25, 2026 at 11:00 AM Pacific

Pre-existing Agentic published live Shopify catalog data as compact Markdown behind signed App Proxy routes. It did not register WebMCP tools and did not include the standalone human-agent commerce workspace submitted here.

## New Challenge work

This repository was initialized after the submission window opened. New work includes:

- Standalone top-level WebMCP commerce workspace.
- Four imperative `document.modelContext.registerTool(...)` tools.
- Human-visible activity synchronization for agent and manual invocations.
- Same-origin Cloudflare Worker catalog API.
- Shopify Mock Shop GraphQL adapter with explicit source labeling.
- Resilient, visibly labeled bundled snapshot.
- Strict input bounds, schema validation, cancellation support, security headers, and untrusted-content annotations.
- Unit, route, type, bundle, and live smoke verification.
- Public setup, threat model, evaluation prompts, and submission documentation.

## Commit evidence

The public repository history is the authoritative timestamped record. Update this table after each milestone.

| Commit | Time | New WebMCP work |
| --- | --- | --- |
| [`75f0392`](https://github.com/Somnora/agentic-webmcp/commit/75f03928eb491fecc5a2266b9a148ea4eeb56737) | August 25, 2026 at 5:41:53 PM Pacific | Standalone workspace, tool API, Worker, tests, and documentation |
| [`de31e91`](https://github.com/Somnora/agentic-webmcp/commit/de31e91) | August 25, 2026 | Public deployment and verification evidence |
| [`75ddaac`](https://github.com/Somnora/agentic-webmcp/commit/75ddaac) | August 25, 2026 | Deployed submission-media captures and provenance |
| [`4887e77`](https://github.com/Somnora/agentic-webmcp/commit/4887e77) | August 25, 2026 | Reproducible GitHub Actions verification workflow |

## Deployed evidence

- Public repository: https://github.com/Somnora/agentic-webmcp
- Cloudflare Worker: https://agentic-webmcp.somnora.workers.dev/
- Worker version: `07a7ba9c-42bb-4808-b6be-58bf2cbfbf60`
- Verification: 22 unit tests, strict TypeScript, deployment dry-run, startup analysis, and 6/6 live smoke checks passing on August 25, 2026.
- Reproducibility: GitHub Actions run [`32916802627`](https://github.com/Somnora/agentic-webmcp/actions/runs/32916802627) passed, and an independent shallow clone completed `npm ci` plus the full verification command with zero credentials and zero vulnerabilities.

## Evaluation boundary

The Hackathon submission asks judges to evaluate only this repository's WebMCP extension. The private commercial repository is context for the problem's credibility, not submitted source or claimed Challenge-period work.
