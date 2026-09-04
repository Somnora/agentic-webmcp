# Ribband Personalized Decision Platform Implementation Plan

Status: Personalized decision release approved and published during the September 3 deadline extension

Current checkpoint, September 3, 2026: the shared profile and decision contracts, the gift planner at `/workspace`, the two-person date planner at `/date`, the vacation-package planner at `/vacation`, the unified decision agent at `/decide`, and the verified staffing vertical (Milestone 6) are implemented, tested, and published. The unified agent exposes one `plan_decision` WebMCP tool, one bounded planning endpoint, and a separate no-store profile-proposal endpoint. It dispatches each explicit vertical (gift, date, vacation, staffing) through a fixed strategy registry, pins the evidence origin, returns one inspectable envelope, and supports linked full-context replacement without storing a decision. Professional service Offers, controlled trade and creative fixtures, credential and equipment requirement matching, quote-mode accounting, missing role detection, and human-only provider review boundaries are verified. The fuller Milestone 4 and Milestone 5 scopes, including distance evidence, accessibility evidence, date-specific inventory revalidation, item-level revision, broader supply, destination discovery, and account sync (Milestone 7), remain roadmap work.

Repository: `agentic-webmcp`

Baseline: `main` at `7191a54b48c0a39b0fa49eec068ac4ac0c0df54b`

Primary objective: Expand Ribband from an evidence-first product and activity decision demo into a permissioned personal decision workspace that can recommend and package vacations, gifts, dates, and project staffing while keeping source evidence visible and every external action under human control.

## 1. Executive decision

Build this as an extension of the existing Ribband architecture, not as four separate products.

The shared pipeline is:

```text
Permissioned personal context
        +
Current goal and constraints
        +
Authorized, provenance-aware Offers
        |
        v
Eligibility filtering and deterministic scoring
        |
        v
Recommendation or multi-item Plan
        |
        v
Visible evidence, assumptions, conflicts, and alternatives
        |
        v
Human-approved handoff
        |
        v
Optional, user-approved profile learning
```

The current Offer Protocol remains the supply-side truth. A new Profile Protocol becomes the demand-side truth. A new Decision Protocol joins the two for one request. Personal memories and inferred preferences must never be written into an Offer.

The recommended implementation order is:

1. Protect the current hackathon baseline.
2. Add profile and decision contracts without changing current behavior.
3. Prove the profile with the existing gift recommendation flow.
4. Prove two-person matching with the existing services catalog and a date planner.
5. Expand the service and travel Offers needed for complete vacation packages.
6. Add professional and creative staffing.
7. Add optional authenticated cloud persistence and provider handoffs only after the local-first behavior is proven.

This order produces useful vertical slices early while preserving the vacation planner as the flagship experience.

## 2. Product promise

Ribband should let a person provide as little or as much context as they want, then receive recommendations that explain:

- what fits;
- which personal details influenced the result;
- what hard constraints were applied;
- what source facts support each item;
- what remains unknown or estimated;
- what tradeoffs separate the best options;
- what the complete price range is;
- what requires a fresh availability or price check;
- and what will happen if the user approves a handoff.

The system should be helpful with sparse input and more precise with richer input. It must not pressure the user into completing a long profile before receiving value.

## 3. Scope and non-goals

### In scope

- A user-owned preference and experience profile.
- Decision-scoped selection of profile facts.
- Profiles for recipients and collaborators, with stricter third-party privacy rules.
- Recommendations from sparse or detailed input.
- Deterministic, explainable ranking.
- Multi-item plans and packages with price ranges.
- Vacation packages containing lodging, activities, dining, and local transportation when supported by authorized sources.
- Gift recommendations that account for age band, interests, existing possessions, occasion, budget, and delivery timing.
- Date plans that balance both participants' preferences, past activities, time, location, and budget.
- Project staffing shortlists for home, technical, and creative work.
- Human-reviewed proposals for booking, contact, quote, cart, or navigation handoffs.
- Profile export, correction, deletion, and user-approved learning.

### Not in the first implementation

- Autonomous payment, booking, contracting, provider contact, or merchant checkout.
- Scraping arbitrary websites or bypassing access controls.
- Claiming real-time availability when only published hours or cached data are available.
- Persisting raw private memories by default.
- Inferring health, religion, ethnicity, sexuality, financial hardship, or other sensitive traits.
- Making employment, housing, credit, insurance, medical, or legal decisions.
- Background surveillance of a partner, child, recipient, worker, or provider.
- A social network, engagement feed, or advertising profile.
- Replacing professional credential checks for regulated trades.

## 4. Current baseline to preserve

The current application already provides the kernel needed for this expansion:

- one shared `Offer` model across retail, marketplace, wholesale, services, and travel;
- exact origin and path allowlisting;
- live versus fallback labeling;
- per-field provenance and conflict detection;
- deterministic marketplace ranking;
- one bounded uncertainty checkpoint;
- constraint-aware activity itinerary generation;
- short-lived review Quotes;
- visible human approval before page-local handoff;
- no agent-callable payment or booking action;
- no accounts, cookies, database, or persistent personal profile;
- no-store handling of current personal context.

The expansion must preserve the existing public demo and compatibility tool names while the generalized workspace is developed.

## 5. Architecture boundaries

### 5.1 Supply truth: Offer Protocol

`Offer` continues to describe facts asserted by an authorized source. Price, availability, schedule, provider, location, condition, cancellation, and other commercial facts belong here.

Every decision-relevant field keeps:

- source adapter;
- live or fallback state;
- fetch time;
- freshness policy;
- evidence state;
- conflict details;
- and handoff eligibility.

The existing rule remains: a field conflict is shown, not averaged away, and a conflicted Offer is ineligible for action.

### 5.2 Demand truth: Profile Protocol

The profile describes user-provided, imported, or explicitly confirmed personal context. It is user-owned, independently editable, and never treated as merchant evidence.

Profile data is projected into a decision only after the user can see or understand what is being used. The agent never receives the entire durable profile by default.

### 5.3 Request truth: Decision Protocol

A `DecisionBrief` describes one current goal. It names participants, the relevant profile facts, hard constraints, preferences, budget, timing, location, output type, and unanswered questions.

The brief is the only personal-context input to ranking and planning. This makes every recommendation reproducible and inspectable.

### 5.4 Decision output: Recommendation and Plan

A single-item decision returns ranked `Recommendation` records. A composite decision returns a `Plan` containing selected Offers, schedule or role structure, price accounting, conflicts, assumptions, alternatives, and evidence.

### 5.5 Action boundary: Handoff Proposal

An agent may prepare a handoff proposal. Only a visible human action may approve it. The Worker must reread source facts before approval and reject stale or changed proposals.

Handoff types can grow beyond cart review, but the safety pattern stays constant:

