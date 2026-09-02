# Title

Agentic WebMCP

## One-line Summary

An explainable market decision layer where agents convert authorized product pages into source-visible recommendations and people retain final control.

## Problem

Visual commerce pages force agents to infer controls, reconstruct facts from presentation markup, and hide their reasoning from the person making the decision. Arbitrary scraping also creates authorization, provenance, freshness, and reliability problems.

## Solution

Agentic WebMCP lets an authorized website expose a bounded agent interface. Nine WebMCP tools discover origins, search and rank offers, compare products, convert an allowlisted page into compact Markdown plus a structured Offer, create a brief, and prepare a purchase review.

The agent and the person share one visible workspace. Product JSON and page JSON-LD are reconciled into verified, single-source, or conflict evidence for price, availability, condition, shipping, and returns. The agent can prepare a short-lived Quote, but only the visible human button can create a page-local decision record. The Worker rereads the Offer and rejects approval if the facts changed after review.

## Why This Matters

The project demonstrates a practical contract for the open agentic web. A merchant can expose structured capabilities without giving an agent arbitrary browsing authority, checkout access, payment credentials, or an account. A person receives an inspectable recommendation, canonical source links, a clear automation boundary, and a downloadable decision dossier after the work is finished.

This directly uses WebMCP for a task that is awkward through visual automation alone: coordinated discovery, evidence conversion, comparison, and human-controlled handoff on the same page.

## How We Used AI

WebMCP-capable agents call the registered tools from natural-language goals. The application returns compact structured results, deterministic ranking factors, provenance, freshness, and suggested next actions. Agent output updates the same interface the person sees instead of remaining hidden in a transcript.

AI is not used to invent product facts or execute payment. Product claims remain grounded in normalized origin responses, and the recommendation score is deterministic and inspectable.

## How We Used Codex

OpenAI Codex helped inspect the evolving Offer protocol, implement the Cloudflare Workers and browser workspace, write the origin authorization and conformance contracts, reconcile product and page evidence, review the security boundary, diagnose reliability issues, expand automated tests, synchronize judge documentation, and prepare the demonstration flow.

Codex also helped identify and close release risks including origin authorization expiry, broad path patterns, misleading fallback health labels, concurrent adapter diagnostics, and approval receipts that were not yet bound to the Quote shown to the person.

## Key Features

- Nine tools registered with `document.modelContext.registerTool`.
- One normalized Offer model across public product JSON, Shopify Storefront GraphQL, Shopify products JSON, JSON-LD, stripped HTML, and labeled snapshots.
- Exact HTTPS hostname checks, restrictive product paths, manual redirect rejection, timeouts, and bounded upstream bodies.
- Verified, single-source, and conflict states for price, availability, condition, shipping, and returns.
- Deterministic recommendations with visible relevance, condition, delivered price, seller confidence, and returns factors.
- A shared human and agent workspace with canonical URLs and compact origin diagnostics.
- A repeatable origin conformance command for authorization, paths, redirects, limits, adapters, provenance, freshness, and fallback behavior.
- A short-lived, quote-bound human approval flow with no WebMCP commit, checkout, order, or payment tool.
- A browser-generated Markdown decision dossier with the goal, ranked options, rationale, sources, conflicts, selection, and human decision.

## Architecture

The main Cloudflare Worker serves the application, API routes, security headers, validation, diagnostics, and WebMCP tool handlers. A separate first-party Worker serves the controlled public guitar origin over HTTPS. `src/origins.ts` stores origin authorization manifests as data. All adapters normalize into the Offer protocol and are checked against the selected manifest before results reach the browser.

The default origin is `catalog-lab` at `agentic-webmcp-origin.somnora.workers.dev`. It contains four original demonstration listings and does not impersonate another merchant. The secondary `review-shop` Shopify origin remains operator-authorized and is visibly research-only when public inventory is unavailable.

## Testing Instructions

1. Open https://agentic-webmcp.somnora.workers.dev/ in ChatGPT's in-app browser or Chrome with WebMCP enabled.
2. Confirm the page reports nine registered tools.
3. Ask: `List the allowlisted origins and select catalog-lab.`
4. Ask: `Find the best electric guitars under 900 USD. Rank them by condition, delivered price, seller confidence, and returns.`
5. Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`
6. Confirm the result says `Verified across product JSON and page`.
7. Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`
8. Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`
9. Click `Approve for handoff` yourself and inspect the page-local receipt.
10. Download the decision dossier.

No credentials are required. Payment remains on the source merchant and is not part of this build.

Local verification:

```bash
npm install
npm run verify
```

After deployment:

```bash
npm run verify:live
```

## Public Demo Link

https://agentic-webmcp.somnora.workers.dev/

## Public Repository Link

https://github.com/Somnora/agentic-webmcp

## Demo Video

TODO: Add the public YouTube URL after the final under-three-minute recording and Lapetus narration are complete.

Video outline:

1. Show an agent tool call and shared workspace change in the first 10 to 15 seconds.
2. Establish the controlled origin, live adapter, and authorization boundary.
3. Rank electric guitars under 900 USD.
4. Interpolate a product page and pause on cross-source verification.
5. Compare two listings.
6. Prepare a purchase review and stop at the human boundary.
7. Approve with the visible button and download the decision dossier.

## Screenshot Shot List

1. Full workspace with origin badge, nine-tool status, and recommendation form.
2. Ranked guitar options with factor evidence and activity rail.
3. Interpolated Markdown, structured Offer, canonical URL, and verified evidence state.
4. Purchase review banner before human approval.
5. Approved decision record with merchant source link and dossier control.

## Submission Readiness Notes

- Project creation began during the submission period on August 25, 2026 at 5:41 PM Pacific.
- Strict TypeScript, 79 automated tests across 13 files, and both Worker dry runs pass on the deployed release.
- The repository is public and contains an MIT license.
- The public URL and public repository are known.
- All 17 public smoke checks pass against the deployed Workers.
- The no-credential judge flow passed in the in-app browser at 2560 by 1440 with nine registered tools, live cross-source verification, quote-bound approval, a receipt, and the dossier export action.
- Final gallery screenshots and the required public video must be completed before the final Devpost check.

## Known Limitations

- The default listings are original, first-party controlled demonstration data served over public HTTPS.
- The application does not search arbitrary websites or unrelated marketplaces.
- The Shopify development origin can remain password protected and fall back to a clearly labeled research-only snapshot.
- No agent tool performs approval, checkout, order creation, payment, account access, or merchant mutation.
- The dossier and approval record are page-local and disappear when the page is reloaded.

## TODO Official Form Fields

- Submitter Type: Individual
- Country of residence: TODO confirm before final Devpost check
- App Status: New
- Existing project update explanation: Not applicable. The first commit was created after submissions opened.
- Live URL: https://agentic-webmcp.somnora.workers.dev/
- Testing instructions: Use the no-credential flow above.
- Public repository: https://github.com/Somnora/agentic-webmcp
- Tested agents or clients: TODO replace with the exact WebMCP client and version after final public rehearsal
- AI tools used: OpenAI Codex. Add Gemini only if the final narration uses Gemini text-to-speech.
- Learning level: TODO confirm one of None, Moderate, or Significant
- Career AI value: TODO confirm Yes or No
- Video URL: TODO
