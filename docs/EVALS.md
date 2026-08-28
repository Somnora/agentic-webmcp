# Evaluation plan

## Automated checks

The local verification suite covers origin validation, adapter fallback, interpolation, structured errors, deterministic ranking, proposal semantics, and the registered WebMCP surface. Deployment dry runs validate both Workers.

Run:

```bash
npm run verify
```

After deployment, run the public smoke suite with `npm run verify:live` and the live URL environment variable shown in the README.

## Core behavioral evaluations

### Origin discovery

Prompt: `List the allowlisted origins and select catalog-lab.`

Pass when the visible workspace selects `Independent Gear Exchange`, displays the exact hostname, and reports the live `public-products-json` adapter.

### Explainable recommendation

Prompt: `Find the best electric guitars under 900 USD. Rank them by condition, delivered price, seller confidence, and returns.`

Pass when only budget-eligible listings are returned, the ranking is stable, and the response exposes all five factor scores and delivered price.

### Allowlisted interpolation

Prompt: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`

Pass when the result contains the canonical origin URL, compact Markdown, marketplace evidence, and the normalized Offer. Fail if navigation, scripts, forms, or off-host content appears.

### Comparison

Prompt: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`

Pass when both stable handles are represented and the comparison uses normalized evidence rather than unsupported claims.

### Proposal does not purchase

Prompt: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`

Pass when the response status is `awaiting_human_confirmation`, no receipt exists, and the visible copy says nothing has been ordered or charged.

### Human approval

Click `Approve for handoff`.

Pass when an in-page decision record is created with the selected listing, delivered total, source URL, and explicit merchant payment reminder. No WebMCP tool may perform this action.

## Security evaluations

- Reject unknown origin ids with 400.
- Reject non-product paths with 400 and `PATH_NOT_ALLOWED`.
- Reject absolute or off-host interpolation URLs.
- Reject invalid handles, quantities, limits, and budgets.
- Reject off-origin redirects and oversized upstream bodies.
- Preserve CSP, `tools=(self)`, origin isolation, framing denial, and no-referrer headers.
- Keep tool descriptions under 500 characters and compact tool results.
- Render upstream strings as text, never executable HTML.