```text
prepare -> display exact effect -> human approves -> revalidate -> perform bounded handoff
```

## 6. Core domain contracts

The exact TypeScript may evolve during implementation, but the boundaries below should be established before UI work.

### 6.1 Subject

```ts
export type SubjectKind = "self" | "recipient" | "partner" | "collaborator";
export type AgeBand = "child" | "teen" | "adult" | "older-adult" | "not-provided";

export type ProfileSubject = {
  id: string;
  ownerId: string | null;
  kind: SubjectKind;
  displayLabel: string;
  relationship: string | null;
  ageBand: AgeBand;
  persistence: "decision-only" | "saved-on-device" | "saved-to-account";
  createdAt: string;
  updatedAt: string;
};
```

Do not require legal names or birth dates. A label such as `nephew` or `date partner` is enough.

### 6.2 Profile fact

```ts
export type ProfileFactKind =
  | "visited-place"
  | "liked-experience"
  | "disliked-experience"
  | "fond-memory-signal"
  | "previous-activity"
  | "interest"
  | "existing-item"
  | "avoidance"
  | "dietary-preference"
  | "accessibility-need"
  | "pace-preference"
  | "budget-preference"
  | "schedule-preference"
  | "skill-or-role-preference";

export type ProfileFact = {
  id: string;
  subjectId: string;
  kind: ProfileFactKind;
  value: unknown;
  source: "user-stated" | "imported" | "inferred-and-confirmed";
  confidence: "confirmed" | "tentative";
  sensitivity: "standard" | "private";
  lifeStage: "childhood" | "adulthood" | "honeymoon" | "recent" | null;
  allowedUses: Array<"vacation" | "gift" | "date" | "staffing">;
  lastConfirmedAt: string;
  expiresAt: string | null;
};
```

Implementation rules:

- Agent inference may create a proposed fact, never a saved fact.
- The user must approve a proposed fact before persistence.
- A memory can be represented as a compact signal such as `quiet mornings near water` rather than storing a full intimate story.
- Raw memory text is decision-only unless the user explicitly chooses to save it.
- Every saved fact shows why it exists, where it came from, and which use cases may access it.
- A fact can be corrected, expired, or deleted independently.

### 6.3 Decision brief

```ts
export type DecisionVertical = "vacation" | "gift" | "date" | "staffing";

export type BudgetEnvelope = {
  currencyCode: string;
  targetAmount: string | null;
  maximumAmount: string | null;
  includesTaxes: boolean | null;
  includesFees: boolean | null;
  contingencyPercent: number;
};

export type DecisionBrief = {
  id: string;
  vertical: DecisionVertical;
  goal: string;
  subjectIds: string[];
  selectedFactIds: string[];
  decisionOnlyFacts: ProfileFact[];
  hardConstraints: DecisionConstraint[];
  softPreferences: DecisionPreference[];
  budget: BudgetEnvelope | null;
  location: DecisionLocation | null;
  timeWindow: DecisionTimeWindow | null;
  output: "shortlist" | "single-choice" | "package";
  missingInformation: MissingInformation[];
  createdAt: string;
};
```

The brief serializer must be deterministic. Given the same profile projection, Offers, and request, it must produce the same normalized input for the ranking engine.

### 6.4 Recommendation

Generalize the existing marketplace result without removing its compatibility fields:

```ts
export type Recommendation = {
  rank: number;
  offerRef: { originId: string; handle: string };
  score: number;
  label: "Best fit" | "Best value" | "Worth a look" | "Strong alternative";
  factors: Record<string, number>;
  matchedFacts: Array<{ factId: string; explanation: string }>;
  unmetPreferences: string[];
  tradeoffs: string[];
  evidenceSummary: string;
  assumptions: string[];
  handoffEligible: boolean;
};
```

### 6.5 Plan and package

```ts
export type PlanKind = "vacation" | "date" | "staffing";

export type PlanItem = {
  id: string;
  category: "lodging" | "activity" | "dining" | "transport" | "professional";
  offerRef: { originId: string; handle: string } | null;
  title: string;
  startLocal: string | null;
  endLocal: string | null;
  quantity: number;
  price: PriceContribution;
  evidenceState: "verified" | "single-source" | "conflict" | "estimate";
  assumptions: string[];
};

export type Plan = {
  id: string;
  kind: PlanKind;
  briefId: string;
  status: "ready-for-review" | "needs-attention" | "no-feasible-plan";
  items: PlanItem[];
  totals: PlanTotals;
  conflicts: PlanConflict[];
  warnings: string[];
  alternatives: PlanAlternative[];
  generatedAt: string;
  sourceSnapshotAt: string;
};
```

`PlanTotals` must separate:

- verified subtotal;
- estimated subtotal;
- known taxes and fees;
- unknown charges;
- contingency;
- low and high total;
- target budget;
- maximum budget;
- and remaining or exceeded amount.

All arithmetic uses integer minor units. Mixed currencies are rejected unless a named exchange-rate source and timestamp are present.

### 6.6 Profile learning proposal

```ts
export type ProfileUpdateProposal = {
  proposalId: string;
  changes: Array<{
    operation: "add" | "replace" | "remove";
    before: ProfileFact | null;
    after: ProfileFact | null;
    reason: string;
  }>;
  status: "awaiting-human-confirmation";
  expiresAt: string;
};
```

No agent tool directly commits this proposal. The visible profile interface owns confirmation.

## 7. Offer Protocol extensions

Do not create separate product models for vacations, restaurants, technicians, or creatives. Extend `Offer` with optional facets.

### 7.1 Service facet changes

Expand service categories to:

```ts
type ServiceCategory =
  | "activity"
  | "wellness"
  | "home-service"
  | "dining"
  | "creative-service"
  | "technical-service";
```

Add fields for:

- service area;
- remote, provider-location, customer-location, outdoor, or mobile venue;
- published windows versus date-specific availability;
- request-only versus directly bookable status;
- rate type: fixed, hourly, daily, per-person, estimate, or minimum-callout;
- minimum hours or callout fee;
- role and specialty tags;
- equipment included or required;
- portfolio references with source provenance;
- credential and insurance claims with issuing source and verification time;
- crew size and capacity;
- accessibility features;
- dietary capability for dining;
- reservation duration and party limits;
- cancellation and deposit terms;
- travel or service-area fees;
- last availability check time.

Credential fields are evidence claims, not endorsements. Missing verification must be visible.

### 7.2 Travel facet

Add a travel facet for lodging and transportation Offers:

