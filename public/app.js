import { registerAgenticTools } from "./tools.js";
import { createPresenter } from "./presenter.js";
import { createDecisionDossier, dossierFilename } from "./dossier.js";

function emptyDecision() {
  return {
    goal: null,
    rubric: null,
    rankedOptions: [],
    refinement: null,
    evidence: {},
    comparedHandles: [],
    selection: null,
    humanDecision: null,
    itinerary: null,
  };
}

const state = {
  originId: "catalog-lab",
  origin: null,
  origins: [],
  selected: new Set(),
  offers: [],
  recommendations: new Map(),
  activity: [],
  proposal: null,
  receipts: [],
  returnFocus: null,
  conversionComplete: new Set(),
  conversionActive: null,
  activeAdapter: null,
  decision: emptyDecision(),
  recommendationRequest: null,
};

let presenter;

const elements = {
  status: document.querySelector("#webmcp-status"),
  statusCluster: document.querySelector(".status-cluster"),
  source: document.querySelector("#source-badge"),
  message: document.querySelector("#catalog-message"),
  grid: document.querySelector("#product-grid"),
  activity: document.querySelector("#activity-list"),
  result: document.querySelector("#result-panel"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  recommendForm: document.querySelector("#recommend-form"),
  recommendInput: document.querySelector("#recommend-input"),
  recommendBudget: document.querySelector("#recommend-budget"),
  recommendShoppingFor: document.querySelector("#recommend-shopping-for"),
  recommendMode: document.querySelector("#recommend-mode"),
  recommendTaste: document.querySelector("#recommend-taste"),
  recommendMustHave: document.querySelector("#recommend-must-have"),
  recommendAvoid: document.querySelector("#recommend-avoid"),
  recommendPriorities: [...document.querySelectorAll('input[name="recommend-priority"]')],
  refinementPanel: document.querySelector("#refinement-panel"),
  refinementKicker: document.querySelector("#refinement-kicker"),
  refinementQuestion: document.querySelector("#refinement-question"),
  refinementExplanation: document.querySelector("#refinement-explanation"),
  refinementChoices: document.querySelector("#refinement-choices"),
  compareButton: document.querySelector("#compare-button"),
  selectionCount: document.querySelector("#selection-count"),
  selectionHelp: document.querySelector("#selection-help"),
  briefForm: document.querySelector("#brief-form"),
  briefGoal: document.querySelector("#brief-goal"),
  briefButton: document.querySelector("#brief-button"),
  itineraryForm: document.querySelector("#itinerary-form"),
  itineraryGoal: document.querySelector("#itinerary-goal"),
  itineraryDate: document.querySelector("#itinerary-date"),
  itineraryDays: document.querySelector("#itinerary-days"),
  itineraryParty: document.querySelector("#itinerary-party"),
  itineraryBudget: document.querySelector("#itinerary-budget"),
  itineraryPace: document.querySelector("#itinerary-pace"),
  itineraryStart: document.querySelector("#itinerary-start"),
  itineraryEnd: document.querySelector("#itinerary-end"),
  itineraryButton: document.querySelector("#itinerary-button"),
  itineraryView: document.querySelector("#itinerary-view"),
  itineraryTitle: document.querySelector("#itinerary-title"),
  itineraryStatus: document.querySelector("#itinerary-status"),
  itinerarySummary: document.querySelector("#itinerary-summary"),
  itineraryTimeline: document.querySelector("#itinerary-timeline"),
  itineraryConflicts: document.querySelector("#itinerary-conflicts"),
  itineraryMarkdown: document.querySelector("#itinerary-markdown"),
  itineraryWarning: document.querySelector("#itinerary-warning"),
  originSelect: document.querySelector("#origin-select"),
  originMeta: document.querySelector("#origin-meta"),
  originHealth: document.querySelector("#origin-health"),
  originDiagnostics: document.querySelector("#origin-diagnostics"),
  originDiagnosticsStatus: document.querySelector("#origin-diagnostics-status"),
  originDiagnosticsBody: document.querySelector("#origin-diagnostics-body"),
  interpolateForm: document.querySelector("#interpolate-form"),
  interpolatePath: document.querySelector("#interpolate-path"),
  interpolateView: document.querySelector("#interpolate-view"),
  interpolateCanonical: document.querySelector("#interpolate-canonical"),
  interpolateMarkdown: document.querySelector("#interpolate-markdown"),
  interpolateOffer: document.querySelector("#interpolate-offer"),
  interpolatePageStatus: document.querySelector("#interpolate-page-status"),
  interpolateOfferStatus: document.querySelector("#interpolate-offer-status"),
  interpolateProvenance: document.querySelector("#interpolate-provenance"),
  confirmPanel: document.querySelector("#confirm-panel"),
  confirmCopy: document.querySelector("#confirm-copy"),
  confirmCart: document.querySelector("#confirm-cart"),
  dismissCart: document.querySelector("#dismiss-cart"),
  cartEmpty: document.querySelector("#cart-empty"),
  cartList: document.querySelector("#cart-list"),
  cartPanel: document.querySelector("#cart-panel"),
  decisionBoundaryLabel: document.querySelector("#decision-boundary-label"),
  downloadDossier: document.querySelector("#download-dossier"),
  deploymentId: document.querySelector("#deployment-id"),
  promptButtons: [...document.querySelectorAll("[data-query]")],
  conversionStatus: document.querySelector("#conversion-path-status"),
  conversionStages: [...document.querySelectorAll("[data-conversion-stage]")],
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderConversionPath(status) {
  for (const element of elements.conversionStages) {
    const stage = element.dataset.conversionStage;
    const active = stage === state.conversionActive;
    element.dataset.state = active ? "active" : state.conversionComplete.has(stage) ? "complete" : "idle";
    if (active) element.setAttribute("aria-current", "step"); else element.removeAttribute("aria-current");
  }
  if (status) elements.conversionStatus.textContent = status;
}

function updateConversionPath(tool) {
  const complete = (...stages) => stages.forEach((stage) => state.conversionComplete.add(stage));
  if (tool === "tool_error") {
    renderConversionPath("The latest tool call needs attention");
    return;
  }
  if (tool === "list_origins" || tool === "select_origin") {
    complete("source");
    state.conversionActive = "source";
    renderConversionPath("Exact host and adapter verified");
    return;
  }
  if (tool === "interpolate_page") {
    complete("source", "markdown", "offer", "tool");
    state.conversionActive = "tool";
    renderConversionPath("Page converted into Markdown and a normalized Offer");
    return;
  }
  if (["search_products", "find_best_options", "get_product", "compare_products", "create_catalog_brief", "create_activity_itinerary"].includes(tool)) {
    complete("source", "offer", "tool");
    state.conversionActive = "tool";
    renderConversionPath("Source-grounded result visible to agent and human");
    return;
  }
  if (tool === "propose_add_to_cart") {
    complete("source", "offer", "tool");
    state.conversionActive = "human";
    renderConversionPath("Agent stopped for human approval");
    return;
  }
  if (tool === "human_approval_button") {
    complete("human");
    state.conversionActive = "human";
    renderConversionPath("Human approval recorded | payment remains with merchant");
    return;
  }
  if (tool === "human_dismiss_review") {
    state.conversionActive = "human";
    renderConversionPath("Human dismissed the proposed handoff");
  }
}

function price(offer) {
  const min = offer.priceRange.min;
  const max = offer.priceRange.max;
  return min.amount === max.amount
    ? `${min.amount} ${min.currencyCode}`
    : `${min.amount}-${max.amount} ${min.currencyCode}`;
}

function currentHandoff(offer) {
  const policy = offer?.handoff;
  if (!policy || policy.eligible !== true) {
    return { eligible: false, reason: policy?.reason || "policy-unavailable", freshUntil: policy?.freshUntil || null };
  }
  const freshUntil = Date.parse(policy.freshUntil || "");
  if (!Number.isFinite(freshUntil) || freshUntil <= Date.now()) {
    return { eligible: false, reason: "source-stale", freshUntil: policy.freshUntil || null };
  }
  return { eligible: true, reason: "eligible", freshUntil: policy.freshUntil };
}

function handoffReason(reason) {
  const labels = {
    eligible: "live and fresh",
    "source-not-live": "fallback source",
    "source-stale": "source data expired",
    "source-timestamp-invalid": "source time invalid",
    unavailable: "listing unavailable",
    "service-booking-not-enabled": "service booking not enabled",
    "evidence-conflict": "source evidence conflicts",
    "policy-unavailable": "eligibility unknown",
  };
  return labels[reason] || "not eligible";
}

function suggestedActions(actions, offers) {
  const unique = [...new Set(actions)];
  return offers.some((offer) => currentHandoff(offer).eligible)
    ? [...unique, "propose_add_to_cart"]
    : unique;
}

function compactListingOffer(offer) {
  const verification = offer.provenance?.verification;
  return {
    handle: offer.handle,
    title: offer.title,
    price: price(offer),
    available: offer.constraints.available,
    handoff: {
      eligible: offer.handoff.eligible,
      reason: offer.handoff.reason,
    },
    evidence: verification ? { state: verification.state, label: verification.label } : { state: "single-source" },
    ...(offer.marketplace ? {
      marketplace: {
        condition: offer.marketplace.condition,
        deliveredPrice: `${offer.marketplace.deliveredPrice.amount} ${offer.marketplace.deliveredPrice.currencyCode}`,
        sellerConfidence: `${offer.marketplace.seller.positiveFeedbackPercent}% positive`,
        returns: offer.marketplace.returns.accepted ? `${offer.marketplace.returns.windowDays} days` : "not accepted",
      },
    } : {}),
    ...(offer.service ? {
      service: {
        provider: offer.service.provider.displayName,
        location: `${offer.service.location.city}, ${offer.service.location.countryCode}`,
        durationMinutes: offer.service.durationMinutes,
        priceBasis: offer.service.priceBasis,
        timezone: offer.service.scheduling.timezone,
      },
    } : {}),
  };
}

function compactOffer(offer, withVariants = false) {
  const summary = {
    ...compactListingOffer(offer),
    description: offer.description.slice(0, 100),
    adapter: offer.source.adapter,
    live: offer.source.live,
    fetchedAt: offer.source.fetchedAt,
    handoff: {
      eligible: offer.handoff.eligible,
      reason: offer.handoff.reason,
      freshUntil: offer.handoff.freshUntil,
    },
    sourceFields: Object.keys(offer.provenance).filter((field) => field !== "verification"),
  };
  if (withVariants) {
    summary.variants = offer.variants.slice(0, 5).map((variant) => ({
      title: variant.title,
      price: `${variant.price.amount} ${variant.price.currencyCode}`,
      available: variant.available,
    }));
  }
  return summary;
}

function compactOrigin(origin) {
  return {
    id: origin.id,
    mode: origin.mode,
    vertical: origin.vertical,
    displayName: origin.displayName,
    hostname: origin.hostname,
    adapter: origin.adapter,
    fallbackAdapters: origin.fallbackAdapters,
    offerPathPrefix: origin.offerPathPrefix,
    authorization: origin.authorization.status,
    handoffPolicy: origin.capabilities.merchantHandoff,
  };
}

function boundedJson(value) {
  let output = JSON.stringify(value);
  if (output.length <= 1450) return output;
  if (value.offer) {
    value.markdown = typeof value.markdown === "string" ? value.markdown.slice(0, 240) : value.markdown;
    if (Array.isArray(value.offer.variants)) value.offer.variants = value.offer.variants.slice(0, 2);
    if (Array.isArray(value.offer.sourceFields)) value.offer.sourceFields = value.offer.sourceFields.slice(0, 6);
    output = JSON.stringify(value);
  }
  if (Array.isArray(value.offers)) {
    while (output.length > 1450 && value.offers.length > 1) {
      value.offers.pop();
      value.truncated = true;
      output = JSON.stringify(value);
    }
  }
  if (Array.isArray(value.recommendations)) {
    while (output.length > 1450 && value.recommendations.length > 1) {
      value.recommendations.pop();
      value.truncated = true;
      output = JSON.stringify(value);
    }
  }
  if (output.length > 1450) {
    return JSON.stringify({
      originId: state.originId,
      truncated: true,
      message: "The full result is visible in the shared workspace.",
    });
  }
  return output;
}

function compactCatalog(payload, withVariants = false) {
  return boundedJson({
    origin: {
      id: payload.origin.id,
      authorization: payload.origin.authorization.status,
    },
    source: payload.source,
    live: payload.live,
    offers: payload.offers.map((offer) => withVariants ? compactOffer(offer, true) : compactListingOffer(offer)),
    suggestedNextActions: payload.suggestedNextActions,
    ...(payload.warning ? { warning: payload.warning.slice(0, 180) } : {}),
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json();
  const correlationId = response.headers.get("X-Agentic-Correlation-Id");
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with HTTP ${response.status}.`);
    error.code = payload.code;
    error.retryable = payload.retryable === true;
    error.reason = payload.reason;
    error.correlationId = payload.correlationId || correlationId;
    throw error;
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload) && correlationId && !payload.correlationId) {
    payload.correlationId = correlationId;
  }
  return payload;
}

function originQuery() {
  return `originId=${encodeURIComponent(state.originId)}`;
}

function nextSaturdayDate() {
  const date = new Date();
  const offset = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateOrigin(origin, live, source) {
  if (origin) {
    state.origin = origin;
    state.originId = origin.id;
    elements.originSelect.value = origin.id;
  }
  if (!state.origin) return;
  const servicesMode = state.origin.vertical === "services";
  elements.recommendForm.hidden = servicesMode;
  elements.briefForm.hidden = servicesMode;
  elements.itineraryForm.hidden = !servicesMode;
  elements.cartPanel.hidden = servicesMode;
  elements.decisionBoundaryLabel.textContent = servicesMode ? "Booking remains outside Agentic" : "Human approval required";
  if (servicesMode && !elements.itineraryDate.value) elements.itineraryDate.value = nextSaturdayDate();
  const mode = live === undefined ? "status pending" : live ? "live" : "fallback";
  const sourceMode = state.origin.mode === "controlled-demo" ? "controlled demo" : "merchant";
  const authorization = state.origin.authorization.status.replaceAll("-", " ");
  const activeSource = source || state.origin.adapter;
  elements.originMeta.textContent = `${state.origin.displayName} | ${state.origin.hostname} | ${sourceMode} | ${authorization} | ${state.origin.adapter} with ${state.origin.fallbackAdapters.join(", ")} fallback | ${mode}`;
  elements.source.textContent = `${live === undefined ? "PENDING" : live ? state.origin.mode === "controlled-demo" ? "CONTROLLED LIVE" : "LIVE" : "FALLBACK"} | ${activeSource}`;
  elements.source.classList.toggle("fallback", live === false);
  elements.source.classList.remove("research-only");
  if (origin?.demo) {
    elements.promptButtons.forEach((button, index) => {
      const query = origin.demo.queries[index];
      if (!query) return;
      button.dataset.query = query;
      button.textContent = index === 0 ? `Find ${query}` : `Search ${query}`;
    });
    elements.searchInput.placeholder = `Try ${origin.demo.queries.join(", ")}...`;
    elements.recommendInput.value = origin.demo.queries[0];
    elements.recommendBudget.value = origin.vertical === "marketplace" ? "900" : "";
    elements.interpolatePath.value = origin.healthPath;
    elements.briefGoal.value = origin.demo.briefGoal;
    elements.itineraryGoal.value = origin.demo.briefGoal;
  }
}

function updateSource(payload) {
  updateOrigin(payload.origin, payload.live, payload.source);
  state.activeAdapter = payload.source || state.activeAdapter;
  const offers = payload.offers ?? (payload.offer ? [payload.offer] : []);
  const ready = offers.filter((offer) => currentHandoff(offer).eligible).length;
  const count = offers.length;
  elements.source.textContent = `${elements.source.textContent} | ${ready > 0 ? "HANDOFF READY" : "RESEARCH ONLY"}`;
  elements.source.classList.toggle("research-only", ready === 0 && payload.live !== false);
  const policy = state.origin?.vertical === "services"
    ? "Service booking is disabled. Eligible activities can be assembled into a planning-only itinerary."
    : ready > 0
    ? `${ready} offer${ready === 1 ? " is" : "s are"} live, fresh, and eligible for handoff.`
    : "No offer is currently eligible for merchant handoff.";
  elements.message.textContent = payload.warning || `${count} offer result${count === 1 ? "" : "s"}. ${policy} External origin content is treated as untrusted.`;
}

async function loadOriginHealth(signal) {
  elements.originHealth.textContent = "Checking adapter and page access...";
  elements.originHealth.className = "origin-health";
  try {
    const health = await api(`/api/origins/health?${originQuery()}`, { signal });
    const page = health.page.live ? "page live" : "page unavailable";
    const handoff = health.handoff.eligible ? "handoff ready" : `research only: ${handoffReason(health.handoff.reason)}`;
    elements.originHealth.textContent = `${health.status} | catalog ${health.catalog.adapter} | ${page} | ${handoff} | checked ${new Date(health.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    elements.originHealth.classList.add(health.status === "live" ? "live" : "fallback");
  } catch (error) {
    elements.originHealth.textContent = `health check unavailable | ${error instanceof Error ? error.message : "unknown error"}`;
    elements.originHealth.classList.add("fallback");
  }
}

function renderOriginDiagnostics(diagnostics) {
  elements.originDiagnostics.dataset.status = diagnostics.status;
  const adapter = diagnostics.activeAdapter || "no active adapter";
  elements.originDiagnosticsStatus.textContent = `${diagnostics.status} | ${adapter}`;
  const facts = node("div", "origin-diagnostics-facts");
  const verification = diagnostics.verification?.label || "Verification unavailable";
  const correlation = diagnostics.correlationId ? diagnostics.correlationId.slice(0, 8) : "unavailable";
  facts.append(
    node("span", "", `Evidence: ${verification}`),
    node("span", "", `Trace: ${correlation}`),
    node("span", "", `Timeout: ${diagnostics.policy.timeoutMs} ms`),
    node("span", "", `Failure: ${diagnostics.failureReason || "none"}`),
  );
  const attempts = node("div", "origin-attempts");
  for (const attempt of diagnostics.attempts || []) {
    const outcome = attempt.outcome === "success" ? `${attempt.durationMs} ms` : attempt.failureReason || "failed";
    const item = node("div", "origin-attempt");
    item.append(node("strong", "", attempt.adapter), node("span", "", `${attempt.operation} | ${outcome}`));
    attempts.append(item);
  }
  if (!attempts.childElementCount) attempts.append(node("div", "origin-attempt", "No adapter attempt completed."));
  elements.originDiagnosticsBody.replaceChildren(facts, attempts);
}

async function loadOriginDiagnostics(signal) {
  elements.originDiagnostics.dataset.status = "checking";
  elements.originDiagnosticsStatus.textContent = "Checking...";
  try {
    renderOriginDiagnostics(await api(`/api/origins/diagnostics?${originQuery()}`, { signal }));
  } catch (error) {
    renderOriginDiagnostics({
      status: "failed",
      activeAdapter: null,
      correlationId: error?.correlationId,
      failureReason: error?.reason || "unknown",
      verification: null,
      policy: { timeoutMs: state.origin?.policy?.upstreamTimeoutMs || "unknown" },
      attempts: [],
    });
  }
}

async function loadDeploymentIdentity() {
  try {
    const health = await api("/health");
    const commit = health.deployment.commit === "local" ? "local" : health.deployment.commit.slice(0, 8);
    const deployedAt = health.deployment.deployedAt ? new Date(health.deployment.deployedAt).toLocaleString() : "local runtime";
    elements.deploymentId.textContent = `commit ${commit} | deployed ${deployedAt}`;
  } catch {
    elements.deploymentId.textContent = "deployment identity unavailable";
  }
}

function parseResult(resultText) {
  try {
    return JSON.parse(resultText);
  } catch {
    return { message: resultText };
  }
}

function resultFact(label, value) {
  const wrapper = node("div", "result-fact");
  wrapper.append(node("span", "", label), node("strong", "", String(value)));
  return wrapper;
}

function moneyLabel(value) {
  if (!value || typeof value !== "object") return "Not supplied";
  return `${value.amount} ${value.currencyCode}`;
}

function offerResultList(offers) {
  const list = node("ul", "result-list");
  for (const offer of offers.slice(0, 4)) {
    const item = node("li");
    const title = node("strong", "", offer.title || offer.handle || "Untitled offer");
    const details = [
      offer.price,
      offer.marketplace?.deliveredPrice,
      offer.marketplace?.condition,
      offer.service?.location,
      offer.service?.durationMinutes ? `${offer.service.durationMinutes} minutes` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    const handoff = offer.handoff?.eligible ? "Handoff ready" : `Research only: ${handoffReason(offer.handoff?.reason)}`;
    item.append(title, node("span", "", [details || (offer.available ? "Available" : "Availability not supplied"), handoff].join(" | ")));
    list.append(item);
  }
  return list;
}

function recommendationResultList(recommendations, factorOrder = []) {
  const list = node("ol", "result-list ranked");
  for (const recommendation of recommendations.slice(0, 4)) {
    const item = node("li");
    const title = node("strong", "", `${recommendation.label || `Option ${recommendation.rank}`} | ${recommendation.score}/100`);
    const reason = recommendation.why || recommendation.handle;
    const tradeoff = recommendation.tradeoff ? `Tradeoff: ${recommendation.tradeoff}` : "";
    const confidenceValue = recommendation.evidenceConfidence || recommendation.evidence;
    const confidence = confidenceValue ? `Evidence: ${confidenceValue}` : "";
    const factorText = Array.isArray(recommendation.scores)
      ? recommendation.scores.map((score, index) => `${factorOrder[index] || index + 1} ${score}`).join(" | ")
      : recommendation.factors ? Object.entries(recommendation.factors).map(([name, score]) => `${name} ${score}`).join(" | ") : "";
    item.append(title, node("span", "", reason), node("span", "", [tradeoff, confidence].filter(Boolean).join(" | ")), node("span", "", factorText));
    list.append(item);
  }
  return list;
}

function appendGenericFacts(container, payload) {
  const entries = Object.entries(payload).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 5);
  if (entries.length === 0) {
    container.append(node("p", "", "The compact result is available in the raw JSON below."));
    return;
  }
  const facts = node("div", "result-facts");
  for (const [label, value] of entries) facts.append(resultFact(label.replaceAll(/([A-Z])/g, " $1"), value));
  container.append(facts);
}

function renderAgentResult(tool, actor, resultText, displayPayload) {
  const rawPayload = parseResult(resultText);
  const payload = displayPayload || rawPayload;
  const heading = node("div", "result-heading");
  const title = node("div");
  title.append(node("span", "kicker", "Agent result"), node("code", "result-tool", tool));
  const status = node("span", `result-status${tool === "tool_error" ? " attention" : ""}`, tool === "tool_error" ? "Needs attention" : "Source grounded");
  heading.append(title, status);

  const meta = node("p", "result-meta", `${actor} | ${state.originId}`);
  const content = node("div", "result-content");

  if (Array.isArray(payload.origins)) {
    content.append(node("p", "result-lead", `${payload.origins.length} allowlisted origins are available.`));
    const list = node("ul", "result-list");
    for (const origin of payload.origins) {
      const item = node("li");
      item.append(node("strong", "", origin.displayName || origin.id), node("span", "", `${origin.vertical || "offers"} | ${origin.hostname} | ${origin.adapter}`));
      list.append(item);
    }
    content.append(list);
  } else if (payload.selected) {
    content.append(
      node("p", "result-lead", `${payload.selected.displayName || payload.selected.id} is now the active origin.`),
      resultFact("Exact host", payload.selected.hostname),
    );
  } else if (Array.isArray(payload.recommendations)) {
    const refinementLead = payload.refinement?.status === "needs-clarification"
      ? " The leading options have competing strengths, so one human preference is requested."
      : payload.refinement?.status === "resolved" ? ` ${payload.refinement.explanation}` : "";
    content.append(
      node("p", "result-lead", `${payload.recommendations.length} options ranked with a deterministic evidence rubric.${refinementLead}`),
      recommendationResultList(payload.recommendations, payload.factorOrder),
    );
  } else if (payload.canonicalUrl && payload.offer) {
    content.append(node("p", "result-lead", payload.offer.evidence?.label || "One allowlisted page is now available as Markdown and a normalized Offer."));
    const facts = node("div", "result-facts");
    facts.append(
      resultFact("Page", payload.pageLive ? "Live" : "Unavailable"),
      resultFact("Offer", payload.live ? "Live" : "Labeled fallback"),
      resultFact("Title", payload.offer.title || payload.offer.handle),
    );
    content.append(facts, node("p", "result-url", payload.canonicalUrl));
  } else if (Array.isArray(payload.offers)) {
    content.append(
      node(
        "p",
        "result-lead",
        payload.truncated
          ? `${payload.offers.length} normalized offer${payload.offers.length === 1 ? "" : "s"} shown in the compact response. The full result remains visible in the workspace.`
          : `${payload.offers.length} normalized offer${payload.offers.length === 1 ? "" : "s"} returned from the selected source.`,
      ),
      offerResultList(payload.offers),
    );
  } else if (payload.brief) {
    content.append(node("p", "result-lead", "A compact decision brief was created from selected source facts."), node("pre", "result-brief", payload.brief));
  } else if (payload.itinerary) {
    const scheduled = payload.itinerary.items?.filter((item) => item.status === "scheduled").length || 0;
    const needsAttention = payload.itinerary.planStatus === "needs-attention";
    content.append(node("p", "result-lead", needsAttention
      ? "The planning-only itinerary exposed constraints that need a human decision."
      : "A constraint-aware, planning-only itinerary was assembled from source-grounded service Offers."));
    const facts = node("div", "result-facts");
    facts.append(
      resultFact("Plan", needsAttention ? "Needs attention" : "Ready for review"),
      resultFact("Destination", payload.itinerary.destination?.label || payload.itinerary.destination),
      resultFact("Scheduled", scheduled),
      resultFact("Published total", moneyLabel(payload.itinerary.publishedPriceTotal || payload.itinerary.total)),
    );
    content.append(facts);
    if (payload.itinerary.conflicts?.length) {
      content.append(node("p", "result-brief", `${payload.itinerary.conflicts.length} constraint${payload.itinerary.conflicts.length === 1 ? "" : "s"} need attention. Review the visible itinerary for details.`));
    }
  } else if (payload.status === "awaiting_human_confirmation") {
    content.append(node("p", "result-lead", "The agent prepared a purchase handoff and stopped for human approval."));
    const facts = node("div", "result-facts");
    facts.append(resultFact("Status", "Awaiting human"), resultFact("Total", moneyLabel(payload.total)), resultFact("Cart changed", "No"));
    content.append(facts);
  } else if (payload.status === "in_cart") {
    content.append(node("p", "result-lead", "The human approved this selection for merchant handoff."));
    const facts = node("div", "result-facts");
    facts.append(resultFact("Status", "Approved"), resultFact("Total", moneyLabel(payload.total)), resultFact("Order created", "No"));
    content.append(facts);
  } else {
    appendGenericFacts(content, payload);
  }

  const raw = node("details", "result-raw");
  raw.append(node("summary", "", "Raw JSON"), node("pre", "", JSON.stringify(rawPayload, null, 2)));
  elements.result.replaceChildren(heading, meta, content, raw);
}

function recordActivity(tool, args, actor, resultText, displayPayload) {
  state.activity.unshift({ tool, args, actor, originId: state.originId, time: new Date(), result: resultText });
  state.activity = state.activity.slice(0, 20);
  elements.activity.replaceChildren();
  for (const item of state.activity.slice(0, 7)) {
    const row = node("li", "activity-item");
    const header = node("header");
    header.append(
      node("code", "", item.tool),
      node("time", "", item.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })),
    );
    row.append(header, node("span", "activity-origin", `${item.actor} | ${item.originId}`), node("p", "", JSON.stringify(item.args)));
    elements.activity.append(row);
  }
  updateConversionPath(tool);
  renderAgentResult(tool, actor, resultText, displayPayload);
  elements.downloadDossier.disabled = state.activity.length === 0;
  presenter?.toolEvent(tool, args, actor);
}

function updateSelection() {
  const count = state.selected.size;
  const servicesMode = state.origin?.vertical === "services";
  elements.selectionCount.textContent = `${count} ${servicesMode ? "service" : "listing"}${count === 1 ? "" : "s"} selected`;
  elements.selectionHelp.textContent = servicesMode
    ? "Select one to four activities for an itinerary, or two to four for comparison."
    : "Select two to four listings for a grounded comparison.";
  elements.compareButton.disabled = count < 2 || count > 4;
  elements.briefButton.disabled = count < 1 || count > 4;
  elements.itineraryButton.disabled = state.origin?.vertical !== "services" || count < 1 || count > 4;
}

function hideInterpolate() {
  elements.interpolateView.hidden = true;
}

function hideItinerary() {
  elements.itineraryView.hidden = true;
}

function renderItinerary(itinerary) {
  const needsAttention = itinerary.planStatus === "needs-attention";
  elements.itineraryTitle.textContent = `${itinerary.destination.region} activities arranged around your constraints`;
  elements.itineraryStatus.textContent = needsAttention ? "Needs attention" : "Ready for review";
  elements.itineraryStatus.classList.toggle("attention", needsAttention);
  elements.itinerarySummary.replaceChildren(
    resultFact("Destination", itinerary.destination.label),
    resultFact("Dates", itinerary.date ? `${itinerary.date} | ${itinerary.constraints.days} day${itinerary.constraints.days === 1 ? "" : "s"}` : "Date needed"),
    resultFact("Party and pace", `${itinerary.partySize} | ${itinerary.constraints.pace}`),
    resultFact("Planned total", moneyLabel(itinerary.publishedPriceTotal)),
    resultFact("Budget remaining", itinerary.budgetRemaining ? moneyLabel(itinerary.budgetRemaining) : "No budget set"),
  );
  elements.itineraryTimeline.replaceChildren();
  for (const day of itinerary.days) {
    const card = node("article", "itinerary-day");
    const header = node("header");
    header.append(node("strong", "", `Day ${day.day} | ${day.weekday}`), node("span", "", day.date));
    card.append(header);
    const scheduled = itinerary.items.filter((item) => item.status === "scheduled" && item.day === day.day);
    if (!scheduled.length) {
      card.append(node("p", "itinerary-empty", "No selected activity fits this day."));
    } else {
      const list = node("ol", "itinerary-day-list");
      for (const item of scheduled) {
        const row = node("li");
        const detail = node("div", "itinerary-activity");
        const buffer = item.transitionBufferMinutes > 0 ? ` | ${item.transitionBufferMinutes} minute planning buffer` : "";
        detail.append(
          node("strong", "", item.title),
          node("span", "", `${item.provider} | ${item.location}`),
          node("span", "", `${item.durationMinutes} minutes${buffer} | ${item.evidence}`),
        );
        const source = document.createElement("a");
        source.href = item.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Canonical source";
        detail.append(source);
        row.append(
          node("span", "itinerary-time", `${item.startLocal}-${item.endLocal}`),
          detail,
          node("span", "itinerary-price", `${item.price.amount} ${item.price.currencyCode}`),
        );
        list.append(row);
      }
      card.append(list);
    }
    elements.itineraryTimeline.append(card);
  }
  const conflicts = itinerary.conflicts || [];
  elements.itineraryConflicts.hidden = conflicts.length === 0;
  elements.itineraryConflicts.replaceChildren();
  if (conflicts.length) {
    const list = node("ul");
    for (const conflict of conflicts) list.append(node("li", "", conflict.message));
    elements.itineraryConflicts.append(node("strong", "", `${conflicts.length} constraint${conflicts.length === 1 ? "" : "s"} need attention`), list);
  }
  elements.itineraryMarkdown.textContent = itinerary.markdown;
  elements.itineraryWarning.textContent = itinerary.warnings.join(" ");
  elements.itineraryView.hidden = false;
}

function hideRefinement() {
  elements.refinementPanel.hidden = true;
  elements.refinementPanel.classList.remove("resolved");
  elements.refinementChoices.replaceChildren();
}

function refinementExplanation(refinement) {
  let explanation = refinement.explanation;
  for (const option of state.decision.rankedOptions) {
    explanation = explanation.replaceAll(option.handle, option.title);
  }
  return explanation;
}

function renderRefinement(refinement) {
  if (!refinement || refinement.status === "not-needed") {
    hideRefinement();
    return;
  }
  elements.refinementPanel.hidden = false;
  elements.refinementPanel.classList.toggle("resolved", refinement.status === "resolved");
  elements.refinementKicker.textContent = refinement.status === "resolved" ? "REFINEMENT APPLIED" : "DECISION CHECKPOINT";
  elements.refinementQuestion.textContent = refinement.status === "resolved"
    ? refinement.selectedChoice?.label || "Human priority applied"
    : refinement.question;
  elements.refinementExplanation.textContent = refinementExplanation(refinement);
  elements.refinementChoices.replaceChildren();
  if (refinement.status === "needs-clarification") {
    for (const choice of refinement.choices) {
      const button = node("button", "refinement-choice");
      button.type = "button";
      button.append(node("strong", "", choice.label), node("span", "", choice.impact));
      button.addEventListener("click", () => {
        if (!state.recommendationRequest) return;
        for (const option of elements.refinementChoices.querySelectorAll("button")) option.disabled = true;
        runRecommend({ ...state.recommendationRequest, refinementChoice: choice.id }, "human refinement")
          .then(() => {
            elements.refinementPanel.focus();
            presenter?.humanRefined();
          })
          .catch((error) => {
            renderRefinement(refinement);
            showError(error);
          });
      });
      elements.refinementChoices.append(button);
    }
  } else {
    const reconsider = node("button", "refinement-choice", "Reconsider this priority");
    reconsider.type = "button";
    reconsider.addEventListener("click", () => {
      if (!state.recommendationRequest) return;
      runRecommend({ ...state.recommendationRequest, refinementChoice: null }, "human refinement")
        .then(() => elements.refinementPanel.focus())
        .catch(showError);
    });
    elements.refinementChoices.append(reconsider);
  }
  elements.refinementPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  elements.refinementPanel.focus({ preventScroll: true });
}

function marketplaceFacts(offer) {
  if (!offer.marketplace) return null;
  const market = offer.marketplace;
  return [
    ["Condition", market.condition.replaceAll("-", " ")],
    ["Delivered", `${market.deliveredPrice.amount} ${market.deliveredPrice.currencyCode}`],
    ["Seller", `${market.seller.positiveFeedbackPercent.toFixed(1)}% positive`],
    ["Returns", market.returns.accepted ? `${market.returns.windowDays} days` : "Final sale"],
  ];
}

function serviceFacts(offer) {
  if (!offer.service) return null;
  const service = offer.service;
  return [
    ["Provider", service.provider.displayName],
    ["Location", `${service.location.city}, ${service.location.region}`],
    ["Duration", `${service.durationMinutes} minutes`],
    ["Price basis", service.priceBasis.replaceAll("-", " ")],
    ["Party size", `${service.partySize.min} to ${service.partySize.max}`],
    ["Published days", service.scheduling.windows.map((window) => window.weekday.slice(0, 3)).join(", ")],
    ["Cancellation", service.cancellation.refundable ? `${service.cancellation.windowHours} hour window` : "Not refundable"],
    ["Itinerary", service.itineraryEligible ? "Eligible" : "Not eligible"],
  ];
}

function provenanceLabel(offer) {
  const verification = offer.provenance?.verification;
  if (verification?.label) {
    const detail = verification.state === "verified" && verification.verifiedFields?.length
      ? ` | ${verification.verifiedFields.join(", ")}`
      : verification.state === "conflict" && verification.conflictFields?.length
        ? ` | review ${verification.conflictFields.join(", ")}`
        : "";
    return `${verification.label}${detail}`;
  }
  return `Source evidence: ${offer.source.adapter}`;
}

function handoffLine(offer) {
  const policy = currentHandoff(offer);
  const label = policy.eligible
    ? `Handoff ready | fresh until ${new Date(policy.freshUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : `Research only | ${handoffReason(policy.reason)}`;
  return node("p", `handoff-line ${policy.eligible ? "eligible" : "ineligible"}`, label);
}

function renderOffers(offers) {
  state.offers = offers;
  for (const handle of [...state.selected]) {
    if (!offers.some((offer) => offer.handle === handle)) state.selected.delete(handle);
  }
  elements.grid.replaceChildren();
  if (offers.length === 0) {
    elements.grid.append(node("p", "catalog-message", "No offers matched. Try a broader catalog term."));
    updateSelection();
    return;
  }
  for (const offer of offers) {
    const card = node("article", `product-card${state.selected.has(offer.handle) ? " selected" : ""}`);
    const recommendation = state.recommendations.get(offer.handle);
    const available = offer.variants.filter((variant) => variant.available).length;
    const meta = node("div", "product-meta");
    meta.append(
      node("span", "", offer.marketplace ? `${offer.marketplace.deliveredPrice.amount} ${offer.marketplace.deliveredPrice.currencyCode} delivered` : price(offer)),
      node("span", "", recommendation ? `Score ${recommendation.score}` : `${available}/${offer.variants.length} available`),
    );
    const actions = node("div", "product-actions");
    const label = node("label", "select-label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(offer.handle);
    checkbox.setAttribute("aria-label", `Select ${offer.title} for comparison`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(offer.handle); else state.selected.delete(offer.handle);
      card.classList.toggle("selected", checkbox.checked);
      updateSelection();
    });
    label.append(checkbox, document.createTextNode("Select"));
    const inspect = node("button", "", "Inspect");
    inspect.type = "button";
    inspect.addEventListener("click", () => runGetProduct({ handle: offer.handle }, "human preview").catch(showError));
    const propose = node("button", "", "Prepare review");
    propose.type = "button";
    const handoff = currentHandoff(offer);
    propose.disabled = !handoff.eligible;
    propose.title = handoff.eligible ? "Prepare a human-reviewed merchant handoff" : `Unavailable for handoff: ${handoffReason(handoff.reason)}`;
    propose.addEventListener("click", () => runProposeCart({ handle: offer.handle, quantity: 1 }, "human preview").catch(showError));
    actions.append(label, inspect);
    if (!offer.service) actions.append(propose);
    if (recommendation) {
      const rank = node("div", "recommendation-rank");
      rank.append(node("span", "", `${recommendation.label} | Option ${recommendation.rank}`), node("strong", "", `${recommendation.score}/100`));
      card.append(rank);
    }
    card.append(node("h3", "", offer.title), meta);
    const facts = marketplaceFacts(offer) || serviceFacts(offer);
    if (facts) {
      const evidence = node("dl", "evidence-grid");
      for (const [labelText, value] of facts) {
        evidence.append(node("dt", "", labelText), node("dd", "", value));
      }
      card.append(evidence);
    }
    card.append(node("p", "", recommendation?.summary || offer.description || "No origin description supplied."));
    if (recommendation) {
      const decision = node("div", "recommendation-copy");
      decision.append(
        node("strong", "", recommendation.why),
        node("span", "", `Tradeoff: ${recommendation.tradeoff}`),
        node("span", "", `Evidence: ${recommendation.evidenceConfidence}`),
        node("span", "", `Factors: ${Object.entries(recommendation.factors).map(([name, score]) => `${name.replaceAll(/([A-Z])/g, " $1").toLocaleLowerCase()} ${score}`).join(" | ")}`),
      );
      card.append(decision);
    }
    card.append(node("p", "provenance-line", provenanceLabel(offer)), handoffLine(offer), actions);
    elements.grid.append(card);
  }
  updateSelection();
}

function renderComparison(offers) {
  elements.grid.replaceChildren();
  for (const offer of offers) {
    const recommendation = state.recommendations.get(offer.handle);
    const card = node("article", "product-card selected");
    card.append(
      node("span", "kicker", recommendation ? `${recommendation.label} | ${recommendation.score}/100` : "Comparison"),
      node("h3", "", offer.title),
      node("div", "product-meta", offer.marketplace ? `${offer.marketplace.deliveredPrice.amount} ${offer.marketplace.deliveredPrice.currencyCode} delivered` : price(offer)),
      node("p", "", recommendation?.summary || offer.description),
      ...(recommendation ? [node("p", "", `${recommendation.why} Tradeoff: ${recommendation.tradeoff}`)] : []),
      node("p", "provenance-line", provenanceLabel(offer)),
      handoffLine(offer),
    );
    const facts = marketplaceFacts(offer) || serviceFacts(offer);
    if (facts) {
      const evidence = node("dl", "evidence-grid");
      for (const [labelText, value] of facts) evidence.append(node("dt", "", labelText), node("dd", "", value));
      card.append(evidence);
    }
    elements.grid.append(card);
  }
}

async function runListOrigins(_args = {}, actor = "agent", signal, record = true) {
  const payload = await api("/api/origins", { signal });
  state.origins = payload.origins;
  state.originId = payload.origins.some((origin) => origin.id === state.originId) ? state.originId : payload.defaultOriginId;
  elements.originSelect.replaceChildren();
  for (const origin of payload.origins) {
    const option = node("option", "", `${origin.displayName} | ${origin.hostname}`);
    option.value = origin.id;
    elements.originSelect.append(option);
  }
  updateOrigin(payload.origins.find((origin) => origin.id === state.originId) || payload.origins[0]);
  const output = boundedJson({
    manifestVersion: payload.manifestVersion,
    defaultOriginId: payload.defaultOriginId,
    origins: payload.origins.map(compactOrigin),
    suggestedNextActions: ["select_origin", "search_products"],
  });
  if (record) recordActivity("list_origins", {}, actor, output);
  return output;
}

async function runSelectOrigin({ originId }, actor = "agent", signal) {
  const payload = await api("/api/origins/select", { method: "POST", signal, body: JSON.stringify({ originId }) });
  state.selected.clear();
  state.recommendations.clear();
  state.decision = emptyDecision();
  state.recommendationRequest = null;
  state.activeAdapter = null;
  updateOrigin(payload.selected);
  updateSelection();
  hideInterpolate();
  hideItinerary();
  hideRefinement();
  await Promise.all([loadOriginHealth(signal), loadOriginDiagnostics(signal)]);
  const output = boundedJson({ selected: compactOrigin(payload.selected), sessionless: payload.sessionless, suggestedNextActions: ["search_products", "interpolate_page"] });
  recordActivity("select_origin", { originId }, actor, output);
  return output;
}

async function runSearch({ query = "", maxResults = 6 }, actor = "agent", signal) {
  const payload = await api(`/api/catalog?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(maxResults)}&${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  hideItinerary();
  state.recommendations.clear();
  state.recommendationRequest = null;
  hideRefinement();
  renderOffers(payload.offers);
  payload.suggestedNextActions = suggestedActions(
    state.origin?.vertical === "services" ? ["get_product", "compare_products", "create_activity_itinerary"] : ["get_product", "compare_products"],
    payload.offers,
  );
  const output = compactCatalog(payload);
  recordActivity("search_products", { query, maxResults }, actor, output);
  return output;
}

async function runRecommend({
  query,
  maxDeliveredPrice,
  maxResults = 4,
  shoppingFor = "self",
  mode = "decide",
  priorities = [],
  tasteContext = "",
  mustHave = "",
  avoid = "",
  refinementChoice = null,
}, actor = "agent", signal) {
  elements.recommendInput.value = query;
  elements.recommendBudget.value = maxDeliveredPrice ?? "";
  elements.recommendShoppingFor.value = shoppingFor;
  elements.recommendMode.value = mode;
  elements.recommendTaste.value = tasteContext;
  elements.recommendMustHave.value = mustHave;
  elements.recommendAvoid.value = avoid;
  for (const input of elements.recommendPriorities) input.checked = priorities.includes(input.value);
  updatePriorityAvailability();
  const request = { originId: state.originId, query, maxDeliveredPrice, maxResults, shoppingFor, mode, priorities, tasteContext, mustHave, avoid, refinementChoice };
  state.recommendationRequest = request;
  const payload = await api(`/api/recommendations?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify(request),
  });
  updateSource(payload);
  hideInterpolate();
  state.recommendations = new Map(payload.recommendations.map((item) => [item.handle, item]));
  const offersByHandle = new Map(payload.offers.map((offer) => [offer.handle, offer]));
  state.decision.goal = payload.goal;
  state.decision.rubric = payload.rubric;
  state.decision.refinement = payload.refinement;
  state.decision.rankedOptions = payload.recommendations.map((item) => {
    const offer = offersByHandle.get(item.handle);
    return {
      ...item,
      title: offer?.title || item.handle,
      url: offer?.url,
      deliveredPrice: offer?.marketplace?.deliveredPrice || offer?.priceRange?.min,
    };
  });
  renderOffers(payload.offers);
  renderRefinement(payload.refinement);
  const factorOrder = Object.keys(payload.rubric);
  const output = boundedJson({
    originId: payload.origin.id,
    goal: {
      query: payload.goal.query,
      budget: payload.goal.maxDeliveredPrice,
      for: payload.goal.intent.shoppingFor,
      mode: payload.goal.intent.mode,
      priorities: payload.goal.intent.priorities,
      ...(payload.goal.intent.tasteContext ? { taste: payload.goal.intent.tasteContext } : {}),
    },
    scoring: { order: ["match", "taste", "condition", "price", "seller", "returns", "delivery"], weights: Object.values(payload.rubric) },
    refinement: payload.refinement.status === "needs-clarification"
      ? { status: payload.refinement.status, question: payload.refinement.question, choices: payload.refinement.choices.map(({ id, label }) => ({ id, label })) }
      : { status: payload.refinement.status, selectedChoice: payload.refinement.selectedChoice?.id, changed: payload.refinement.changed, explanation: payload.refinement.explanation },
    recommendations: payload.recommendations.map((item) => ({
      rank: item.rank,
      label: item.label,
      handle: item.handle,
      score: item.score,
      why: item.why,
      tradeoff: item.tradeoff,
      evidence: item.evidenceConfidence.startsWith("Verified") ? "verified" : item.evidenceConfidence.startsWith("Single source") ? "single-source" : "conflict",
      scores: Object.values(item.factors),
    })),
  });
  recordActivity("find_best_options", request, actor, output, { ...payload, factorOrder });
  return output;
}

async function runGetProduct({ handle }, actor = "agent", signal) {
  const payload = await api(`/api/offers/${encodeURIComponent(handle)}?${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  renderOffers(payload.offers);
  payload.suggestedNextActions = suggestedActions(["interpolate_page", "compare_products"], payload.offers);
  const output = compactCatalog(payload, true);
  recordActivity("get_product", { handle }, actor, output);
  return output;
}

async function runCompare({ handles }, actor = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/compare?handles=${encodeURIComponent(normalized.join(","))}&${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  state.selected.clear();
  for (const handle of normalized) state.selected.add(handle);
  renderComparison(payload.offers);
  updateSelection();
  state.decision.comparedHandles = payload.offers.map((offer) => offer.handle);
  payload.suggestedNextActions = suggestedActions(state.origin?.vertical === "services" ? ["create_activity_itinerary"] : ["create_catalog_brief"], payload.offers);
  const output = compactCatalog(payload);
  recordActivity("compare_products", { handles: normalized }, actor, output);
  return output;
}

function normalizeInterpolateInput(input) {
  const value = input.trim();
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== state.origin.hostname || url.search || url.hash) {
    throw new Error("Offer URL must match the selected HTTPS origin exactly.");
  }
  return url.pathname;
}

async function runInterpolate({ path }, actor = "agent", signal) {
  const normalizedPath = normalizeInterpolateInput(path);
  const payload = await api(`/api/interpolate?path=${encodeURIComponent(normalizedPath)}&${originQuery()}`, { signal });
  updateSource({ ...payload, offers: [payload.offer] });
  renderOffers([payload.offer]);
  elements.interpolateCanonical.textContent = payload.canonicalUrl;
  elements.interpolateMarkdown.textContent = payload.markdown;
  elements.interpolateOffer.textContent = JSON.stringify(compactOffer(payload.offer, true), null, 2);
  elements.interpolatePageStatus.textContent = payload.pageLive ? "LIVE PAGE MARKDOWN" : "PAGE UNAVAILABLE";
  const interpolateHandoff = currentHandoff(payload.offer);
  const verification = payload.offer.provenance?.verification;
  state.decision.evidence[payload.offer.handle] = {
    handle: payload.offer.handle,
    title: payload.offer.title,
    url: payload.offer.url,
    state: verification?.state || "single-source",
    label: verification?.label || `Single source: ${payload.offer.source.adapter}`,
    checkedAt: verification?.checkedAt || payload.offer.source.fetchedAt,
    conflicts: verification?.conflictFields || [],
  };
  elements.interpolateOfferStatus.textContent = interpolateHandoff.eligible
    ? `${verification?.state === "verified" ? "EVIDENCE VERIFIED" : "LIVE OFFER"} | HANDOFF READY`
    : `RESEARCH ONLY | ${handoffReason(interpolateHandoff.reason).toLocaleUpperCase()}`;
  elements.interpolateProvenance.textContent = provenanceLabel(payload.offer);
  elements.interpolateView.hidden = false;
  hideItinerary();
  elements.interpolateView.scrollIntoView({ block: "center" });
  elements.interpolateView.focus({ preventScroll: true });
  const output = boundedJson({
    originId: payload.origin.id,
    canonicalUrl: payload.canonicalUrl,
    live: payload.live,
    pageLive: payload.pageLive,
    offer: compactOffer(payload.offer),
    verification: payload.offer.provenance?.verification ? {
      state: payload.offer.provenance.verification.state,
      label: payload.offer.provenance.verification.label,
      verifiedFields: payload.offer.provenance.verification.verifiedFields,
      conflictFields: payload.offer.provenance.verification.conflictFields,
    } : undefined,
    markdown: payload.markdown.slice(0, 240),
    suggestedNextActions: suggestedActions(["compare_products"], [payload.offer]),
    ...(payload.warning ? { warning: payload.warning.slice(0, 180) } : {}),
  });
  recordActivity("interpolate_page", { path: normalizedPath }, actor, output, {
    canonicalUrl: payload.canonicalUrl,
    pageLive: payload.pageLive,
    live: payload.live,
    offer: { title: payload.offer.title, handle: payload.offer.handle, handoff: payload.offer.handoff, evidence: payload.offer.provenance?.verification },
  });
  return output;
}

async function runBrief({ goal, handles }, actor = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/brief?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify({ originId: state.originId, goal, handles: normalized }),
  });
  updateSource(payload);
  hideInterpolate();
  state.selected.clear();
  for (const handle of normalized) state.selected.add(handle);
  renderComparison(payload.offers);
  updateSelection();
  for (const offer of payload.offers) {
    const verification = offer.provenance?.verification;
    state.decision.evidence[offer.handle] = {
      handle: offer.handle,
      title: offer.title,
      url: offer.url,
      state: verification?.state || "single-source",
      label: verification?.label || `Single source: ${offer.source.adapter}`,
      checkedAt: verification?.checkedAt || offer.source.fetchedAt,
      conflicts: verification?.conflictFields || [],
    };
  }
  const output = boundedJson({ brief: payload.brief.slice(0, 1100), suggestedNextActions: suggestedActions([], payload.offers) });
  recordActivity("create_catalog_brief", { goal, handles: normalized }, actor, output);
  return output;
}

async function runItinerary({
  goal,
  handles,
  date,
  days = 1,
  partySize = 1,
  budget,
  pace = "balanced",
  earliestStart = "08:00",
  latestEnd = "19:00",
}, actor = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/itinerary?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify({ originId: state.originId, goal, handles: normalized, date, days, partySize, budget, pace, earliestStart, latestEnd }),
  });
  updateSource(payload);
  hideInterpolate();
  state.selected.clear();
  for (const handle of normalized) state.selected.add(handle);
  renderComparison(payload.offers);
  updateSelection();
  for (const offer of payload.offers) {
    const verification = offer.provenance?.verification;
    state.decision.evidence[offer.handle] = {
      handle: offer.handle,
      title: offer.title,
      url: offer.url,
      state: verification?.state || "single-source",
      label: verification?.label || `Single source: ${offer.source.adapter}`,
      checkedAt: verification?.checkedAt || offer.source.fetchedAt,
      conflicts: verification?.conflictFields || [],
    };
  }
  state.decision.goal = {
    type: "activity-itinerary",
    text: payload.itinerary.goal,
    date: payload.itinerary.date,
    partySize: payload.itinerary.partySize,
    constraints: payload.itinerary.constraints,
  };
  state.decision.itinerary = payload.itinerary;
  state.decision.comparedHandles = payload.itinerary.items.map((item) => item.handle);
  renderItinerary(payload.itinerary);
  elements.itineraryView.scrollIntoView({ block: "center" });
  elements.itineraryView.focus({ preventScroll: true });
  const output = boundedJson({
    itinerary: {
      status: payload.itinerary.status,
      planStatus: payload.itinerary.planStatus,
      goal: payload.itinerary.goal,
      destination: payload.itinerary.destination.label,
      date: payload.itinerary.date,
      days: payload.itinerary.constraints.days,
      partySize: payload.itinerary.partySize,
      pace: payload.itinerary.constraints.pace,
      budget: payload.itinerary.constraints.budget,
      total: payload.itinerary.publishedPriceTotal,
      remaining: payload.itinerary.budgetRemaining,
      items: payload.itinerary.items.map((item) => ({
        handle: item.handle,
        day: item.day,
        time: item.startLocal ? `${item.startLocal}-${item.endLocal}` : null,
        status: item.status,
        price: item.price,
        sourceUrl: item.sourceUrl,
      })),
      conflicts: payload.itinerary.conflicts.map((conflict) => ({ code: conflict.code, handles: conflict.handles })),
    },
    suggestedNextActions: ["review_source_urls", "contact_providers_outside_agentic"],
  });
  recordActivity("create_activity_itinerary", { goal, handles: normalized, date, days, partySize, budget, pace, earliestStart, latestEnd }, actor, output, { itinerary: payload.itinerary });
  return output;
}

async function runProposeCart({ handle, variantTitle, quantity = 1 }, actor = "agent", signal) {
  if (actor === "human preview") state.returnFocus = document.activeElement;
  const payload = await api(`/api/cart/propose?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify({ originId: state.originId, handle, variantTitle, quantity }),
  });
  updateSource(payload);
  state.proposal = payload.quote;
  const line = payload.quote.lines[0];
  const evidence = payload.offers[0].marketplace;
  const proposedOffer = payload.offers[0];
  state.decision.selection = {
    title: proposedOffer.title,
    handle: line.handle,
    quantity: line.quantity,
    total: payload.quote.total,
    url: line.sourceUrl || proposedOffer.url,
    evidence: state.decision.evidence[line.handle]?.label || proposedOffer.provenance?.verification?.label || `Single source: ${proposedOffer.source.adapter}`,
  };
  state.decision.humanDecision = null;
  const sellerText = line.seller ? ` from ${line.seller.replace(/[.]+$/, "")}` : "";
  elements.confirmCopy.textContent = `${payload.offers[0].title}, ${evidence?.condition?.replaceAll("-", " ") || line.variantTitle}, ${payload.quote.total.amount} ${payload.quote.total.currencyCode} delivered${sellerText}. Nothing has been ordered or charged.`;
  elements.confirmPanel.hidden = false;
  elements.confirmPanel.scrollIntoView({ block: "center" });
  elements.confirmPanel.focus({ preventScroll: true });
  const output = boundedJson({
    quoteId: payload.quote.quoteId,
    originId: payload.quote.originId,
    status: payload.confirmation.status,
    line,
    total: payload.quote.total,
    cartChanged: false,
    suggestedNextActions: ["human_confirm_button", "human_dismiss_button"],
  });
  recordActivity("propose_add_to_cart", { handle, variantTitle, quantity }, actor, output);
  return output;
}

function renderCart() {
  elements.cartList.replaceChildren();
  elements.cartEmpty.hidden = state.receipts.length > 0;
  for (const receipt of state.receipts) {
    const line = receipt.lines[0];
    const row = node("li", "cart-line");
    row.append(node("span", "", `${line.handle} | ${receipt.total.amount} ${receipt.total.currencyCode} | approved for merchant handoff`));
    const sourceLink = node("a", "", "Open source listing");
    sourceLink.href = line.sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    row.append(sourceLink);
    elements.cartList.append(row);
  }
}

async function confirmCart() {
  if (!state.proposal) return;
  const quote = state.proposal;
  const line = quote.lines[0];
  const payload = await api(`/api/cart/commit?${originQuery()}`, {
    method: "POST",
    headers: { "X-Agentic-Human-Confirm": "true" },
    body: JSON.stringify({
      originId: quote.originId,
      quote,
      handle: line.handle,
      variantId: line.variantId,
      quantity: line.quantity,
    }),
  });
  state.receipts.unshift(payload.receipt);
  state.decision.humanDecision = { status: "approved for merchant handoff", recordedAt: payload.receipt.confirmedAt };
  state.proposal = null;
  elements.confirmPanel.hidden = true;
  renderCart();
  recordActivity("human_approval_button", { quoteId: quote.quoteId }, "human button", boundedJson(payload.receipt));
  elements.cartPanel.focus();
  presenter?.humanConfirmed();
}

function dismissCart() {
  if (!state.proposal) return;
  const quoteId = state.proposal.quoteId;
  state.proposal = null;
  state.decision.humanDecision = { status: "dismissed", recordedAt: new Date().toISOString() };
  elements.confirmPanel.hidden = true;
  recordActivity("human_dismiss_review", { quoteId }, "human button", JSON.stringify({ quoteId, status: "dismissed", cartChanged: false }));
  if (state.returnFocus instanceof HTMLElement) state.returnFocus.focus();
  state.returnFocus = null;
}

function decisionSnapshot() {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    origin: state.origin ? {
      id: state.origin.id,
      displayName: state.origin.displayName,
      hostname: state.origin.hostname,
      authorization: state.origin.authorization.status,
      adapter: state.origin.adapter,
    } : null,
    activeAdapter: state.activeAdapter,
    goal: state.decision.goal,
    rubric: state.decision.rubric,
    refinement: state.decision.refinement,
    rankedOptions: state.decision.rankedOptions,
    evidence: Object.values(state.decision.evidence),
    comparedHandles: state.decision.comparedHandles,
    selection: state.decision.selection,
    humanDecision: state.decision.humanDecision,
    itinerary: state.decision.itinerary,
    activity: state.activity.filter((item) => item.originId === state.originId).slice().reverse().map((item) => ({
      time: item.time.toISOString(),
      tool: item.tool,
      actor: item.actor,
      originId: item.originId,
    })),
  };
}

function downloadDecisionDossier() {
  const snapshot = decisionSnapshot();
  const markdown = createDecisionDossier(snapshot);
  const objectUrl = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = dossierFilename(state.originId, snapshot.generatedAt);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  elements.downloadDossier.textContent = "Dossier downloaded";
  setTimeout(() => { elements.downloadDossier.textContent = "Download dossier"; }, 1600);
}

async function registerWebMcpTools() {
  if (!document.modelContext?.registerTool) {
    elements.status.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  const tools = await registerAgenticTools(document.modelContext, {
    listOrigins: (args, signal) => runListOrigins(args, "agent via WebMCP", signal),
    selectOrigin: (args, signal) => runSelectOrigin(args, "agent via WebMCP", signal),
    search: (args, signal) => runSearch(args, "agent via WebMCP", signal),
    recommend: (args, signal) => runRecommend(args, "agent via WebMCP", signal),
    get: (args, signal) => runGetProduct(args, "agent via WebMCP", signal),
    compare: (args, signal) => runCompare(args, "agent via WebMCP", signal),
    interpolate: (args, signal) => runInterpolate(args, "agent via WebMCP", signal),
    brief: (args, signal) => runBrief(args, "agent via WebMCP", signal),
    itinerary: (args, signal) => runItinerary(args, "agent via WebMCP", signal),
    proposeCart: (args, signal) => runProposeCart(args, "agent via WebMCP", signal),
  });
  elements.status.textContent = `${tools.length} WebMCP tools registered`;
  elements.statusCluster.classList.add("ready");
}

elements.originSelect.addEventListener("change", () => {
  runSelectOrigin({ originId: elements.originSelect.value }, "human preview")
    .then(() => runSearch({ query: state.origin?.vertical === "services" ? "Oahu experience" : "", maxResults: 6 }, "human preview"))
    .catch(showError);
});

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch({ query: elements.searchInput.value, maxResults: 6 }, "human preview").catch(showError);
});

function selectedPriorities() {
  return elements.recommendPriorities.filter((input) => input.checked).map((input) => input.value);
}

function updatePriorityAvailability() {
  const atLimit = selectedPriorities().length >= 3;
  for (const input of elements.recommendPriorities) input.disabled = atLimit && !input.checked;
}

for (const input of elements.recommendPriorities) input.addEventListener("change", updatePriorityAvailability);

elements.recommendForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runRecommend({
    query: elements.recommendInput.value,
    maxDeliveredPrice: elements.recommendBudget.value,
    maxResults: 4,
    shoppingFor: elements.recommendShoppingFor.value,
    mode: elements.recommendMode.value,
    priorities: selectedPriorities(),
    tasteContext: elements.recommendTaste.value,
    mustHave: elements.recommendMustHave.value,
    avoid: elements.recommendAvoid.value,
  }, "human preview").catch(showError);
});

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.searchInput.value = button.dataset.query;
    runSearch({ query: button.dataset.query, maxResults: 6 }, "human preview").catch(showError);
  });
});

elements.compareButton.addEventListener("click", () => {
  runCompare({ handles: [...state.selected] }, "human preview").catch(showError);
});

elements.interpolateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runInterpolate({ path: elements.interpolatePath.value }, "human preview").catch(showError);
});

elements.briefForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runBrief({ goal: elements.briefGoal.value, handles: [...state.selected] }, "human preview").catch(showError);
});

elements.itineraryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runItinerary({
    goal: elements.itineraryGoal.value,
    handles: [...state.selected],
    date: elements.itineraryDate.value,
    days: elements.itineraryDays.value,
    partySize: elements.itineraryParty.value,
    budget: elements.itineraryBudget.value,
    pace: elements.itineraryPace.value,
    earliestStart: elements.itineraryStart.value,
    latestEnd: elements.itineraryEnd.value,
  }, "human preview").catch(showError);
});

elements.confirmCart.addEventListener("click", () => confirmCart().catch(showError));
elements.dismissCart.addEventListener("click", dismissCart);
elements.downloadDossier.addEventListener("click", downloadDecisionDossier);

function showError(error) {
  const message = error instanceof Error ? error.message : "The tool request failed.";
  const code = error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN_ERROR";
  const reason = error && typeof error === "object" && error.reason ? ` | ${error.reason}` : "";
  const trace = error && typeof error === "object" && error.correlationId ? ` | trace ${error.correlationId.slice(0, 8)}` : "";
  const retry = error && typeof error === "object" && error.retryable === true ? " Retry is reasonable." : " Check the input or origin status.";
  elements.message.textContent = `${code}${reason}${trace}: ${message}${retry}`;
  recordActivity("tool_error", {}, "system", JSON.stringify({ code, message, reason: error?.reason, correlationId: error?.correlationId, retryable: error?.retryable === true }));
}

function resetWorkspaceForRehearsal() {
  state.selected.clear();
  state.activity = [];
  state.proposal = null;
  state.receipts = [];
  state.returnFocus = null;
  state.activeAdapter = null;
  state.decision = emptyDecision();
  state.recommendationRequest = null;
  state.conversionComplete.clear();
  state.conversionActive = null;
  elements.activity.replaceChildren();
  elements.confirmPanel.hidden = true;
  elements.downloadDossier.disabled = true;
  const resultHeading = node("div", "result-heading");
  const resultTitle = node("div");
  resultTitle.append(node("span", "kicker", "Agent result"), node("strong", "", "Guided demo ready"));
  resultHeading.append(resultTitle, node("span", "result-status", "Ready"));
  elements.result.replaceChildren(resultHeading, node("p", "", "The first tool call will appear here as a readable result."));
  renderConversionPath("Waiting for an allowlisted source");
  renderCart();
  updateSelection();
  hideInterpolate();
  hideItinerary();
  hideRefinement();
}

presenter = createPresenter({
  reset: resetWorkspaceForRehearsal,
  listOrigins: () => runListOrigins({}, "guided demo"),
  selectOrigin: (args) => runSelectOrigin(args, "guided demo"),
  search: (args) => runSearch(args, "guided demo"),
  recommend: (args) => runRecommend(args, "guided demo"),
  interpolate: (args) => runInterpolate(args, "guided demo"),
  compare: (args) => runCompare(args, "guided demo"),
  propose: (args) => runProposeCart(args, "guided demo"),
});

await runListOrigins({}, "page initialization", undefined, false).catch(showError);
await Promise.all([loadOriginHealth(), loadOriginDiagnostics(), loadDeploymentIdentity()]);
await registerWebMcpTools().catch(showError);
await runSearch({ query: "", maxResults: 6 }, "page initialization").catch(showError);
