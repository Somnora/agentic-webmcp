# Agentic WebMCP: Allowlisted Origin Tools for Commerce Agents

## One-line Summary

Agentic WebMCP converts an explicitly allowlisted product website into compact WebMCP tools, structured Offers, stripped Markdown, comparisons, and a visible human-confirmed cart proposal.

## Problem

Commerce agents often encounter product information through presentation-heavy pages. They must infer controls, reconstruct product relationships, and act without giving the person a clear view of the facts or the trust boundary. Traditional scraping also encourages a dangerous pattern: accept any URL, fetch it, and hope the page is safe and stable.

## Solution

Agentic WebMCP gives a browser agent an explicit tool contract over a controlled set of HTTPS origins. Every supported adapter normalizes product information into one Offer model with source labels and field-level provenance. The human sees the same origin, facts, comparison, stripped page, proposal, and result that the agent sees.

The app registers eight WebMCP tools in the top-level document:

- `list_origins`
- `select_origin`
- `search_products`
- `get_product`
- `compare_products`
- `interpolate_page`
- `create_catalog_brief`
- `propose_add_to_cart`

The first seven tools are read-only. The proposal tool stages a quote with `awaiting_human_confirmation` status. It cannot mutate a merchant cart. Only the visible human confirmation button can create the page-local `in_cart` receipt. There is no WebMCP commit, checkout, order, or payment tool.

## Why This Matters

WebMCP is a strong fit because the page can expose stable, typed capabilities instead of forcing an agent to reverse-engineer visual controls. People and agents can inspect and compare source-grounded facts in one shared workspace, then stop at a clear human decision boundary before any cart result appears.

This is also a syntax-conversion demonstration. `interpolate_page` takes one allowlisted path on the selected origin, removes presentation-heavy and unsafe elements, extracts JSON-LD when present, and returns compact Markdown beside a structured Offer. The canonical source URL remains visible as text. The app never frames the third-party page.

## How We Used AI

OpenAI Codex was used as an engineering collaborator for repository inspection, TypeScript implementation, test authoring, security review, documentation synchronization, browser QA, and demo rehearsal planning. Every generated change was checked against the repository constraints and validated with the project test and verification commands.

No generative AI is required for the running product. Catalog briefs are deterministic and source-only, so they do not invent product claims.

## How We Used Codex

Codex helped turn the WebMCP concept into a deployable Cloudflare Worker and human workspace. It traced the existing Offer protocol, consolidated adapters around that model, implemented origin and interpolation boundaries, expanded route tests, verified the production surface, and built the presenter layer used to explain real tool calls during the recording.

The presenter does not simulate a second application. Its cursor, focus frame, tool-input overlay, and implementation captions observe the same actions used by manual controls and WebMCP calls. The final cart confirmation remains an actual human click.

## Key Features

- Exact HTTPS origin allowlist stored as data in `src/origins.ts`.
- Storefront GraphQL, Shopify products JSON, controlled public product JSON, JSON-LD, stripped Markdown, and labeled bundled fallback inputs normalized to one Offer graph.
- Field-level provenance and visible live or fallback source status.
- Same-origin APIs with strict query, handle, quantity, origin, and path validation.
- Redirect restrictions, response byte limits, CSP, `Permissions-Policy: tools=(self)`, origin agent clustering, framing denial, and no-referrer behavior.
- Shared visible workspace with origin badge, product grid, comparison, interpolation view, activity rail, proposal banner, and receipt.
- Exportable activity trace and deterministic catalog brief.
- A 1280 by 720 presenter mode with a precise agent or human cursor, smoothly morphing focus frame, tool input, and concise under-the-hood captions.

## Architecture

```text
Top-level document
  -> eight document.modelContext.registerTool calls
  -> shared manual and agent action functions
  -> same-origin Cloudflare Worker routes
  -> selected Origin record
  -> allowlisted adapter chain
  -> normalized Offer graph
  -> visible human and agent workspace
  -> human-only cart confirmation
```

The Worker accepts no arbitrary upstream URL. It requires HTTPS, an exact declared hostname, an allowed path, and origin consistency on every relevant route. The default recording origin is a controlled public HTTPS product source labeled `LIVE DEMO | public-products-json`. A secondary Shopify development origin is available as a clearly labeled fallback path but is not required for the judge flow.

## Testing Instructions

No account or credentials are required.

1. Open https://agentic-webmcp.somnora.workers.dev/?present=1 in ChatGPT's in-app browser or Google Chrome with WebMCP enabled.
2. Confirm the page reports `8 WebMCP tools registered`.
3. Ask: `List the allowlisted origins and select catalog-lab.`
4. Ask: `Search the selected origin for notebook and return the stable handles.`
5. Ask: `Interpolate /products/field-notebook into stripped Markdown and a structured Offer.`
6. Ask: `Compare field-notebook and modular-desk-tray using only origin facts.`
7. Ask: `Propose adding quantity 1 of the Sand variant of field-notebook and wait for me.`
8. Verify that the cart is unchanged while the visible confirmation banner is waiting.
9. Click `Confirm add to cart` as the human.
10. Verify that an `in_cart` receipt appears in the workspace.

