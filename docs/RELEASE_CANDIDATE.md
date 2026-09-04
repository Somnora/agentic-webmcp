# Personalized decision release

Status: approved for publication during the September 3 deadline extension and deployed to the public Challenge URL.

This release connects Ribband's original evidence workspace to one discoverable personalized decision agent. The homepage links to `/decide`, where one read-only `plan_decision` WebMCP tool routes an explicit gift, date, vacation, or staffing request through a fixed deterministic strategy and a shared `DecisionEnvelope`.

## What is in the candidate

| Surface | Current behavior | External action boundary |
| --- | --- | --- |
| Gift | Sparse or detailed recipient context, occasion, budget, interests, memories, hard exclusions, and owned-item filtering | Recommendations only; no purchase, checkout, or payment |
| Date | Two-person interests, prior activities, mood, hard dislikes, one date, and three cost bands | Planning only; no booking, provider contact, or payment |
| Vacation | Past places, fond memories, liked experiences, exploration mode, lodging, dining, dates, travelers, and value/balanced/signature packages | Research and planning only; no reservation, booking, or payment |
| Staffing | Required roles, location, schedule, credentials, equipment, published or estimate-only rates, and missing-role diagnostics | Controlled provider source opening requires visible human review; no contact, quote request, contract, booking, or payment |

Every decision request is `no-store`. Date and vacation outcomes may produce a tentative profile-change proposal, but the Worker persists nothing. Only a separate visible approval can save the exact reviewed fact in IndexedDB on that device, and saved facts remain unselected until the person includes them in a later decision.

## Verification gates

Start the controlled origin and application in separate terminals:

```bash
npx wrangler dev --config wrangler.origin.jsonc --port 8788 --inspector-port 9230
npm run dev -- --port 8787
```

Then run:

```bash
npm run verify
npm run verify:rc
git diff --check
```

`npm run verify:rc` checks all four personalized routes and strategies against the running Worker, including gift phrase exclusions, three date cost bands, complete vacation package categories, a two-role staffing plan, the Atlantis service-area failure, and proposal-only outcome memory.

The browser acceptance matrix must also confirm:

- the homepage entry point opens `/decide`;
- `plan_decision` registers once and works for all four verticals;
- a sparse gift request returns options without inventing age suitability;
- complete date and vacation inputs render source-backed plans;
- staffing source links are absent until the controlled crew and envelope are action eligible;
- the provider destination and transmitted-information disclosure appear before a source link can be opened;
- an unverified location creates no review button or source link;
- outcome memory follows choose, propose, review, approve, explicitly select, revise, and delete;
- linked revisions identify the prior decision while resending the complete visible context;
- the 390-pixel mobile layout has no horizontal overflow and shows the full Ribband lockup;
- the browser console contains no warnings or errors.

## Release boundary

Before publication, the public app reported commit `4e58faf66adb4161e34055771abfdae7e7a37314`, and `/decide` returned 404. The pre-extension repository state is preserved by the `challenge-submission-pre-extension` tag. The current `/health` response is the source of truth for the published commit and Worker version.

Before any deployment:

1. Preserve the submitted Challenge state on `main` until the release decision is explicit.
2. Commit only the reviewed release-candidate files.
3. Confirm a clean working tree and record the exact candidate commit.
4. Run both Worker dry runs through `npm run verify`.
5. Obtain explicit approval for preview or production deployment.

After deployment:

1. Run `AGENTIC_WEBMCP_URL=<deployed-url> npm run verify:live`.
2. Confirm `/health` reports the exact candidate commit and a current Worker version.
3. Repeat the browser acceptance matrix against the deployed URL.
4. Update Devpost or other public claims only from that deployed evidence.

## Next product slice after release

The next product build is a shared local-first people and preferences layer. It should let a person reuse explicitly selected facts, relationships, memories, dislikes, accessibility needs, and prior outcomes across all four strategies while preserving correction, deletion, export, and decision-scoped consent. Cloud accounts and cross-device sync remain deferred until that local trust model is validated.