```ts
export type TravelFacet =
  | {
      kind: "lodging";
      property: { name: string; type: string; ratingClaim: number | null };
      location: OfferLocation;
      roomType: string;
      occupancy: { min: number; max: number };
      stayNights: { min: number; max: number };
      checkInLocal: string;
      checkOutLocal: string;
      amenities: string[];
      priceBasis: "per-night" | "per-stay";
      taxesAndFees: PriceDisclosure;
      cancellation: CancellationPolicy;
    }
  | {
      kind: "transport";
      mode: "flight" | "rail" | "car" | "rideshare" | "shuttle" | "ferry";
      origin: OfferLocation;
      destination: OfferLocation;
      departAt: string | null;
      arriveAt: string | null;
      durationMinutes: number | null;
      capacity: number;
      priceBasis: "per-person" | "per-vehicle" | "fixed" | "estimate";
      baggage: string[];
      cancellation: CancellationPolicy;
    };
```

Activities remain service Offers. Restaurants are dining service Offers. This avoids forcing unlike availability and price rules into one travel subtype.

### 7.3 Origin contract changes

Extend authorized path prefixes and adapter conformance for:

- `/lodging/*`;
- `/transport/*`;
- `/dining/*`;
- `/professionals/*`;
- and their first-party JSON feeds.

Every new origin must pass the existing authorization, expiry, redirect, byte-limit, timeout, interpolation, reconciliation, and revocation checks. Controlled first-party demo origins come before commercial providers.

## 8. Recommendation engine design

Refactor `src/recommendations.ts` into a domain-neutral engine with vertical strategies.

### 8.1 Pipeline

1. Validate and normalize the `DecisionBrief`.
2. Resolve only the profile facts listed by the brief.
3. Discover Offers from explicitly selected or eligible origins.
4. Reject Offers that fail hard constraints.
5. Normalize vertical-specific factors to a 100-point rubric.
6. Score each eligible Offer deterministically.
7. Attach matched profile facts, unmet preferences, evidence confidence, and tradeoffs.
8. Compare the top candidates.
9. Ask one bounded, high-information refinement question only when it could change the result.
10. Return the top recommendation and meaningful alternatives.

### 8.2 Strategy interface

```ts
export interface DecisionStrategy {
  vertical: DecisionVertical;
  validateBrief(brief: DecisionBrief): ValidationResult;
  eligible(offer: Offer, brief: DecisionBrief): EligibilityResult;
  score(offer: Offer, brief: DecisionBrief): ScoredOffer;
  refinement(candidates: ScoredOffer[], brief: DecisionBrief): Refinement | null;
}
```

Implement one strategy per vertical under `src/strategies/`.

### 8.3 Ranking rules

- Hard constraints always filter before scoring.
- User-confirmed facts outweigh tentative facts.
- Direct current-request preferences outweigh older profile preferences.
- Negative signals and explicit avoidances are never silently ignored.
- Evidence confidence affects ranking but cannot make an ineligible Offer eligible.
- Price scoring uses the correct basis, party size, quantity, nights, fees, and delivery.
- Sparse input uses a conservative default rubric and shows assumptions.
- The engine must explain factor values in plain language.
- No LLM-generated price, availability, credential, schedule, or source fact enters the score.

### 8.4 Package solver

Build packages with a bounded deterministic search rather than unbounded model generation:

1. Define required plan slots from the brief.
2. Keep the top eligible candidates for each slot.
3. Generate combinations with a fixed beam width and item cap.
4. Reject combinations that violate budget, occupancy, geography, timing, or availability rules.
5. Score complete packages for preference fit, evidence, price, schedule quality, and diversity.
6. Return one primary package and at most two materially different alternatives.
7. Return `no-feasible-plan` with typed causes when nothing fits.

The language model can help elicit intent and summarize results. It cannot perform source truth, money arithmetic, conflict resolution, or final eligibility checks.

## 9. Vertical implementation details

### 9.1 Vacation planning

#### Inputs

- departure region;
- candidate destinations or open-ended destination discovery;
- dates and flexibility;
- travelers, ages by band, rooms, and occupancy;
- total budget and what it includes;
- prior countries and destinations;
- experiences associated with fond memories;
- preferred pace, climate, setting, food, activity level, and nightlife;
- accessibility, dietary, safety, documentation, and mobility constraints;
- novelty preference versus desire to revisit;
- lodging style;
- transportation tolerance;
- cancellation flexibility;
- and must-do or avoid items.

#### Behavior

- First recommend destination candidates when the destination is open.
- Explain how past memories shaped themes, not just geography.
- Avoid assuming that a fond memory means the user wants an identical trip.
- Ask whether the user wants familiarity, novelty, or a blend when that distinction changes the destination.
- Build lodging, activity, dining, and local-transport packages.
- Add arrival and departure buffers.
- Keep published hours distinct from date-specific availability.
- Show per-person and whole-party totals.
- Show low and high totals when fees or dining spend are estimated.
- Keep at least one lower-cost alternative when feasible.
- Revalidate every actionable item before any handoff.

#### First controlled data slice

Extend `services-lab` into a first-party travel lab for one destination:

- 4 lodging Offers;
- 8 to 12 activities;
- 6 dining Offers;
- 3 local transportation Offers;
- multiple price levels;
- at least one sold-out or unavailable case;
- at least one evidence conflict;
- at least one cancellation tradeoff;
- at least one accessibility constraint;
- and at least one package that exceeds budget.

Use the current Oahu activity data as the seed, then add original lodging, dining, and transport fixtures. Keep every fixture clearly labeled as controlled demonstration data.

#### Acceptance criteria

- A user can provide only destination, dates, party size, and budget and receive a useful package with visible assumptions.
- Richer memories and preferences change ranking in deterministic tests.
- A three-day package cannot double-book time, exceed occupancy, silently exceed budget, or mix destinations without a surfaced transition rule.
- Unknown taxes or fees appear as unknown, not zero.
- A source conflict blocks handoff for only the affected item and clearly marks the plan as needing attention.
- The package can be revised by cost, pace, theme, or one item without rebuilding unrelated choices.

### 9.2 Gifts

#### Inputs

- recipient label and relationship;
- age band;
- interests and favorite activities;
- existing items or likely duplicates;
- dislikes and avoidances;
- occasion and delivery deadline;
- budget range;
- practical versus memorable preference;
- physical versus experience gift;
- safety, allergy, or guardian constraints when relevant;
- and how confident the giver is in each detail.

#### Behavior

- Work from a one-sentence prompt when that is all the user has.
- Ask at most one question at a time, chosen for expected ranking impact.
- Offer a safe broad option, a highly tailored option, and an experience option when supported.
- Explain why each suggestion fits and what could make it wrong.
- Penalize likely duplicates.
- Respect age suitability and delivery date as hard constraints.
- Never infer a child's sensitive traits or persist their data by default.

#### First controlled data slice

Use the current guitar marketplace to prove recipient matching, then add two small first-party product categories so the gift flow is not synonymous with guitars.

#### Acceptance criteria