For a guided screen sequence, press `Run guided demo` in presenter mode. The flow has no on-screen countdown or narration copy. It pauses at the required human confirmation and cannot click it for the presenter.

## Public Demo Link

https://agentic-webmcp.somnora.workers.dev/

Presenter URL: https://agentic-webmcp.somnora.workers.dev/?present=1

Privacy: https://agentic-webmcp.somnora.workers.dev/privacy.html

## Public Repository Link

https://github.com/Somnora/agentic-webmcp

The repository is public and includes the MIT license, source, assets, tests, deployment configuration, and local run instructions.

## Demo Video

TODO: Record and publish a public YouTube video shorter than three minutes with clear audio, then paste its URL here and into Devpost.

Planned 2:28 flow:

1. Establish the problem and show all eight registered tools.
2. List and select the allowlisted live demo origin.
3. Search for `notebook` and show stable handles.
4. Interpolate `/products/field-notebook` into stripped Markdown and a structured Offer.
5. Compare `field-notebook` with `modular-desk-tray`.
6. Propose the Sand variant and stop at `awaiting_human_confirmation`.
7. Click the human confirmation button and show the `in_cart` receipt.
8. Close on the exact-host allowlist, shared workspace, and reusable webpage-to-tool pattern.

## Screenshot Shot List

Six candidate screenshots were captured outside the repository. Frames 2 through 6 are 1280 by 720. The connected Chrome registration frame uses Chrome's captured viewport at 1154 by 927:

1. Origin badge, health labels, and eight registered tools.
2. Search results for `notebook` with the activity rail visible.
3. Interpolated Markdown, structured Offer, and canonical source URL in one frame.
4. Two-product comparison with provenance visible.
5. Human confirmation banner with `awaiting_human_confirmation` visible and no cart receipt yet.
6. Final page-local `in_cart` receipt after the human click.

Do not include browser extensions, account details, credentials, unrelated tabs, or third-party trademarks in the screenshots.

All six frames are visually reviewed and ready for selection. Frame 1 was captured in connected Chrome and visibly confirms all eight registered WebMCP tools, the selected live demo origin, the AGENT cursor, and the presenter overlay.

## Submission Readiness Notes

- Devpost project: draft, not submitted.
- Live application: deployed and verified on August 26, 2026.
- Public repository and MIT license: present.
- Strict TypeScript: passed locally.
- Unit and route tests: 43 of 43 passed across 7 files.
- Worker verification: 13 of 13 production checks passed against both deployed Workers, including the presenter asset.
- Browser rehearsal: completed interpolation, comparison, proposal, required human confirmation, and receipt at 1280 by 720 with no console warnings.
- WebMCP discovery: connected Chrome reported all eight registered tools on the deployed presenter URL after the final presenter change.
- Required public YouTube video: missing.
- Candidate screenshots: six captured outside the repository and visually reviewed, including connected Chrome evidence of all eight registered WebMCP tools.

## Judging Criteria Alignment

- WebMCP Leverage: eight non-trivial tools share one typed Offer protocol and update the visible page state.
- Execution: the public Worker, manual workspace, agent tools, error states, security boundary, tests, and recording mode form one coherent product experience.
- Potential Impact: the project demonstrates a reusable way to turn allowlisted product pages into auditable agent capabilities while preserving human control.
- Creativity and Ambition: it combines structured catalog adapters with safe page interpolation, provenance, shared state, and a human-only action boundary.

## Known Limitations

- The default recording origin is controlled demonstration data served over real HTTPS, not active merchant inventory. The UI labels it clearly.
- The secondary Shopify development store is password protected and its public access toggle is disabled without a plan or transfer change.
- Live Storefront GraphQL for the secondary origin depends on an optional read-only token whose production presence was not inspected.
- Browser tool discovery requires a WebMCP-capable client. Manual controls remain available elsewhere.
- The receipt is page-local and does not mutate a merchant cart.

## TODO Official Form Fields

- Field 28249, Submitter Type: TODO, James to confirm `Individual`, `Team of Individuals`, or `Organization`.
- Field 28250, Country of residence: TODO, James to confirm the official selection.
- Field 28251, Organization name: leave blank unless submitting as an organization.
- Field 28252, App Status: TODO, James to confirm `New` or `Existing`.
- Field 28253, Existing app updates: if `Existing`, use the implementation summary in this draft and describe only work completed during the submission period.
- Field 28254, Live URL: https://agentic-webmcp.somnora.workers.dev/
- Field 28255, Testing instructions: use the credential-free ten-step flow above.
- Field 28256, Public repository: https://github.com/Somnora/agentic-webmcp
- Field 28257, Tested clients: Google Chrome with WebMCP enabled. Connected Chrome visibly reported all eight registered tools on the deployed presenter URL.
- Field 28258, AI tools used: OpenAI Codex.
- Field 28259, Learning level: TODO, James to select `None`, `Moderate`, or `Significant`.
- Field 28260, Career AI value: TODO, James to select `Yes` or `No`.

Do not paste or submit this draft until the public YouTube URL and user-confirmed form selections are complete.
