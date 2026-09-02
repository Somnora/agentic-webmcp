# Recording script

## Capture setup

- Record at 2560 by 1440 when possible, then deliver at 1440p.
- Open the app with `?present=1` and hide browser chrome if practical.
- Record without microphone audio. Add the Lapetus track afterward.
- Keep the activity rail, origin badge, focus frame, pointer, and purchase review visible.
- Do not show eBay, third-party trademarks, credentials, or payment details.

## Screen sequence

### Opening

Show the restrained workspace and the nine-tool status. Establish that this is a shared decision surface, not an autonomous buyer.

### Discover and select

Ask: `List the allowlisted origins and select catalog-lab.`

Point out the exact hostname, live adapter, and controlled demonstration label.
Point out the first-party authorization and `HANDOFF READY` trust state.
Open `Origin diagnostics` briefly. Show that the product JSON and page were fetched as separate timed attempts under one request trace, then close the drawer.

### Rank the options

Ask: `Find the best electric guitars under 900 USD as a gift. Let me explore. The recipient prefers single-coil pickups. Emphasize taste, condition, and price.`

Show Taste and Intent, then pause on the decision checkpoint. Explain that the leading and value options win on different source facts, so the agent is asking one useful question instead of hiding uncertainty. Choose one of the visible priorities yourself. Show the resolved state, whether Best fit changed, and the explicit 10-point rubric adjustment. Then pause on the Best fit, Best value, and Worth a look cards, their reasons, tradeoffs, and evidence confidence. Explain that the personal context is session-only, the ranking is deterministic, and all candidates use the same normalized `Offer` shape.

### Convert a real page

Ask: `Interpolate /products/sunburst-s-style-electric into stripped Markdown and a structured Offer.`

Show the canonical HTTPS URL, stripped Markdown, provenance, freshness, handoff eligibility, and structured facts. Pause on `Verified across product JSON and page`. Explain that price, availability, condition, shipping, and returns were reconciled before the Offer was shown. Explain exact-host and path validation before the Worker fetches the page.

### Compare

Ask: `Compare sunburst-s-style-electric and mahogany-single-cut-electric using only source facts.`

Show delivered price, condition, seller confidence, shipping, and return evidence in one comparison.

### Human-controlled handoff

Ask: `Propose quantity 1 of the As listed variant of sunburst-s-style-electric, then stop for my approval.`

Pause on the review. Explain that fallback or stale data cannot reach this step. Read the sentence that nothing has been ordered or charged. Click `Approve for handoff` yourself. Explain that the Worker rereads the Offer and refuses approval if the facts changed after review. Show the page-local decision record with its merchant source link.

Download the decision dossier. Explain that it gives the person a portable record of the goal, taste and intent, uncertainty checkpoint, human answer, scoring rationale, recommendation tradeoffs, canonical sources, evidence conflicts, selected Offer, and human decision without storing it on the server.

### Close

End on the trust boundary: the agent can discover, convert, verify, rank, compare, and prepare a decision. The person keeps the dossier, approves the selection, and completes any payment on the merchant site.

## Narration timing

The presenter overlay intentionally contains no duration, countdown, or narration copy. `scripts/render_demo_voiceover.py` aligns the final Lapetus narration to the silent recording. If the recording timing changes, adjust the segment boundaries in that script after the visual edit is locked.