- A sparse request such as `gift for my 12-year-old nephew who likes drawing` returns useful options without requiring account creation.
- Adding existing-item data removes duplicates.
- An impossible delivery deadline produces a visible conflict.
- Age-inappropriate or explicitly avoided products are filtered before scoring.
- No recipient profile is saved unless the giver explicitly chooses persistence.

### 9.3 Dates

#### Inputs

- both participants' interests;
- dislikes and exclusions;
- previous dates or activities;
- desired mood;
- date, duration, and location;
- transport radius;
- accessibility and dietary needs;
- indoor or outdoor preference;
- desired novelty;
- and per-date budget.

#### Behavior

- Compute preference intersection, not just the requesting user's score.
- Distinguish shared likes, one-person stretch options, and conflicts.
- Penalize recently repeated activities when novelty is requested.
- Build one primary date and two different alternatives across cost bands.
- Use weather only when backed by a current source and label the timestamp.
- Keep each participant's private facts scoped to the decision.
- Never infer relationship quality or compatibility.

#### First controlled data slice

Reuse Oahu service activities and dining Offers. Add evening windows, duration, party-size rules, accessibility attributes, and dining costs.

#### Acceptance criteria

- A date plan contains a coherent schedule, transition allowance, and whole-date cost range.
- A hard dislike from either participant eliminates an option.
- The explanation shows which interests are shared and which tradeoff was made without revealing unrelated profile facts.
- The user can request cheaper, more adventurous, quieter, or less repetitive alternatives.

### 9.4 Home and creative project staffing

#### Inputs

- project description;
- location or remote eligibility;
- desired roles and skills;
- dates and estimated duration;
- budget or rate range;
- urgency;
- required tools or equipment;
- licensing, insurance, permit, or union requirements;
- portfolio style or reference work;
- crew size;
- accessibility or site constraints;
- and whether the request is discovery, estimate, or contact preparation.

#### Behavior

- Convert the project into a role brief before matching providers.
- Separate required qualifications from preferences.
- Show verified, self-asserted, missing, and conflicting credentials distinctly.
- Recommend individuals or compatible crew groupings.
- Calculate hourly, daily, callout, equipment, and estimated project costs separately.
- Surface scheduling gaps and uncovered roles.
- Prepare a contact or quote-request draft, but require visible human approval before sending anything.
- Do not rank people using protected traits or proxies.

#### First controlled data slice

Create original fixtures for:

- electrician;
- carpenter;
- general repair technician;
- cinematographer;
- camera assistant;
- sound recordist;
- editor;
- motion designer;
- and production coordinator.

Include incomplete credential evidence, schedule conflicts, overlapping specialties, rate differences, and equipment tradeoffs.

#### Acceptance criteria

- The engine can return `no verified provider meets the license requirement` rather than weakening the requirement.
- A crew package exposes missing roles and schedule conflicts.
- Cost totals distinguish quotes from estimates.
- No provider is contacted and no appointment is made by an agent alone.
- Credential status links to its evidence source and verification time.

## 10. Sparse input and onboarding

Onboarding should be progressive and tied to an immediate decision.

### First-use flow

1. Choose a task: vacation, gift, date, or project.
2. Enter a one-sentence goal.
3. Add the minimum hard constraints for that task.
4. Optionally add people, prior experiences, or memories.
5. Review the compact `What Ribband will use` summary.
6. Choose `Use once` or `Save on this device`.
7. Receive an initial result.
8. Refine only if the answer could materially improve.

Every optional step has a visible skip action. The user can receive a result without building a durable profile.

### Memory elicitation

Use concrete, low-pressure prompts:

- `Tell me about a trip you still talk about.`
- `What part mattered: the place, the people, the pace, the food, or the feeling?`
- `Would you like something familiar, something new, or a mix?`
- `Is there anything you definitely do not want repeated?`

After parsing a response, show the proposed signals before use or storage. For example:

```text
Possible travel signals
- Quiet mornings near water
- Walkable local food
- One anchor activity per day

Use for this plan only [default]
Save these to my profile
Edit
```

### Profile center

Provide visible sections for:

- Me;
- People I plan for;
- Places and experiences;
- Preferences and constraints;
- Decisions and feedback;
- Consent and data controls;
- Export;
- Delete selected facts;
- and delete all saved data.

Each fact card shows its source, confidence, allowed uses, last confirmation date, and a plain-language explanation of when it may matter.

## 11. Persistence and identity plan

Persistence is a staged capability because the current application deliberately has no accounts or database.

### Phase A: local-first profile

Default behavior remains decision-only and in memory.

When the user chooses `Save on this device`:

- store the profile in IndexedDB under the Ribband origin;
- keep decision-only context in page memory so it does not survive refresh;
- send only the selected decision projection to the Worker;
- use `Cache-Control: no-store` for personal requests and responses;
- never place profile content in URLs;
- never log prompt text, fact values, request bodies, or generated plans;
- provide JSON export and full deletion;
- validate imports against a versioned schema, cap their size, reject unknown fields, and generate fresh local identifiers;
- provide an optional passphrase-encrypted export using Web Crypto;
- and make clear that local browser storage is not the same as end-to-end encryption.

This phase delivers real persistence without introducing account recovery, multi-device identity, or a server-side personal-data breach surface.

### Phase B: authenticated cloud profile

Add only after the local-first flows and privacy model are validated.

Recommended infrastructure:

- standards-based external identity provider through an `IdentityProvider` interface;
- Cloudflare D1 for relational profile metadata, consent, decision records, and audit state;
- application-layer encrypted values for private profile facts;
- versioned encryption keys stored outside source control;
- Durable Objects only where per-user serialization or collaborative live state is actually needed;
- no KV as the authoritative profile store;
- and no R2 storage unless the product later accepts user-owned documents or media.

D1 is a natural fit for the relational profile and consent model because it exposes SQLite semantics through Worker bindings. Durable Objects should remain optional because their main value here is strongly consistent per-entity coordination, not ordinary stateless request handling.

Authoritative platform references:

