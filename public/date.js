const elements = {
  form: document.querySelector("#date-profile-form"),
  day: document.querySelector("#date-day"),
  budget: document.querySelector("#date-budget"),
  yourInterests: document.querySelector("#date-your-interests"),
  partnerInterests: document.querySelector("#date-partner-interests"),
  yourAvoid: document.querySelector("#date-your-avoid"),
  partnerAvoid: document.querySelector("#date-partner-avoid"),
  previous: document.querySelector("#date-previous"),
  mood: document.querySelector("#date-mood"),
  novelty: document.querySelector("#date-novelty"),
  location: document.querySelector("#date-location"),
  submit: document.querySelector("#date-submit"),
  requestStatus: document.querySelector("#date-request-status"),
  contextList: document.querySelector("#date-context-list"),
  contextEmpty: document.querySelector("#date-context-empty"),
  coverage: document.querySelector("#date-coverage-panel"),
  results: document.querySelector("#date-results"),
  resultsEmpty: document.querySelector("#date-results-empty"),
  webmcp: document.querySelector("#date-webmcp-status"),
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

function fact({ id, subjectId, kind, value, sensitivity = "standard", lifeStage = null, now }) {
  return {
    version: "1",
    id,
    subjectId,
    kind,
    value,
    source: "user-stated",
    confidence: "confirmed",
    sensitivity,
    lifeStage,
    allowedUses: ["date"],
    lastConfirmedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDecision(input = {}) {
  const now = new Date().toISOString();
  const token = crypto.randomUUID().slice(0, 8);
  const yourSubjectId = "date-you";
  const partnerSubjectId = "date-partner";
  const yourInterests = values(input.yourInterests ?? elements.yourInterests.value);
  const partnerInterests = values(input.partnerInterests ?? elements.partnerInterests.value);
  const yourAvoid = values(input.yourAvoid ?? elements.yourAvoid.value);
  const partnerAvoid = values(input.partnerAvoid ?? elements.partnerAvoid.value);
  const previous = values(input.previousDates ?? elements.previous.value, 4);
  const profileFacts = [];
  if (yourInterests.length) profileFacts.push(fact({
    id: `${token}-you-interests`,
    subjectId: yourSubjectId,
    kind: "interest",
    value: yourInterests,
    now,
  }));
  if (partnerInterests.length) profileFacts.push(fact({
    id: `${token}-partner-interests`,
    subjectId: partnerSubjectId,
    kind: "interest",
    value: partnerInterests,
    now,
  }));
  if (yourAvoid.length) profileFacts.push(fact({
    id: `${token}-you-avoid`,
    subjectId: yourSubjectId,
    kind: "avoidance",
    value: yourAvoid,
    now,
  }));
  if (partnerAvoid.length) profileFacts.push(fact({
    id: `${token}-partner-avoid`,
    subjectId: partnerSubjectId,
    kind: "avoidance",
    value: partnerAvoid,
    now,
  }));
  if (previous.length) profileFacts.push(fact({
    id: `${token}-previous`,
    subjectId: yourSubjectId,
    kind: "previous-activity",
    value: previous,
    sensitivity: "private",
    lifeStage: "recent",
    now,
  }));

  const avoidanceFacts = profileFacts.filter((item) => item.kind === "avoidance");
  const interestFacts = profileFacts.filter((item) => item.kind === "interest");
  const day = clean(input.date ?? elements.day.value, 10);
  const amount = Number(input.maximumBudget ?? elements.budget.value);
  const mood = clean(input.desiredMood ?? elements.mood.value, 80);
  const novelty = clean(input.novelty ?? elements.novelty.value, 40);
  const hardConstraints = [
    {
      id: "date-location-oahu",
      kind: "location",
      label: "Oahu, Hawaii",
      value: "Oahu, Hawaii, US",
      source: "current-request",
      factId: null,
    },
    {
      id: "date-calendar-day",
      kind: "date-range",
      label: `Date is ${day}`,
      value: day,
      source: "current-request",
      factId: null,
    },
    {
      id: "date-party-size",
      kind: "party-size",
      label: "Two participants",
      value: 2,
      source: "current-request",
      factId: null,
    },
    ...avoidanceFacts.map((item) => ({
      id: `constraint-${item.id}`,
      kind: "avoid",
      label: item.subjectId === yourSubjectId ? "Your hard dislikes" : "Their hard dislikes",
      value: item.value,
      source: "profile",
      factId: item.id,
    })),
  ];
  const softPreferences = [
    ...interestFacts.map((item) => ({
      id: `preference-${item.id}`,
      kind: "interest",
      label: item.subjectId === yourSubjectId ? "Your interests" : "Their interests",
      value: item.value,
      weight: "high",
      source: "profile",
      factId: item.id,
    })),
    {
      id: "preference-date-mood",
      kind: "theme",
      label: "Desired mood",
      value: mood,
      weight: "medium",
      source: "current-request",
      factId: null,
    },
    {
      id: "preference-date-novelty",
      kind: "novelty",
      label: "Desired novelty",
      value: novelty,
      weight: "high",
      source: "current-request",
      factId: null,
    },
  ];
  const brief = {
    version: "1",
    id: `date-${crypto.randomUUID()}`,
    vertical: "date",
    goal: "Plan a source-backed Oahu date that balances both participants",
    subjectIds: [yourSubjectId, partnerSubjectId],
    selectedFactIds: [],
    decisionOnlyFacts: profileFacts,
    hardConstraints,
    softPreferences,
    budget: {
      currencyCode: "USD",
      targetAmount: null,
      maximumAmount: amount.toFixed(2),
      includesTaxes: false,
      includesFees: false,
      contingencyPercent: 10,
    },
    location: {
      label: "Oahu, Hawaii",
      city: null,
      region: "Oahu, Hawaii",
      countryCode: "US",
      timezone: "Pacific/Honolulu",
      flexible: false,
    },
    timeWindow: {
      start: `${day}T08:00:00-10:00`,
      end: `${day}T20:00:00-10:00`,
      timezone: "Pacific/Honolulu",
      flexible: false,
    },
    output: "package",
    missingInformation: [],
    createdAt: now,
  };
  return {
    context: { brief, selectedFacts: [] },
    view: { day, amount, mood, novelty, yourInterests, partnerInterests, yourAvoid, partnerAvoid, previous },
  };
}

function renderContext(view, context) {
  elements.contextList.replaceChildren();
  const rows = [
    ["Storage", "Use once"],
    ["Date and place", `${view.day}, Oahu, Hawaii`],
    ["Your interests", view.yourInterests.join(", ") || "Not provided"],
    ["Their interests", view.partnerInterests.join(", ") || "Not provided"],
    ...(view.yourAvoid.length ? [["Your hard dislikes", view.yourAvoid.join(", ")]] : []),
    ...(view.partnerAvoid.length ? [["Their hard dislikes", view.partnerAvoid.join(", ")]] : []),
    ...(view.previous.length ? [["Previous dates", view.previous.join(", ")]] : []),
    ["Mood and novelty", `${view.mood}; ${view.novelty}`],
    ["Maximum budget", `${context.brief.budget.maximumAmount} USD, with 10% planning contingency`],
  ];
  elements.contextEmpty.hidden = true;
  for (const [label, value] of rows) {
    const item = document.createElement("li");
    item.append(textNode("strong", "", label), textNode("span", "", value));
    elements.contextList.append(item);
  }
}

function subjectLabel(subjectId) {
  return subjectId === "date-you" ? "You" : "Partner";
}

function renderCoverage(personalization) {
  elements.coverage.replaceChildren();
  elements.coverage.dataset.status = personalization.actionEligible ? "ready" : "attention";
  elements.coverage.append(
    textNode("strong", "", personalization.actionEligible ? "Two-person context applied" : "More evidence is required"),
    textNode("p", "", personalization.note),
  );
  if (personalization.excludedByDislike.length) {
    const list = document.createElement("ul");
    for (const item of personalization.excludedByDislike) {
      list.append(textNode("li", "", `Excluded before scoring: ${item.title} matched ${item.matchedTerms.join(", ")}.`));
    }
    elements.coverage.append(list);
  }
  if (personalization.unsupportedConstraints.length) {
    const list = document.createElement("ul");
    for (const constraint of personalization.unsupportedConstraints) {
      list.append(textNode("li", "", `${constraint.label}: ${constraint.reason}`));
    }
    elements.coverage.append(list);
  }
  if (personalization.deferredFacts.length) {
    const note = personalization.deferredFacts.map((item) => `${subjectLabel(item.subjectId)}: ${item.summary}`).join("; ");
    elements.coverage.append(textNode("p", "coverage-deferred", `Not scored: ${note}.`));
  }
}

function timelineItem(item) {
  const row = document.createElement("li");
  row.append(textNode("time", "", `${item.startLocal}-${item.endLocal}`));
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
  detail.append(textNode("span", "", `${item.location} | ${item.price.amount} ${item.price.currencyCode} party total | ${item.transitionBufferMinutes} min transition allowance`));
  row.append(detail);
  return row;
}

function renderPlans(payload) {
  elements.results.replaceChildren();
  renderCoverage(payload.personalization);
  elements.resultsEmpty.hidden = payload.plans.length > 0;
  elements.resultsEmpty.textContent = payload.warning || "No complete plan met the decision constraints.";
  for (const plan of payload.plans) {
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(
      textNode("span", "result-rank", plan.label),
      textNode("strong", "result-score", `${plan.score}/100`),
    );
    const title = textNode("h3", "", plan.title);
    const balance = plan.balance === "both-participants"
      ? "Source matches for both participants"
      : plan.balance === "one-person-stretch" ? "One visible stretch" : "No direct profile match";
    const why = textNode("p", "result-reason", `${balance}. ${plan.why}`);
    const timeline = document.createElement("ol");
    timeline.className = "date-timeline";
    for (const item of plan.itinerary.items.filter((candidate) => candidate.status === "scheduled")) {
      timeline.append(timelineItem(item));
    }
    const matchList = document.createElement("ul");
    matchList.className = "result-matches";
    for (const match of plan.matchedFacts) {
      matchList.append(textNode("li", "", `${subjectLabel(match.subjectId)}: ${match.explanation}`));
    }
    const tradeoff = textNode("p", "result-tradeoff", `Tradeoff: ${plan.tradeoff}`);
    const evidence = textNode("p", "result-evidence", `Evidence: ${plan.evidenceConfidence}. Published windows are not reservations.`);
    const footer = document.createElement("footer");
    footer.append(
      textNode("strong", "", `${plan.costRange.min.amount}-${plan.costRange.max.amount} USD planning range`),
      textNode("span", "", `Ceiling ${plan.budgetCeiling.amount} USD`),
    );
    article.append(header, title, why, timeline, matchList, tradeoff, evidence, footer);
    elements.results.append(article);
  }
}

async function api(path, body, signal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The personalized date could not be planned.");
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function runDate(input = {}, actor = "human") {
  const { context, view } = buildDecision(input);
  renderContext(view, context);
  elements.requestStatus.textContent = `${actor} request in progress...`;
  elements.submit.disabled = true;
  try {
    const payload = await api("/api/date-plans?originId=services-lab", {
      originId: "services-lab",
      decisionContext: context,
    }, input.signal);
    renderPlans(payload);
    elements.requestStatus.textContent = payload.status === "planned"
      ? `${payload.plans.length} source-backed date plans built.`
      : `${payload.plans.length} plans built; some constraints need attention.`;
    return {
      status: payload.status,
      plans: payload.plans.map((plan) => ({
        tier: plan.tier,
        score: plan.score,
        itemHandles: plan.itemHandles,
        costRange: plan.costRange,
        balance: plan.balance,
        matchedFactIds: plan.matchedFacts.map((match) => match.factId),
      })),
      personalization: payload.personalization,
    };
  } finally {
    elements.submit.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runDate().catch((error) => {
    elements.requestStatus.textContent = `${error.code || "REQUEST_FAILED"}: ${error.message}`;
  });
});

async function registerWebMcpTool() {
  if (!document.modelContext?.registerTool) {
    elements.webmcp.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  await document.modelContext.registerTool({
    name: "plan_personalized_date",
    description: "Build low-cost, balanced, and special-occasion date plans from two people's explicitly supplied context and controlled service Offers. It updates the visible page and never saves a profile, contacts a provider, books, or pays.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Calendar date in YYYY-MM-DD format." },
        maximumBudget: { type: "number", minimum: 100, maximum: 2000, description: "Maximum whole-date budget in USD." },
        yourInterests: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        partnerInterests: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        yourAvoid: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        partnerAvoid: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        previousDates: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        desiredMood: { type: "string", enum: ["calm and connected", "playful and active", "creative and curious", "special and restorative"] },
        novelty: { type: "string", enum: ["mostly-new", "blend", "familiar"] },
      },
      required: ["date", "maximumBudget"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input, { signal } = {}) => {
      elements.day.value = clean(input.date, 10);
      elements.budget.value = input.maximumBudget;
      elements.yourInterests.value = values(input.yourInterests).join(", ");
      elements.partnerInterests.value = values(input.partnerInterests).join(", ");
      elements.yourAvoid.value = values(input.yourAvoid, 4).join(", ");
      elements.partnerAvoid.value = values(input.partnerAvoid, 4).join(", ");
      elements.previous.value = values(input.previousDates, 4).join(", ");
      elements.mood.value = input.desiredMood || "calm and connected";
      elements.novelty.value = input.novelty || "mostly-new";
      return runDate({ ...input, signal }, "agent via WebMCP");
    },
  });
  elements.webmcp.textContent = "1 personalized date tool registered";
}

registerWebMcpTool().catch((error) => {
  elements.webmcp.textContent = `WebMCP registration failed: ${error.message}`;
});
