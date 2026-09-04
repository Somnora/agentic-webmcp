import { deleteLocalGiftProfile, loadLocalGiftProfile, normalizeLocalGiftProfile, saveLocalGiftProfile } from "/workspace-profile.js";

const elements = {
  form: document.querySelector("#gift-profile-form"),
  query: document.querySelector("#gift-query"),
  budget: document.querySelector("#gift-budget"),
  recipient: document.querySelector("#recipient-label"),
  ageBand: document.querySelector("#recipient-age-band"),
  interests: document.querySelector("#recipient-interests"),
  memory: document.querySelector("#recipient-memory"),
  avoid: document.querySelector("#recipient-avoid"),
  persistence: document.querySelector("#profile-persistence"),
  submit: document.querySelector("#gift-submit"),
  deleteProfile: document.querySelector("#delete-profile"),
  localStatus: document.querySelector("#local-profile-status"),
  requestStatus: document.querySelector("#request-status"),
  contextList: document.querySelector("#context-list"),
  contextEmpty: document.querySelector("#context-empty"),
  coverage: document.querySelector("#coverage-panel"),
  results: document.querySelector("#gift-results"),
  resultsEmpty: document.querySelector("#results-empty"),
  webmcp: document.querySelector("#workspace-webmcp-status"),
};

let savedProfile = null;