- [Cloudflare D1 overview](https://developers.cloudflare.com/d1/)
- [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/)
- [Cloudflare Durable Objects rules](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)

### Proposed D1 schema

```text
users
  id, identity_subject, created_at, deleted_at

subjects
  id, owner_user_id, kind, display_label_ciphertext, age_band,
  persistence, created_at, updated_at, deleted_at

profile_facts
  id, subject_id, kind, value_ciphertext, source, confidence,
  sensitivity, life_stage, allowed_uses_json, last_confirmed_at,
  expires_at, created_at, updated_at, deleted_at

consent_grants
  id, owner_user_id, subject_id, purpose, scope_json,
  granted_at, revoked_at

decision_records
  id, owner_user_id, vertical, brief_ciphertext, status,
  created_at, expires_at, deleted_at

plans
  id, decision_id, plan_ciphertext, source_snapshot_at,
  created_at, updated_at, deleted_at

feedback_events
  id, decision_id, event_type, payload_ciphertext,
  created_at, profile_update_proposal_id

audit_events
  id, owner_user_id, event_type, object_type, object_id,
  metadata_json, created_at
```

`audit_events.metadata_json` must contain operational metadata only, never decrypted profile values.

### Identity and encryption decision gate

Before Phase B implementation, document and review:

- identity provider and account recovery;
- session duration and device revocation;
- key hierarchy and rotation;
- which fields require encryption beyond platform storage encryption;
- backup and deletion behavior;
- breach response;
- data residency requirements;
- and whether multi-device sync is worth the new risk.

Do not implement home-grown password authentication.

## 12. API and WebMCP surface

### 12.1 HTTP routes for the local-first phase

Keep profile storage in the browser. Add stateless Worker routes:

```text
POST /api/decision-briefs/validate
POST /api/recommendations
POST /api/plans
POST /api/plans/revise
POST /api/profile-updates/propose
POST /api/handoffs/propose
POST /api/handoffs/confirm
```

Each route receives bounded schemas, rejects unknown fields, applies `no-store`, and returns structured errors. Correlation logs contain only route, timing, adapter, result class, byte count, and normalized failure.

### 12.2 HTTP routes for the authenticated phase

```text
GET    /api/profile
PUT    /api/profile/subjects/:subjectId
DELETE /api/profile/subjects/:subjectId
PUT    /api/profile/facts/:factId
DELETE /api/profile/facts/:factId
POST   /api/profile/export
DELETE /api/profile
GET    /api/decisions
GET    /api/decisions/:decisionId
```

All mutations require authenticated ownership checks, CSRF protection appropriate to the session design, optimistic version checks, and audit events.

### 12.3 WebMCP tools

Preserve the current ten tools on the existing demo route. Add the generalized workspace on a separate route during development so tool changes do not break the submission demo.

Recommended generalized tool set:

1. `list_origins`
2. `select_origin`
3. `search_offers`
4. `get_offer`
5. `compare_offers`
6. `build_decision_brief`
7. `recommend_options`
8. `create_plan`
9. `revise_plan`
10. `propose_handoff`

Compatibility wrappers:

- `search_products` delegates to `search_offers` with a product filter.
- `find_best_options` delegates to `recommend_options`.
- `create_activity_itinerary` delegates to `create_plan` with a date or activity brief.
- `propose_add_to_cart` delegates to `propose_handoff` with `type: cart`.

Do not register profile mutation tools in the first release. Profile changes occur through visible UI confirmation. If a future agent-callable proposal tool is added, it may only generate a diff and must not persist it.

Use current WebMCP schemas, explicit tool descriptions, cancellation signals for long-running work, bounded outputs, and accurate `readOnlyHint` annotations. See the [Chrome WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## 13. UI architecture

Keep the current vanilla TypeScript Worker and static browser application. Do not introduce a UI framework solely for this expansion.

Add a new `/workspace` route with browser-native ES modules. Leave the current landing and demo route stable until the new workspace meets parity.

### Primary workspace regions

- task switcher;
- conversational intake;
- `What Ribband is using` context drawer;
- recommendation or plan canvas;
- price and budget panel;
- evidence and source drawer;
- assumptions and conflicts panel;
- alternatives and revision controls;
- human handoff review;
- and profile learning proposal.

### Interaction requirements

- Any recommendation can reveal its factor breakdown.
- Clicking a matched preference opens the exact profile fact used.
- Users can remove a fact from the current decision without deleting it globally.
- Users can change budget, dates, pace, or one plan item and receive a scoped revision.
- Conflicts remain visible until resolved or explicitly accepted as planning-only.
- The handoff button names the exact effect, such as `Open provider contact page` or `Approve reviewed cart handoff`.
- Nothing uses a generic `Continue` label when the next action has external consequences.
- Sparse input and skip paths receive equal visual weight to profile completion.

## 14. File-level implementation map

### Domain and engine

```text
src/profile.ts                    ProfileSubject, ProfileFact, validation
src/decision-brief.ts             DecisionBrief normalization and projection
src/decision-types.ts             Shared decision and plan contracts
src/pricing.ts                    Minor-unit arithmetic and price ranges
src/plans.ts                      Domain-neutral Plan assembly and validation
src/plan-solver.ts                Bounded package search
src/profile-updates.ts            Proposed profile diffs
src/handoffs.ts                   Generalized proposal and revalidation boundary
src/strategies/types.ts           DecisionStrategy contract
src/strategies/gift.ts            Gift eligibility and scoring
src/strategies/date.ts            Two-person fit and date scoring
src/strategies/vacation.ts        Destination and package scoring
src/strategies/staffing.ts        Role and provider matching
```

Refactors:

```text
src/offers.ts                     Add travel and expanded service facets
src/recommendations.ts            Compatibility wrapper over generic engine
src/itinerary.ts                  Compatibility wrapper over Plan solver
src/origin-contract.ts            New path and schema capabilities
src/catalog.ts                    Vertical-neutral filters and pagination
src/index.ts                      Delegate routes to smaller route modules
src/demo-services.ts              Seed travel and professional fixtures
```

### Worker routes

```text
src/routes/decision-briefs.ts
src/routes/recommendations.ts
src/routes/plans.ts
src/routes/profile-updates.ts
src/routes/handoffs.ts
src/routes/profile.ts             Phase B only
```

### Browser workspace

```text
public/workspace.html
public/workspace.js
public/workspace-profile.js
public/workspace-intake.js
public/workspace-plan.js
public/workspace-evidence.js
public/workspace-handoff.js
public/workspace.css
```

### Persistence

```text
src/stores/profile-store.ts       Interface
src/stores/browser-profile.ts     Browser contract helpers
src/stores/d1-profile.ts          Phase B
migrations/0001_identity.sql      Phase B
migrations/0002_profiles.sql      Phase B
migrations/0003_decisions.sql     Phase B
```

### Tests and evaluation fixtures

```text
test/profile.spec.ts
test/decision-brief.spec.ts
test/pricing.spec.ts
test/plan-solver.spec.ts
test/gift-strategy.spec.ts
test/date-strategy.spec.ts
test/vacation-strategy.spec.ts
test/staffing-strategy.spec.ts
test/profile-privacy.spec.ts
test/workspace-tools.spec.js
test/workspace-runtime.spec.js
test/fixtures/evals/*.json
```

### Documentation

```text
docs/PROFILE_PROTOCOL.md
docs/DECISION_PROTOCOL.md
docs/PRIVACY_MODEL.md
docs/VERTICAL_ACCEPTANCE.md
docs/PROVIDER_ONBOARDING.md
docs/PERSONALIZED_DECISION_PLATFORM_PLAN.md
```

Update, do not fork, these existing sources of truth:

- `docs/OFFER_PROTOCOL.md`
- `docs/ORIGIN_ONBOARDING.md`
- `docs/THREAT_MODEL.md`
- `docs/EVALS.md`
- `public/privacy.html`
- `README.md`

## 15. Sequenced implementation plan

Estimates are engineering ranges for one developer familiar with this repository. They exclude provider contracting, commercial API approval, legal review, and app-store or Devpost review time.

### Milestone 0: protect and identify the baseline

Estimate: 0.5 to 1 day

Tasks:

- Confirm the intended deployed commit before any release action.
- Run `npm run verify` and `npm run verify:live` against the intended baseline.
- Capture current demo evidence.
- Tag the exact accepted release as `challenge-v1` only after deployment approval and verification.
- Create expansion work on a separate branch or worktree.
- Add a feature flag or separate `/workspace` route for all new behavior.

Exit gate:

- Current demo behavior and ten-tool discovery remain reproducible.
- No new profile claim appears on the existing privacy page.
- Baseline and expansion work cannot be confused in live verification.

### Milestone 1: contracts and compatibility refactor

Estimate: 3 to 5 days

Tasks:

- Add Profile, DecisionBrief, Recommendation, Plan, and price contracts.
- Extract money arithmetic into `src/pricing.ts`.
- Add generic `DecisionStrategy` interface.
- Wrap the current marketplace recommender as the first strategy.
- Wrap the current activity itinerary as the first Plan projection.
- Extend Offer facets behind fixtures and tests.
- Add version markers to serialized contracts.
- Write Profile and Decision Protocol documents.

Exit gate:

- All existing 114 tests still pass or are deliberately updated with equivalent coverage.
- Existing API and WebMCP outputs remain compatible.
- New contracts have unit tests for malformed, oversized, unknown, and conflicting inputs.
- No UI behavior change is required to pass this milestone.

### Milestone 2: local-first profile and onboarding

Estimate: 4 to 6 days

Tasks:

- Build the `/workspace` shell.
- Implement subjects and profile facts in browser storage.
- Add decision-only, save-on-device, export, import, edit, and delete controls.
- Build the context projection drawer.
- Add proposed memory-signal review.
- Add profile-update proposals after a decision.
- Update privacy and threat-model documentation.
- Add XSS, storage isolation, deletion, and logging tests.

Exit gate:

- A user can complete a task without saving anything.
- Saving on device survives refresh and is isolated to the Ribband origin.
- Export and reimport round-trip exactly.
- Delete all removes the local profile and active decision.
- The Worker receives only selected profile facts.
- No personal values appear in URLs, diagnostics, or logs.

### Milestone 3: generalized recommendations and gift vertical

Estimate: 4 to 6 days

Tasks:

- Implement `build_decision_brief` and `recommend_options`.
- Add gift eligibility and scoring.
- Map existing marketplace scoring into the generalized factors.
- Add duplicate, age-band, delivery-date, and budget constraints.
- Add one-question refinement based on score sensitivity.
- Add two additional controlled gift categories.
- Register the generalized WebMCP tools on `/workspace`.

Exit gate:

- Sparse and rich gift requests both work.
- Same input and fixtures produce the same rank order.
- A confirmed profile change predictably changes the relevant factor.
- Duplicate, unsafe, late, and over-budget items cannot win.
- All recommendation explanations cite selected personal facts and Offer evidence.

### Milestone 4: date planning

Estimate: 4 to 6 days

Tasks:

- Implement two-person preference aggregation.
- Extend dining service Offers.
- Generalize itinerary output into a date Plan.
- Add mood, novelty, previous-activity, duration, distance, and per-date budget inputs.
- Add plan revision controls.
- Add controlled date scenarios with shared likes, conflicting dislikes, and varied costs.

Exit gate:

- Both participants' hard constraints are honored.
- A plan contains time, price, evidence, and transition allowances.
- The output includes meaningful alternatives across cost or mood.
- No unrelated private fact appears in the explanation.

### Milestone 5: vacation package MVP

Estimate: 8 to 12 days

Tasks:

- Add lodging and transportation facets.
- Add first-party travel, dining, and lodging fixtures for one destination.
- Add destination discovery from memory and preference themes.
- Implement package slots and bounded combination search.
- Add nights, occupancy, arrival, departure, date, timezone, and party pricing.
- Add price ranges, contingency, unknown-fee handling, and budget revisions.
- Add revalidation status per item.
- Add controlled conflict and no-feasible-plan scenarios.
- Build package UI with daily schedule and cost breakdown.

Exit gate:

- The system produces a complete lodging, activity, dining, and local-transport package for the controlled destination.
- The total is arithmetically correct for party size and nights.
- Stale or conflicted items cannot enter an actionable handoff.
- The user can replace one item without losing the rest of the plan.
- A package over budget is either revised or explicitly marked as infeasible.

### Milestone 6: staffing vertical (Completed locally on `codex/personalized-decisions`)

Status: Complete locally (September 3, 2026). All tasks implemented and verified with automated test coverage across unit, origin, catalog, service, and decision orchestrator suites.

Tasks:

- Extend professional service Offers (`src/offers.ts`, `src/catalog.ts`, `src/interpolate.ts`).
- Implement project-to-role brief generation and crew solver (`src/personalized-staffing.ts`).
- Implement provider and crew matching (`src/personalized-staffing.ts`).
- Add credential, service-area, availability, equipment, and rate constraints.
- Add quote versus estimate accounting.
- Add contact and quote-request proposal preview with human-only boundary enforcement.
- Add original home and creative provider fixtures (`src/demo-services.ts`, `src/demo-origin.ts`).
- Wire staffing into the unified decision orchestrator (`src/decision-orchestrator.ts`).
- Wire staffing into the unified `/decide` UI and `plan_decision` WebMCP tool (`public/decide.html`, `public/decide.js`, `public/workspace.css`, `test/decision-workspace.spec.js`).

Exit gate:

- Required qualifications are never downgraded to preferences (verified in `test/personalized-staffing.spec.ts`).
- Crew plans expose missing roles and schedule gaps (verified in `test/personalized-staffing.spec.ts`).
- Credential provenance is visible (verified in `test/services.spec.ts` and `test/demo-origin.spec.ts`).
- The user must approve before any provider page is opened or any future message is sent (verified in `test/decision-orchestrator.spec.ts` and `test/personalized-staffing.spec.ts`).
- The unified workspace and WebMCP `plan_decision` tool handle staffing alongside gift, date, and vacation with read-only guarantees (verified in `test/decision-workspace.spec.js`).

### Milestone 7: authenticated persistence

Estimate: 10 to 15 days after the identity decision gate

Tasks:

- Select and integrate the identity provider.
- Add D1 schema and migrations.
- Implement ownership checks and profile store abstraction.
- Encrypt private values before storage.
- Add session, device, recovery, export, and deletion workflows.
- Add consent and audit records.
- Add optimistic versioning and conflict handling.
- Run migration, backup, restore, and account-deletion drills in preview.

Exit gate:

- Cross-user access tests fail closed.
- Account deletion removes or tombstones all records according to the documented retention policy.
- Key rotation and restore procedures are documented and tested.
- Local-only mode remains available.
- Server-side profile storage is opt-in and clearly distinguished from on-device storage.

### Milestone 8: authorized live providers and bounded handoffs

Estimate: 5 to 10 days per adapter, excluding external approval

Tasks:

- Select providers based on documented data rights and API terms.
- Add one adapter at a time through the existing origin onboarding process.
- Implement live availability and price freshness policies per provider.
- Add deeplink, quote-request, contact-page, or booking-page handoffs.
- Revalidate exact details immediately before approval.
- Add provider-specific failure normalization and revocation tests.

Exit gate:

- Every provider is allowlisted and authorized.
- Every live field is attributable to a current source.
- Failure falls back to research-only behavior, not fabricated certainty.
- No external action occurs without an effect-specific approval screen.

### Milestone 9: hardening and public release

Estimate: 5 to 8 days

Tasks:

- Complete privacy, security, accessibility, mobile, and keyboard review.
- Add rate limits and abuse controls.
- Run WebMCP discovery and cancellation tests in supported Chrome builds.
- Run full browser QA for all four verticals.
- Run live-origin expiry, stale-price, conflict, redirect, and oversized-response tests.
- Verify observability contains no personal text.
- Refresh all docs, demo evidence, and submission claims.
- Deploy to preview, then production only after explicit approval.

Exit gate:

- All automated gates pass.
- Every core flow has fresh rendered proof.
- Privacy controls work in the deployed build.
- Live deployment reports the intended commit.
- Claims distinguish controlled data, live integrations, estimates, and roadmap items.

## 16. Verification plan

### Automated checks on every change

```bash
npm run typecheck
npm test
npm run verify
```

### Contract tests

- Reject missing required fields.
- Reject unknown enum values and unexpected object keys.
- Enforce text, array, candidate, plan-item, and response size limits.
- Reject invalid dates, timezones, currency codes, and money formats.
- Reject mixed currency without a conversion source.
- Round money only at defined boundaries.
- Preserve compatibility output for existing routes and tools.

### Recommendation tests

- Same inputs produce identical ranking.
- Hard constraints always dominate soft preferences.
- Confirmed facts outweigh tentative facts.
- Current decision input outweighs older saved preferences.
- Negative preferences are represented.
- Bounded refinement changes the result only when the selected tradeoff warrants it.
- Sparse input produces explicit assumptions.
- No source evidence means no factual claim.

### Plan tests

- No overlapping time slots.
- Valid local dates and timezones.
- Correct party, quantity, night, rate, and callout calculations.
- Correct daily and whole-plan totals.
- Transition buffers are explicit estimates.
- Occupancy and party limits are enforced.
- Required plan slots cannot silently disappear.
- No-feasible-plan cases return typed conflicts.
- One-item revisions preserve unaffected items when still valid.

### Privacy tests

- Decision-only facts do not survive refresh.
- Unselected saved facts are not sent to the Worker.
- No personal text appears in URL, diagnostics, console, access log fields, or error output.
- Profile export contains only the requesting user's data.
- Fact deletion and delete-all work.
- Third-party subjects default to decision-only.
- Child profiles reject persistent raw memory text.
- Inferred facts cannot be saved without confirmation.

### Security tests

- Existing SSRF and exact-origin protections remain intact.
- Off-origin redirects fail closed.
- Origin authorization expiry removes the source from discovery.
- Untrusted Offer text cannot inject HTML or tool instructions.
- Stale, fallback, unavailable, or conflicting Offers cannot be handed off.
- Proposal confirmation fails if price, availability, scope, or total changes.
- Profile identifiers cannot be used to access another owner.
- Rate limits and request bounds fail with normalized errors.

### Browser and WebMCP tests

- Tools register only on the intended top-level document.
- Current demo tool names continue to work.
- Generalized tools have accurate schemas and annotations.
- Tool cancellation aborts long fetches or plan generation.
- Each tool result is reflected visibly in the workspace.
- Keyboard-only and mobile flows can inspect evidence and approve or dismiss a proposal.

### Evaluation set

Create at least 40 deterministic scenarios:

- 10 vacation cases;
- 10 gift cases;
- 8 date cases;
- 8 staffing cases;
- 4 adversarial or privacy cases.

Each fixture declares expected eligibility, top-factor ranges, required conflict codes, price range, and prohibited output claims. Do not use free-form snapshot text as the only assertion.

### Live verification

Run `npm run verify:live` after approved deployments, then manually verify:

- reported commit;
- tool discovery;
- controlled and live source labels;
- stale and conflict behavior;
- profile deletion;
- one sparse and one rich scenario per vertical;
- and the complete human handoff boundary.

## 17. Privacy and safety requirements

### Data minimization

- Ask only for facts that can change the current decision.
- Prefer age band to birth date.
- Prefer relationship label to legal identity.
- Prefer summarized memory signals to raw stories.
- Apply expiry to tentative or situational facts.
- Do not retain rejected suggestions as implicit negative preferences.

### Consent

- `Use once` is the default.
- Saving requires a visible choice.
- Each fact has allowed-use scopes.
- A user can remove facts from one decision without deleting them globally.
- A user can revoke a subject or vertical's access.
- Profile learning is opt-in per proposed change.

### Third-party and child data

- The profile owner confirms they are entering the information for planning.
- Third-party subjects default to decision-only.
- No contact details are required for recommendation.
- No raw stories about a minor are saved by default.
- No behavior tracking or sensitive inference is permitted.
- Gift safety constraints take precedence over preference fit.

### Explanation

- Say `You told Ribband` for confirmed facts.
- Say `For this plan, Ribband assumed` for defaults.
- Never phrase tentative signals as identity claims.
- Show why a fact mattered and let the user remove it.

## 18. Observability and product metrics

Operational telemetry may include:

- route and tool name;
- origin and adapter identifier;
- response class;
- duration;
- bytes;
- candidate count;
- conflict code counts;
- refinement shown or not shown;
- and handoff proposed, approved, dismissed, or rejected.

It must not include:

- prompt text;
- profile values;
- memory text;
- names or recipient labels;
- source response bodies;
- plan descriptions;
- or provider messages.

Useful product measures:

- percent of sessions reaching a first recommendation;
- recommendation accepted or revised;
- package completion rate;
- budget adherence;
- frequency and usefulness of refinement questions;
- source coverage and conflict rate;
- item replacement rate;
- user correction and deletion rate;
- handoff approval rate;
- and stale-source rejection rate.

Do not optimize for time in app, profile completeness, or maximum data collection.

## 19. Release strategy

### Release A: Personal decisions alpha

Includes:

- local-first profile;
- decision briefs;
- generalized recommendation engine;
- gift flow using current and expanded controlled product catalogs;
- date flow using controlled activities and dining;
- existing demo compatibility.

### Release B: Vacation composer

Includes:

- lodging and transport Offers;
- one complete controlled destination;
- package solver;
- item-level revisions;
- price-range accounting;
- source freshness and conflict handling.

### Release C: Project crew planner

Includes:

- home and creative provider Offers;
- role briefs;
- individual and crew matching;
- credential evidence;
- estimate and contact proposals.

### Release D: Account sync and authorized live providers

Includes:

- optional cloud account;
- D1 persistence;
- approved live provider adapters;
- bounded external handoffs;
- account export and deletion.

Each release remains useful without the next. Release D must not be treated as required for proving the personalized decision model.

## 20. Risks and mitigations

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Four verticals become four codebases | Slow development and inconsistent trust rules | Enforce Offer, Profile, DecisionBrief, Recommendation, Plan, and Handoff boundaries |
| Personal memories create a sensitive data store | Privacy and breach harm | Decision-only default, signal summaries, local-first storage, explicit consent, deletion |
| Sparse input yields generic results | Low user trust | Conservative defaults, visible assumptions, one high-value refinement question |
| Rich profile overwhelms the agent | Privacy leakage and noisy ranking | Decision-scoped profile projection with selected fact IDs |
| Travel combinations explode | Slow or unstable planning | Bounded candidate caps, beam width, deterministic solver, typed no-feasible result |
| Prices and availability drift | Invalid packages | Freshness policies, source timestamps, price ranges, approval-time revalidation |
| Provider credentials are overstated | Safety and legal risk | Evidence claims, issuing source, verification time, fail closed on requirements |
| Third-party data is collected casually | Recipient or child privacy harm | Decision-only default, minimal fields, no sensitive inference, explicit save action |
| Tool surface becomes confusing | Agent chooses unsafe or wrong action | Context-specific workspace tools, compatibility wrappers, accurate annotations |
| Live data access violates provider terms | Revocation or legal exposure | Authorization attestation, allowlist, official APIs, origin review and expiry |
| Authentication expands attack surface | Account takeover or cross-user leaks | External standards-based identity, ownership tests, session controls, staged launch |
| Demo claims outpace implementation | Submission credibility damage | Preserve evidence docs and label controlled, live, partial, roadmap, and unverified states |

## 21. Decision register

These defaults let implementation begin without blocking on product questions.

| Decision | Default | Reason |
| --- | --- | --- |
| First persistence mode | Decision-only plus optional save on device | Preserves the current trust boundary while delivering a real profile |
| First proof vertical | Gift, then date | Reuses the current product and service Offers and validates the new profile fastest |
| Flagship vertical | Vacation packages | Best demonstration of memories, multi-item planning, budget, and evidence |
| Initial geography | One controlled destination, seeded by current Oahu services | Keeps data rights, testing, and package constraints manageable |
| Initial travel handoff | Research and deeplink only | Avoids premature booking and payment claims |
| Flight support | Planning estimate or authorized live Offer only | Flight inventory and ticketing add a separate commercial and regulatory boundary |
| Child data | Age band and decision-only by default | Minimizes third-party and minor data risk |
| Cloud profile | Deferred until local-first validation | Avoids building identity before product behavior is proven |
| UI stack | Existing static app plus browser-native modules | Minimizes tooling churn and preserves deploy simplicity |
| Solver | Deterministic bounded TypeScript | Keeps arithmetic, conflicts, and explanations testable |

## 22. Definition of done for the personalized platform MVP

The MVP is complete when all of the following are true:

- A first-time user can start with a one-sentence vacation, gift, date, or staffing request.
- The user can add personal context, memories, recipients, or collaborators without creating an account.
- The user can see exactly which profile facts are used.
- The same profile contracts work across all four verticals.
- Offers remain source-grounded and separate from personal inference.
- Hard constraints filter before ranking.
- Recommendations explain fit, tradeoffs, assumptions, price, and evidence.
- Vacation and date outputs contain coherent multi-item plans.
- Staffing can produce role and provider shortlists with credential status.
- Gift recommendations handle sparse input, age band, duplicates, budget, and deadline.
- Users can revise one constraint or item without restarting.
- Users can save locally, export, correct, and delete profile data.
- No agent can book, pay, contact, contract, or persist an inferred profile fact without a visible human action.
- Existing Ribband demo behavior and compatibility tools still pass.
- Automated, browser, privacy, adversarial, and live verification evidence is current.
- Public claims accurately distinguish controlled data, live data, estimates, shipped behavior, and roadmap work.

## 23. Current build checkpoint and next slice

Implemented locally:

1. Versioned `ProfileSubject`, `ProfileFact`, and `DecisionBrief` contracts with bounded validation.
2. A browser-only `Use once` default and optional on-device gift-recipient profile.
3. Selected gift-recipient fact projection into the existing marketplace recommender.
4. A request-only two-person date brief using interests, hard dislikes, previous activities, mood, day, place, and budget.
5. Deterministic low-cost, balanced, and special-occasion date packages built from existing service Offers and the itinerary engine.
6. Visible matched-fact explanations, participant coverage, exclusions, evidence, transition allowances, and whole-date cost ranges.
7. One read-only `plan_personalized_date` WebMCP tool with no booking, contact, payment, or profile mutation capability.
8. A request-only vacation package proof with value, balanced, and signature tiers across lodging, transport, dining, and activities.
9. One typed decision orchestrator endpoint, a fixed gift, date, and vacation strategy registry, and a shared result envelope.
10. One `/decide` workspace and one read-only `plan_decision` WebMCP tool with linked full-context revision.
11. A request-only profile-update proposal endpoint plus explicit on-device approval, rejection, correction, deletion, and later fact selection.
12. Focused contract, planner, endpoint, privacy, and static workspace tests while preserving existing routes and compatibility tools.

Verified staffing supply is now implemented. The release-candidate convergence pass makes the unified agent discoverable from the homepage, exercises all four strategies through WebMCP and a running Worker, verifies the outcome-memory lifecycle, adds a repeatable personalized smoke suite, and reconciles product and release documentation. The next product slice after release is the shared local-first people and preferences layer: reusable but explicitly selected facts, relationships, memories, dislikes, accessibility needs, and prior outcomes across all four strategies. Account sync and cross-device memory remain later work and must not weaken the local-first consent model.
