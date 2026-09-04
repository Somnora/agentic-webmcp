const elements = {
  form: document.querySelector("#vacation-profile-form"),
  arrival: document.querySelector("#vacation-arrival"),
  departure: document.querySelector("#vacation-departure"),
  travelers: document.querySelector("#vacation-travelers"),
  budget: document.querySelector("#vacation-budget"),
  visited: document.querySelector("#vacation-visited"),
  memories: document.querySelector("#vacation-memories"),
  experiences: document.querySelector("#vacation-experiences"),
  avoid: document.querySelector("#vacation-avoid"),
  lodging: document.querySelector("#vacation-lodging"),
  dining: document.querySelector("#vacation-dining"),
  pace: document.querySelector("#vacation-pace"),
  novelty: document.querySelector("#vacation-novelty"),
  submit: document.querySelector("#vacation-submit"),
  requestStatus: document.querySelector("#vacation-request-status"),
  contextList: document.querySelector("#vacation-context-list"),
  contextEmpty: document.querySelector("#vacation-context-empty"),
  coverage: document.querySelector("#vacation-coverage-panel"),
  results: document.querySelector("#vacation-results"),
  resultsEmpty: document.querySelector("#vacation-results-empty"),
  webmcp: document.querySelector("#vacation-webmcp-status"),
};

function clean(value, maximum) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function values(value, maximumItems = 6) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map((item) => clean(item, 60)).filter(Boolean))].slice(0, maximumItems);
}