function clean(value, maximum) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function values(value, maximumItems = 6) {
  return [...new Set(String(value ?? "").split(",").map((item) => clean(item, 60)).filter(Boolean))].slice(0, maximumItems);
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

function fact({ id, subjectId, kind, value, sensitivity = "standard", lifeStage = null, allowedUses = ["gift"], now }) {
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
    allowedUses,
    lastConfirmedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function formProfile(input = {}) {
  return normalizeLocalGiftProfile({
    id: input.id || savedProfile?.id,
    createdAt: input.createdAt || savedProfile?.createdAt,
    recipientLabel: input.recipientLabel ?? elements.recipient.value,
    ageBand: input.ageBand ?? elements.ageBand.value,
    interests: input.interests ?? values(elements.interests.value),
    memorySignal: input.memorySignal ?? elements.memory.value,
    avoid: input.avoid ?? elements.avoid.value,
  });
}

function buildDecision(profile, persistence) {
  const now = new Date().toISOString();
  const subjectId = `subject-${profile.id}`;
  const profileFacts = [];
  if (profile.interests.length) {
    profileFacts.push(fact({
      id: `fact-${profile.id}-interests`,
      subjectId,
      kind: "interest",
      value: profile.interests,
      now,
    }));
  }
  if (profile.memorySignal) {
    profileFacts.push(fact({
      id: `fact-${profile.id}-memory`,
      subjectId,
      kind: "fond-memory-signal",
      value: profile.memorySignal,
      sensitivity: "private",
      now,
    }));
  }
  if (profile.avoid) {
    profileFacts.push(fact({
      id: `fact-${profile.id}-avoid`,
      subjectId,
      kind: "avoidance",
      value: profile.avoid,
      now,
    }));
  }
  const saved = persistence === "saved-on-device";
  const selectedFactIds = saved ? profileFacts.map((item) => item.id) : [];
  const hardConstraints = [];
  if (profile.ageBand !== "not-provided") {
    hardConstraints.push({
      id: "constraint-age-suitability",
      kind: "age-suitability",
      label: `Suitable for age band: ${profile.ageBand}`,
      value: profile.ageBand,
      source: "current-request",
      factId: null,
    });
  }
  const avoidance = profileFacts.find((item) => item.kind === "avoidance");
  if (avoidance) {
    hardConstraints.push({
      id: "constraint-avoid",
      kind: "avoid",
      label: "Avoid recipient dislikes or duplicates",
      value: avoidance.value,
      source: "profile",
      factId: avoidance.id,
    });
  }
  const softPreferences = profileFacts
    .filter((item) => item.kind === "interest" || item.kind === "fond-memory-signal")
    .map((item) => ({
      id: `preference-${item.id}`,
      kind: item.kind === "interest" ? "interest" : "experience",
      label: item.kind === "interest" ? "Recipient interests" : "Meaningful experience signal",
      value: item.value,
      weight: "high",
      source: "profile",
      factId: item.id,
    }));
  const amount = Number(elements.budget.value);
  const budget = Number.isFinite(amount) && amount >= 25
    ? {
      currencyCode: "USD",
      targetAmount: null,
      maximumAmount: amount.toFixed(2),
      includesTaxes: null,
      includesFees: true,
      contingencyPercent: 0,
    }
    : null;
  const brief = {
    version: "1",
    id: `decision-${crypto.randomUUID()}`,
    vertical: "gift",
    goal: clean(elements.query.value, 80),
    subjectIds: [subjectId],
    selectedFactIds,
    decisionOnlyFacts: saved ? [] : profileFacts,
    hardConstraints,
    softPreferences,
    budget,
    location: null,
    timeWindow: null,
    output: "shortlist",
    missingInformation: [],
    createdAt: now,
  };
  return { brief, selectedFacts: saved ? profileFacts : [] };
}

function renderContext(profile, context, persistence) {
  elements.contextList.replaceChildren();
  const facts = [...context.selectedFacts, ...context.brief.decisionOnlyFacts];
  const rows = [
    ["Recipient", profile.recipientLabel],
    ["Storage", persistence === "saved-on-device" ? "Saved on this device" : "Use once"],
    ...facts.map((item) => [item.kind.replaceAll("-", " "), Array.isArray(item.value) ? item.value.join(", ") : String(item.value)]),
    ...(profile.ageBand === "not-provided" ? [] : [["age band", profile.ageBand]]),
    ...(context.brief.budget ? [["maximum budget", `${context.brief.budget.maximumAmount} USD`]] : []),
  ];
  elements.contextEmpty.hidden = rows.length > 0;
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
    textNode("strong", "", personalization.actionEligible ? "Profile context applied" : "More evidence is required"),
    textNode("p", "", personalization.note),
  );
  if (personalization.unsupportedConstraints.length) {
    const list = document.createElement("ul");
    for (const constraint of personalization.unsupportedConstraints) {
      list.append(textNode("li", "", `${constraint.label}: ${constraint.reason}`));
    }
    elements.coverage.append(list);
  }
  if (personalization.deferredFacts.length) {
    const note = personalization.deferredFacts.map((item) => `${item.summary}: ${item.reason}`).join(" ");
    elements.coverage.append(textNode("p", "coverage-deferred", `Not scored yet: ${note}`));
  }
}

function renderResults(payload) {
  elements.results.replaceChildren();
  renderCoverage(payload.personalization);
  elements.resultsEmpty.hidden = payload.recommendations.length > 0;
  elements.resultsEmpty.textContent = payload.warning || "No recommendation met the decision constraints.";
  for (const recommendation of payload.recommendations) {
    const offer = payload.offers.find((candidate) => candidate.handle === recommendation.handle);
    if (!offer) continue;
    const article = document.createElement("article");
    const heading = document.createElement("header");
    heading.append(
      textNode("span", "result-rank", `${recommendation.rank}. ${recommendation.label}`),
      textNode("strong", "result-score", `${recommendation.score}/100`),
    );
    const title = textNode("h3", "", offer.title);
    const price = offer.marketplace?.deliveredPrice;
    const summary = textNode("p", "result-summary", recommendation.summary);
    const reason = textNode("p", "result-reason", recommendation.why);
    const tradeoff = textNode("p", "result-tradeoff", `Tradeoff: ${recommendation.tradeoff}`);
    const evidence = textNode("p", "result-evidence", `Evidence: ${recommendation.evidenceConfidence}`);
    const matchList = document.createElement("ul");
    matchList.className = "result-matches";
    for (const match of recommendation.matchedFacts) {
      matchList.append(textNode("li", "", `Profile match: ${match.explanation}`));
    }
    const footer = document.createElement("footer");
    if (price) footer.append(textNode("strong", "", `${price.amount} ${price.currencyCode} delivered`));
    const url = safeUrl(offer.url);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Inspect source";
      footer.append(link);
    }
    article.append(heading, title, summary, reason, tradeoff, evidence, matchList, footer);
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
    const error = new Error(payload.error || "The gift recommendation could not be completed.");
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function setForm(profile) {
  elements.recipient.value = profile.recipientLabel;
  elements.ageBand.value = profile.ageBand;
  elements.interests.value = profile.interests.join(", ");
  elements.memory.value = profile.memorySignal;
  elements.avoid.value = profile.avoid;
}

async function runGift(input = {}, allowSave = false, actor = "human") {
  const profile = formProfile(input);
  const persistence = allowSave && input.persistence === "saved-on-device"
    ? "saved-on-device"
    : allowSave ? elements.persistence.value : "decision-only";
  if (persistence === "saved-on-device") {
    savedProfile = await saveLocalGiftProfile(profile);
    elements.localStatus.textContent = `Saved ${savedProfile.recipientLabel} on this device.`;
    elements.deleteProfile.hidden = false;
  }
  const context = buildDecision(profile, persistence);
  renderContext(profile, context, persistence);
  elements.requestStatus.textContent = `${actor} request in progress...`;
  elements.submit.disabled = true;
  try {
    const payload = await api("/api/recommendations?originId=catalog-lab", {
      originId: "catalog-lab",
      query: clean(input.query ?? elements.query.value, 80),
      maxResults: 3,
      decisionContext: context,
    }, input.signal);
    renderResults(payload);
    elements.requestStatus.textContent = payload.personalization.actionEligible
      ? `${payload.recommendations.length} source-backed options ranked.`
      : "The decision stopped because a hard constraint is not supported by current Offer evidence.";
    return {
      status: payload.personalization.actionEligible ? "ranked" : "needs-attention",
      recommendations: payload.recommendations.map((item) => ({
        handle: item.handle,
        rank: item.rank,
        score: item.score,
        matchedFactIds: item.matchedFacts.map((match) => match.factId),
      })),
      personalization: payload.personalization,
    };
  } finally {
    elements.submit.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runGift({ persistence: elements.persistence.value }, true).catch((error) => {
    elements.requestStatus.textContent = `${error.code || "REQUEST_FAILED"}: ${error.message}`;
  });
});

elements.deleteProfile.addEventListener("click", () => {
  deleteLocalGiftProfile()
    .then(() => {
      savedProfile = null;
      elements.persistence.value = "decision-only";
      elements.deleteProfile.hidden = true;
      elements.localStatus.textContent = "Saved recipient profile deleted from this device.";
    })
    .catch((error) => {
      elements.localStatus.textContent = error.message;
    });
});

loadLocalGiftProfile()
  .then((profile) => {
    if (!profile) return;
    savedProfile = profile;
    setForm(profile);
    elements.persistence.value = "saved-on-device";
    elements.deleteProfile.hidden = false;
    elements.localStatus.textContent = `Loaded ${profile.recipientLabel} from this device.`;
  })
  .catch(() => {
    elements.localStatus.textContent = "Use once is available. On-device saving is unavailable in this browser.";
  });

async function registerWebMcpTool() {
  if (!document.modelContext?.registerTool) {
    elements.webmcp.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  await document.modelContext.registerTool({
    name: "recommend_gift",
    description: "Rank controlled marketplace Offers for a gift using only the recipient context supplied in this call. It updates the visible page and never saves a profile, creates an order, or pays.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 80, description: "The gift category or item to search for." },
        recipientLabel: { type: "string", maxLength: 60, description: "A non-identifying label such as my nephew." },
        ageBand: { type: "string", enum: ["child", "teen", "adult", "older-adult", "not-provided"], description: "Optional age band used only when source suitability evidence exists." },
        interests: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 }, description: "Recipient interests used for source-text matching." },
        memorySignal: { type: "string", maxLength: 120, description: "Optional compact experience or memory signal." },
        avoid: { type: "string", maxLength: 80, description: "Recipient dislike, duplicate, or source-backed term to avoid." },
        maxDeliveredPrice: { type: "number", minimum: 25, maximum: 100000, description: "Hard maximum delivered price in USD." },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input, { signal } = {}) => {
      elements.query.value = clean(input.query, 80);
      elements.recipient.value = clean(input.recipientLabel, 60) || "Someone else";
      elements.ageBand.value = input.ageBand || "not-provided";
      elements.interests.value = Array.isArray(input.interests) ? input.interests.join(", ") : "";
      elements.memory.value = clean(input.memorySignal, 120);
      elements.avoid.value = clean(input.avoid, 80);
      elements.budget.value = input.maxDeliveredPrice ?? "";
      elements.persistence.value = "decision-only";
      return runGift({
        ...input,
        persistence: "decision-only",
        signal,
      }, false, "agent via WebMCP");
    },
  });
  elements.webmcp.textContent = "1 personalized WebMCP tool registered";
}

registerWebMcpTool().catch((error) => {
  elements.webmcp.textContent = `WebMCP registration failed: ${error.message}`;
});