function textNode(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function fact({ id, kind, value, now, sensitivity = "standard", lifeStage = null }) {
  return {
    version: "1",
    id,
    subjectId: "vacation-traveler",
    kind,
    value,
    source: "user-stated",
    confidence: "confirmed",
    sensitivity,
    lifeStage,
    allowedUses: ["vacation"],
    lastConfirmedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDecision(input = {}) {
  const now = new Date().toISOString();
  const token = crypto.randomUUID().slice(0, 8);
  const arrival = clean(input.arrivalDate ?? elements.arrival.value, 10);
  const departure = clean(input.departureDate ?? elements.departure.value, 10);
  const travelers = Math.round(Number(input.travelers ?? elements.travelers.value));
  const amount = Number(input.maximumBudget ?? elements.budget.value);
  const visited = values(input.visitedPlaces ?? elements.visited.value);
  const memories = values(input.fondMemories ?? elements.memories.value);
  const experiences = values(input.likedExperiences ?? elements.experiences.value);
  const avoid = values(input.avoid ?? elements.avoid.value, 4);
  const lodging = clean(input.lodgingStyle ?? elements.lodging.value, 120);
  const dining = clean(input.diningPreference ?? elements.dining.value, 120);
  const pace = clean(input.pace ?? elements.pace.value, 80);
  const novelty = clean(input.novelty ?? elements.novelty.value, 40);
  const profileFacts = [];
  if (visited.length) profileFacts.push(fact({ id: `${token}-visited`, kind: "visited-place", value: visited, now }));
  if (memories.length) profileFacts.push(fact({ id: `${token}-memories`, kind: "fond-memory-signal", value: memories, now, sensitivity: "private", lifeStage: "childhood" }));
  if (experiences.length) profileFacts.push(fact({ id: `${token}-experiences`, kind: "liked-experience", value: experiences, now }));
  if (avoid.length) profileFacts.push(fact({ id: `${token}-avoid`, kind: "avoidance", value: avoid, now }));
  if (pace) profileFacts.push(fact({ id: `${token}-pace`, kind: "pace-preference", value: [pace], now }));
  const byKind = (kind) => profileFacts.find((item) => item.kind === kind);
  const avoidFact = byKind("avoidance");
  const memoryFact = byKind("fond-memory-signal");
  const experienceFact = byKind("liked-experience");
  const paceFact = byKind("pace-preference");
  const hardConstraints = [
    { id: "trip-location-oahu", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
    { id: "trip-date-range", kind: "date-range", label: `${arrival} through ${departure}`, value: [arrival, departure], source: "current-request", factId: null },
    { id: "trip-party-size", kind: "party-size", label: `${travelers} travelers`, value: travelers, source: "current-request", factId: null },
    ...(avoidFact ? [{ id: "trip-hard-avoid", kind: "avoid", label: "Hard dislikes", value: avoidFact.value, source: "profile", factId: avoidFact.id }] : []),
  ];
  const softPreferences = [
    ...(memoryFact ? [{ id: "trip-memory", kind: "theme", label: "Fond memory signals", value: memoryFact.value, weight: "high", source: "profile", factId: memoryFact.id }] : []),
    ...(experienceFact ? [{ id: "trip-experience", kind: "experience", label: "Liked experiences", value: experienceFact.value, weight: "high", source: "profile", factId: experienceFact.id }] : []),
    ...(lodging ? [{ id: "trip-lodging", kind: "lodging-style", label: "Lodging style", value: lodging, weight: "high", source: "current-request", factId: null }] : []),
    ...(dining ? [{ id: "trip-dining", kind: "dining", label: "Dining", value: dining, weight: "medium", source: "current-request", factId: null }] : []),
    ...(paceFact ? [{ id: "trip-pace", kind: "pace", label: "Trip pace", value: pace, weight: "high", source: "profile", factId: paceFact.id }] : []),
    { id: "trip-novelty", kind: "novelty", label: "Novelty", value: novelty, weight: "high", source: "current-request", factId: null },
  ];
  const brief = {
    version: "1",
    id: `vacation-${crypto.randomUUID()}`,
    vertical: "vacation",
    goal: "Build a source-backed short Oahu package around selected memories and experiences",
    subjectIds: ["vacation-traveler"],
    selectedFactIds: [],
    decisionOnlyFacts: profileFacts,
    hardConstraints,
    softPreferences,
    budget: { currencyCode: "USD", targetAmount: null, maximumAmount: amount.toFixed(2), includesTaxes: false, includesFees: false, contingencyPercent: 10 },
    location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
    timeWindow: { start: `${arrival}T08:00:00-10:00`, end: `${departure}T20:00:00-10:00`, timezone: "Pacific/Honolulu", flexible: false },
    output: "package",
    missingInformation: [],
    createdAt: now,
  };
  return { context: { brief, selectedFacts: [] }, view: { arrival, departure, travelers, amount, visited, memories, experiences, avoid, lodging, dining, pace, novelty } };
}

function renderContext(view, context) {
  elements.contextList.replaceChildren();
  const rows = [
    ["Storage", "Use once"],
    ["Trip", `${view.arrival} to ${view.departure} | ${view.travelers} travelers | Oahu, Hawaii`],
    ...(view.visited.length ? [["Places already visited", view.visited.join(", ")]] : []),
    ...(view.memories.length ? [["Fond memory signals", view.memories.join(", ")]] : []),
    ...(view.experiences.length ? [["Experiences that resonated", view.experiences.join(", ")]] : []),
    ...(view.avoid.length ? [["Hard dislikes", view.avoid.join(", ")]] : []),
    ["Lodging and dining", `${view.lodging || "No preference"}; ${view.dining || "No preference"}`],
    ["Pace and novelty", `${view.pace}; ${view.novelty}`],
    ["Maximum budget", `${context.brief.budget.maximumAmount} USD, with 10% planning contingency`],
  ];
  elements.contextEmpty.hidden = true;
  for (const [label, value] of rows) {
    const item = document.createElement("li");
    item.append(textNode("strong", "", label), textNode("span", "", value));
    elements.contextList.append(item);
  }
}

function renderCoverage(personalization) {
  elements.coverage.replaceChildren();
  elements.coverage.dataset.status = personalization.actionEligible ? "ready" : "attention";
  elements.coverage.append(
    textNode("strong", "", personalization.actionEligible ? "Selected trip context applied" : "More evidence is required"),
    textNode("p", "", personalization.note),
  );
  if (personalization.excludedByConstraint.length) {
    const list = document.createElement("ul");
    for (const item of personalization.excludedByConstraint) list.append(textNode("li", "", `Excluded before scoring: ${item.title} matched ${item.matchedTerms.join(", ")}.`));
    elements.coverage.append(list);
  }
  if (personalization.unsupportedConstraints.length) {
    const list = document.createElement("ul");
    for (const item of personalization.unsupportedConstraints) list.append(textNode("li", "", `${item.label}: ${item.reason}`));
    elements.coverage.append(list);
  }
  if (personalization.deferredFacts.length) {
    elements.coverage.append(textNode("p", "coverage-deferred", `Not scored: ${personalization.deferredFacts.map((item) => item.summary).join("; ")}.`));
  }
}

function sourceItem(item) {
  const row = document.createElement("li");
  const detail = document.createElement("div");
  const source = safeUrl(item.sourceUrl);
  if (source) {
    const link = document.createElement("a");
    link.href = source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    detail.append(link);
  } else {
    detail.append(textNode("strong", "", item.title));
  }
  detail.append(textNode("span", "", `${item.provider} | ${item.quantity} ${item.unitLabel} | ${item.total.amount} ${item.total.currencyCode}`));
  row.append(textNode("span", "package-category", item.category), detail);
  return row;
}

function itineraryItem(item) {
  const row = document.createElement("li");
  row.append(textNode("time", "", `Day ${item.day} | ${item.startLocal}-${item.endLocal}`));
  const detail = document.createElement("div");
  detail.append(textNode("strong", "", item.title), textNode("span", "", `${item.location} | published schedule, not a reservation`));
  row.append(detail);
  return row;
}

function totalRow(label, amount) {
  const row = document.createElement("li");
  row.append(textNode("span", "", label), textNode("strong", "", `${amount.amount} ${amount.currencyCode}`));
  return row;
}

function renderPackages(payload) {
  elements.results.replaceChildren();
  renderCoverage(payload.personalization);
  elements.resultsEmpty.hidden = payload.packages.length > 0;
  elements.resultsEmpty.textContent = payload.warning || "No complete package met the decision constraints.";
  for (const trip of payload.packages) {
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(textNode("span", "result-rank", trip.label), textNode("strong", "result-score", `${trip.score}/100`));
    const sourceList = document.createElement("ul");
    sourceList.className = "package-items";
    for (const item of trip.items) sourceList.append(sourceItem(item));
    const timeline = document.createElement("ol");
    timeline.className = "date-timeline";
    for (const item of trip.itinerary.items.filter((candidate) => candidate.status === "scheduled")) timeline.append(itineraryItem(item));
    const matches = document.createElement("ul");
    matches.className = "result-matches";
    for (const match of trip.matchedFacts) matches.append(textNode("li", "", `${match.summary}: ${match.explanation}`));
    const totals = document.createElement("ul");
    totals.className = "package-totals";
    totals.append(
      totalRow("Lodging", trip.totals.lodging),
      totalRow("Transport", trip.totals.transport),
      totalRow("Dining", trip.totals.dining),
      totalRow("Activities", trip.totals.activities),
      totalRow("Published subtotal", trip.totals.publishedSubtotal),
      totalRow("Planning contingency", trip.totals.contingency),
    );
    const unknown = document.createElement("ul");
    unknown.className = "package-unknowns";
    for (const item of trip.totals.unknownCosts) unknown.append(textNode("li", "", item));
    const footer = document.createElement("footer");
    footer.append(
      textNode("strong", "", `${trip.totals.planningRange.min.amount}-${trip.totals.planningRange.max.amount} USD planning range`),
      textNode("span", "", `Ceiling ${trip.budgetCeiling.amount} USD`),
    );
    article.append(
      header,
      textNode("h3", "", trip.title),
      textNode("p", "result-reason", `${trip.startDate} to ${trip.endDate} | ${trip.nights} nights | ${trip.travelers} travelers. ${trip.why}`),
      sourceList,
      textNode("h4", "", "Proposed activity rhythm"),
      timeline,
      matches,
      totals,
      textNode("p", "result-tradeoff", `Tradeoff: ${trip.tradeoff}`),
      textNode("p", "result-evidence", `Evidence: ${trip.evidenceConfidence}. Unknown costs remain outside the published subtotal.`),
      unknown,
      footer,
    );
    elements.results.append(article);
  }
}

async function api(path, body, signal) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The personalized vacation could not be planned.");
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function runVacation(input = {}, actor = "human") {
  const { context, view } = buildDecision(input);
  renderContext(view, context);
  elements.requestStatus.textContent = `${actor} request in progress...`;
  elements.submit.disabled = true;
  try {
    const payload = await api("/api/vacation-packages?originId=services-lab", { originId: "services-lab", decisionContext: context }, input.signal);
    renderPackages(payload);
    elements.requestStatus.textContent = payload.status === "planned"
      ? `${payload.packages.length} source-backed vacation packages built.`
      : `${payload.packages.length} packages built; some constraints need attention.`;
    return {
      status: payload.status,
      packages: payload.packages.map((trip) => ({ tier: trip.tier, score: trip.score, itemHandles: trip.itemHandles, planningRange: trip.totals.planningRange, matchedFactIds: trip.matchedFacts.map((match) => match.factId) })),
      personalization: payload.personalization,
    };
  } finally {
    elements.submit.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runVacation().catch((error) => { elements.requestStatus.textContent = `${error.code || "REQUEST_FAILED"}: ${error.message}`; });
});

async function registerWebMcpTool() {
  if (!document.modelContext?.registerTool) {
    elements.webmcp.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  await document.modelContext.registerTool({
    name: "plan_personalized_vacation",
    description: "Build value, balanced, and signature Oahu vacation packages from explicitly supplied trip memories and preferences. It updates the visible page and never saves a profile, contacts a provider, books, or pays.",
    inputSchema: {
      type: "object",
      properties: {
        arrivalDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        departureDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        maximumBudget: { type: "number", minimum: 600, maximum: 100000 },
        travelers: { type: "integer", minimum: 1, maximum: 4 },
        visitedPlaces: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        fondMemories: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        likedExperiences: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        avoid: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        lodgingStyle: { type: "string", maxLength: 120 },
        diningPreference: { type: "string", maxLength: 120 },
        pace: { type: "string", enum: ["one anchor activity per day", "balanced", "full days"] },
        novelty: { type: "string", enum: ["mostly-new", "blend", "familiar"] },
      },
      required: ["arrivalDate", "departureDate", "maximumBudget"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input, { signal } = {}) => {
      elements.arrival.value = clean(input.arrivalDate, 10);
      elements.departure.value = clean(input.departureDate, 10);
      elements.budget.value = input.maximumBudget;
      elements.travelers.value = input.travelers || 2;
      elements.visited.value = values(input.visitedPlaces).join(", ");
      elements.memories.value = values(input.fondMemories).join(", ");
      elements.experiences.value = values(input.likedExperiences).join(", ");
      elements.avoid.value = values(input.avoid, 4).join(", ");
      elements.lodging.value = clean(input.lodgingStyle || "small quiet lodging near water", 120);
      elements.dining.value = clean(input.diningPreference || "local plant-forward food", 120);
      elements.pace.value = input.pace || "one anchor activity per day";
      elements.novelty.value = input.novelty || "mostly-new";
      return runVacation({ ...input, signal }, "agent via WebMCP");
    },
  });
  elements.webmcp.textContent = "1 personalized vacation tool registered";
}

registerWebMcpTool().catch((error) => { elements.webmcp.textContent = `WebMCP registration failed: ${error.message}`; });
