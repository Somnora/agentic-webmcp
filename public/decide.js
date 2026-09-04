import {
  deleteApprovedMemoryFact,
  loadApprovedMemoryFacts,
  normalizeApprovedMemoryFact,
  projectApprovedMemoryFact,
  saveApprovedMemoryFact,
} from "./decision-memory.js";

const elements = {
  form: document.querySelector("#decision-form"),
  vertical: document.querySelector("#decision-vertical"),
  budget: document.querySelector("#decision-budget"),
  goal: document.querySelector("#decision-goal"),
  avoid: document.querySelector("#decision-avoid"),
  location: document.querySelector("#decision-location"),
  subject: document.querySelector("#decision-subject"),
  giftFields: document.querySelector("#gift-fields"),
  giftIntent: document.querySelector("#gift-intent"),
  giftOccasion: document.querySelector("#gift-occasion"),
  giftDeadline: document.querySelector("#gift-deadline"),
  giftQuery: document.querySelector("#gift-query"),
  giftInterests: document.querySelector("#gift-interests"),
  giftMemory: document.querySelector("#gift-memory"),
  giftExistingItems: document.querySelector("#gift-existing-items"),
  dateFields: document.querySelector("#date-fields"),
  dateDay: document.querySelector("#date-day"),
  dateMood: document.querySelector("#date-mood"),
  dateYourInterests: document.querySelector("#date-your-interests"),
  dateTheirInterests: document.querySelector("#date-their-interests"),
  datePrevious: document.querySelector("#date-previous"),
  vacationFields: document.querySelector("#vacation-fields"),
  vacationArrival: document.querySelector("#vacation-arrival"),
  vacationDeparture: document.querySelector("#vacation-departure"),
  vacationTravelers: document.querySelector("#vacation-travelers"),
  vacationPace: document.querySelector("#vacation-pace"),
  vacationVisited: document.querySelector("#vacation-visited"),
  vacationExperiences: document.querySelector("#vacation-experiences"),
  vacationMemories: document.querySelector("#vacation-memories"),
  vacationLodging: document.querySelector("#vacation-lodging"),
  vacationDining: document.querySelector("#vacation-dining"),
  vacationExplorationMode: document.querySelector("#vacation-exploration-mode"),
  staffingFields: document.querySelector("#staffing-fields"),
  staffingLocation: document.querySelector("#staffing-location"),
  staffingDate: document.querySelector("#staffing-date"),
  staffingHours: document.querySelector("#staffing-hours"),
  staffingRoles: document.querySelector("#staffing-roles"),
  staffingCredentials: document.querySelector("#staffing-credentials"),
  staffingEquipment: document.querySelector("#staffing-equipment"),
  memoryFields: document.querySelector("#approved-memory-fields"),
  memoryEmpty: document.querySelector("#approved-memory-empty"),
  memoryList: document.querySelector("#approved-memory-list"),
  memoryStatus: document.querySelector("#approved-memory-status"),
  strategyLabel: document.querySelector("#decision-strategy-label"),
  revision: document.querySelector("#decision-revision"),
  submit: document.querySelector("#decision-submit"),
  contextList: document.querySelector("#decision-context-list"),
  contextEmpty: document.querySelector("#decision-context-empty"),
  requestStatus: document.querySelector("#decision-request-status"),
  summary: document.querySelector("#decision-summary"),
  results: document.querySelector("#decision-results"),
  resultsEmpty: document.querySelector("#decision-results-empty"),
  outcomePanel: document.querySelector("#decision-outcome-panel"),
  outcomeSelection: document.querySelector("#decision-outcome-selection"),
  outcome: document.querySelector("#decision-outcome"),
  memoryScope: document.querySelector("#decision-memory-scope"),
  outcomeFeedback: document.querySelector("#decision-outcome-feedback"),
  proposeMemory: document.querySelector("#decision-propose-memory"),
  dismissOutcome: document.querySelector("#decision-dismiss-outcome"),
  outcomeStatus: document.querySelector("#decision-outcome-status"),
  proposalPanel: document.querySelector("#decision-proposal-panel"),
  proposalValue: document.querySelector("#decision-proposal-value"),
  proposalDetails: document.querySelector("#decision-proposal-details"),
  proposalReason: document.querySelector("#decision-proposal-reason"),
  approveMemory: document.querySelector("#decision-approve-memory"),
  rejectMemory: document.querySelector("#decision-reject-memory"),
  webmcp: document.querySelector("#decision-webmcp-status"),
};

const verticalDefaults = {
  gift: {
    budget: 900,
    goal: "Find a thoughtful electric guitar for my nephew",
    strategy: "Gift marketplace strategy",
  },
  date: {
    budget: 500,
    goal: "Plan a source-backed Oahu date that balances both people",
    strategy: "Date services strategy",
  },
  vacation: {
    budget: 2200,
    goal: "Build a source-backed three-night Oahu vacation package",
    strategy: "Vacation package strategy",
  },
  staffing: {
    budget: 2500,
    goal: "Assemble an Oahu trade and production crew",
    strategy: "Staffing provider strategy",
  },
};

let currentDecisionId = null;
let currentDecision = null;
let selectedOption = null;
let activeProposal = null;
let approvedMemories = [];
const selectedMemoryIds = new Set();

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

function money(value) {
  return value ? `${value.amount} ${value.currencyCode}` : "Price unavailable";
}

function createFact({ id, subjectId, kind, value, allowedUse, now, sensitivity = "standard", lifeStage = null }) {
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
    allowedUses: [allowedUse],
    lastConfirmedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function budgetEnvelope(amount, contingencyPercent) {
  return {
    currencyCode: "USD",
    targetAmount: null,
    maximumAmount: amount.toFixed(2),
    includesTaxes: false,
    includesFees: false,
    contingencyPercent,
  };
}

function selectedMemoryParts(vertical, subjectId, token) {
  const selectedFacts = approvedMemories
    .filter((fact) => selectedMemoryIds.has(fact.id) && fact.allowedUses.includes(vertical))
    .map((fact) => projectApprovedMemoryFact(fact, vertical, subjectId));
  const preferences = selectedFacts
    .filter((fact) => fact.kind === "liked-experience" || fact.kind === "interest")
    .map((fact, index) => ({
      id: `${token}-approved-memory-${index + 1}`,
      kind: fact.kind === "interest" ? "interest" : "experience",
      label: "Approved outcome memory",
      value: fact.value,
      weight: "high",
      source: "profile",
      factId: fact.id,
    }));
  const constraints = selectedFacts
    .filter((fact) => fact.kind === "disliked-experience" || fact.kind === "avoidance" || fact.kind === "existing-item")
    .map((fact, index) => ({
      id: `${token}-approved-avoid-${index + 1}`,
      kind: fact.kind === "existing-item" ? "existing-item" : "avoid",
      label: fact.kind === "existing-item" ? `Already owned: ${fact.value}` : "Approved negative outcome memory",
      value: fact.value,
      source: "profile",
      factId: fact.id,
    }));
  return { selectedFacts, preferences, constraints };
}

function commonBrief({ id, vertical, goal, subjectIds, intent = null, subjectKind = null, occasion = null, occasionDeadline = null, facts, selectedFacts = [], constraints, preferences, budget, location, timeWindow, output, now }) {
  return {
    version: "1",
    id,
    vertical,
    goal,
    subjectIds,
    intent,
    subjectKind,
    occasion,
    occasionDeadline,
    selectedFactIds: selectedFacts.map((fact) => fact.id),
    decisionOnlyFacts: facts,
    hardConstraints: constraints,
    softPreferences: preferences,
    budget,
    location,
    timeWindow,
    output,
    missingInformation: [],
    createdAt: now,
  };
}

function buildGift(now, token, amount) {
  const selectedSubjectId = elements.subject?.value || "profile-recipient";
  const intent = elements.giftIntent?.value || "gift";
  const isSelf = intent === "self-treat" || selectedSubjectId === "profile-self";
  const subjectId = isSelf ? "profile-self" : selectedSubjectId;
  const subjectKind = isSelf ? "self" : "recipient";
  const occasion = clean(elements.giftOccasion?.value, 80) || "Birthday";
  const rawDeadline = elements.giftDeadline?.value ? `${clean(elements.giftDeadline.value, 10)}T23:59:59.000Z` : null;
  const occasionDeadline = rawDeadline && Date.parse(rawDeadline) >= Date.now() ? rawDeadline : null;

  const memoryParts = selectedMemoryParts("gift", subjectId, token);
  const interests = values(elements.giftInterests.value);
  const memories = values(elements.giftMemory.value, 3);
  const existingItems = values(elements.giftExistingItems?.value, 4);
  const avoid = values(elements.avoid.value, 4);
  const facts = [];
  if (interests.length) facts.push(createFact({ id: `${token}-gift-interests`, subjectId, kind: "interest", value: interests, allowedUse: "gift", now }));
  if (memories.length) facts.push(createFact({ id: `${token}-gift-memory`, subjectId, kind: "fond-memory-signal", value: memories, allowedUse: "gift", now, sensitivity: "private", lifeStage: "recent" }));
  if (avoid.length) facts.push(createFact({ id: `${token}-gift-avoid`, subjectId, kind: "avoidance", value: avoid, allowedUse: "gift", now }));
  if (existingItems.length) {
    for (let i = 0; i < existingItems.length; i++) {
      facts.push(createFact({ id: `${token}-gift-existing-${i}`, subjectId, kind: "existing-item", value: existingItems[i], allowedUse: "gift", now }));
    }
  }
  const constraints = [
    ...(avoid.length ? [{ id: `${token}-gift-avoid-constraint`, kind: "avoid", label: "Hard exclusions", value: avoid, source: "profile", factId: `${token}-gift-avoid` }] : []),
    ...existingItems.map((item, i) => ({
      id: `${token}-gift-existing-constraint-${i}`,
      kind: "existing-item",
      label: `Already owned: ${item}`,
      value: item,
      source: "profile",
      factId: `${token}-gift-existing-${i}`,
    })),
    ...memoryParts.constraints,
  ];
  const preferences = [
    ...facts.filter((item) => item.kind !== "avoidance" && item.kind !== "existing-item").map((item) => ({
      id: `${item.id}-preference`,
      kind: item.kind === "interest" ? "interest" : "theme",
      label: item.kind === "interest" ? (isSelf ? "Your interests" : "Recipient interests") : "Personal memory signal",
      value: item.value,
      weight: "high",
      source: "profile",
      factId: item.id,
    })),
    ...memoryParts.preferences,
  ];
  return {
    originId: "catalog-lab",
    query: clean(elements.giftQuery.value, 80),
    context: {
      brief: commonBrief({
        id: `decision-gift-${crypto.randomUUID()}`,
        vertical: "gift",
        goal: clean(elements.goal.value, 180),
        subjectIds: [subjectId],
        intent,
        subjectKind,
        occasion,
        occasionDeadline,
        facts,
        selectedFacts: memoryParts.selectedFacts,
        constraints,
        preferences,
        budget: budgetEnvelope(amount, 0),
        location: null,
        timeWindow: null,
        output: "shortlist",
        now,
      }),
      selectedFacts: memoryParts.selectedFacts,
    },
  };
}

function buildDate(now, token, amount) {
  const yourId = "date-you";
  const theirId = "date-partner";
  const yourInterests = values(elements.dateYourInterests.value);
  const theirInterests = values(elements.dateTheirInterests.value);
  const previous = values(elements.datePrevious.value, 4);
  const avoid = values(elements.avoid.value, 4);
  const day = clean(elements.dateDay.value, 10);
  const facts = [];
  if (yourInterests.length) facts.push(createFact({ id: `${token}-date-your-interests`, subjectId: yourId, kind: "interest", value: yourInterests, allowedUse: "date", now }));
  if (theirInterests.length) facts.push(createFact({ id: `${token}-date-their-interests`, subjectId: theirId, kind: "interest", value: theirInterests, allowedUse: "date", now }));
  if (previous.length) facts.push(createFact({ id: `${token}-date-previous`, subjectId: yourId, kind: "previous-activity", value: previous, allowedUse: "date", now, sensitivity: "private", lifeStage: "recent" }));
  if (avoid.length) facts.push(createFact({ id: `${token}-date-avoid`, subjectId: theirId, kind: "avoidance", value: avoid, allowedUse: "date", now }));
  const memory = selectedMemoryParts("date", yourId, token);
  const interestFacts = facts.filter((item) => item.kind === "interest");
  const constraints = [
    { id: `${token}-date-location`, kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
    { id: `${token}-date-day`, kind: "date-range", label: `Date is ${day}`, value: day, source: "current-request", factId: null },
    { id: `${token}-date-party`, kind: "party-size", label: "Two participants", value: 2, source: "current-request", factId: null },
    ...(avoid.length ? [{ id: `${token}-date-avoid-constraint`, kind: "avoid", label: "Hard exclusions", value: avoid, source: "profile", factId: `${token}-date-avoid` }] : []),
    ...memory.constraints,
  ];
  const preferences = [
    ...interestFacts.map((item) => ({ id: `${item.id}-preference`, kind: "interest", label: item.subjectId === yourId ? "Your interests" : "Their interests", value: item.value, weight: "high", source: "profile", factId: item.id })),
    { id: `${token}-date-mood`, kind: "theme", label: "Desired mood", value: clean(elements.dateMood.value, 80), weight: "medium", source: "current-request", factId: null },
    { id: `${token}-date-novelty`, kind: "novelty", label: "Novelty", value: "mostly-new", weight: "high", source: "current-request", factId: null },
    ...memory.preferences,
  ];
  return {
    originId: "services-lab",
    context: {
      brief: commonBrief({
        id: `decision-date-${crypto.randomUUID()}`,
        vertical: "date",
        goal: clean(elements.goal.value, 180),
        subjectIds: [yourId, theirId],
        facts,
        selectedFacts: memory.selectedFacts,
        constraints,
        preferences,
        budget: budgetEnvelope(amount, 10),
        location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
        timeWindow: { start: `${day}T08:00:00-10:00`, end: `${day}T20:00:00-10:00`, timezone: "Pacific/Honolulu", flexible: false },
        output: "package",
        now,
      }),
      selectedFacts: memory.selectedFacts,
    },
  };
}

function buildVacation(now, token, amount) {
  const subjectId = "vacation-traveler";
  const visited = values(elements.vacationVisited.value);
  const memories = values(elements.vacationMemories.value);
  const experiences = values(elements.vacationExperiences.value);
  const avoid = values(elements.avoid.value, 4);
  const pace = clean(elements.vacationPace.value, 60);
  const explorationMode = clean(elements.vacationExplorationMode?.value, 30) || "balanced";
  const arrival = clean(elements.vacationArrival.value, 10);
  const departure = clean(elements.vacationDeparture.value, 10);
  const travelers = Number(elements.vacationTravelers.value);
  const facts = [];
  if (visited.length) facts.push(createFact({ id: `${token}-vacation-visited`, subjectId, kind: "visited-place", value: visited, allowedUse: "vacation", now }));
  if (memories.length) facts.push(createFact({ id: `${token}-vacation-memory`, subjectId, kind: "fond-memory-signal", value: memories, allowedUse: "vacation", now, sensitivity: "private", lifeStage: "childhood" }));
  if (experiences.length) facts.push(createFact({ id: `${token}-vacation-experiences`, subjectId, kind: "liked-experience", value: experiences, allowedUse: "vacation", now }));
  facts.push(createFact({ id: `${token}-vacation-pace`, subjectId, kind: "pace-preference", value: [pace], allowedUse: "vacation", now }));
  if (avoid.length) facts.push(createFact({ id: `${token}-vacation-avoid`, subjectId, kind: "avoidance", value: avoid, allowedUse: "vacation", now }));
  const memory = selectedMemoryParts("vacation", subjectId, token);
  const constraints = [
    { id: `${token}-trip-location`, kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
    { id: `${token}-trip-dates`, kind: "date-range", label: `${arrival} through ${departure}`, value: [arrival, departure], source: "current-request", factId: null },
    { id: `${token}-trip-party`, kind: "party-size", label: `${travelers} travelers`, value: travelers, source: "current-request", factId: null },
    ...(avoid.length ? [{ id: `${token}-trip-avoid-constraint`, kind: "avoid", label: "Hard exclusions", value: avoid, source: "profile", factId: `${token}-vacation-avoid` }] : []),
    ...memory.constraints,
  ];
  const preferences = [
    ...(memories.length ? [{ id: `${token}-trip-memory`, kind: "theme", label: "Memory signals", value: memories, weight: "high", source: "profile", factId: `${token}-vacation-memory` }] : []),
    ...(experiences.length ? [{ id: `${token}-trip-experiences`, kind: "experience", label: "Liked experiences", value: experiences, weight: "high", source: "profile", factId: `${token}-vacation-experiences` }] : []),
    { id: `${token}-trip-lodging`, kind: "lodging-style", label: "Lodging style", value: clean(elements.vacationLodging.value, 120), weight: "high", source: "current-request", factId: null },
    { id: `${token}-trip-dining`, kind: "dining", label: "Dining", value: clean(elements.vacationDining.value, 120), weight: "medium", source: "current-request", factId: null },
    { id: `${token}-trip-pace`, kind: "pace", label: "Pace", value: pace, weight: "high", source: "profile", factId: `${token}-vacation-pace` },
    { id: `${token}-vacation-novelty`, kind: "novelty", label: `Exploration mode: ${explorationMode}`, value: explorationMode, source: "current-request", factId: null },
    ...memory.preferences,
  ];
  return {
    originId: "services-lab",
    context: {
      brief: commonBrief({
        id: `decision-vacation-${crypto.randomUUID()}`,
        vertical: "vacation",
        goal: clean(elements.goal.value, 180),
        subjectIds: [subjectId],
        facts,
        selectedFacts: memory.selectedFacts,
        constraints,
        preferences,
        budget: budgetEnvelope(amount, 10),
        location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
        timeWindow: { start: `${arrival}T08:00:00-10:00`, end: `${departure}T20:00:00-10:00`, timezone: "Pacific/Honolulu", flexible: false },
        output: "package",
        now,
      }),
      selectedFacts: memory.selectedFacts,
    },
  };
}

function buildStaffing(now, token, amount) {
  const clientId = "staffing-client";
  const projectSite = clean(elements.staffingLocation?.value, 120) || "Honolulu";
  const date = clean(elements.staffingDate.value, 10) || "2026-10-17";
  const hours = Number(elements.staffingHours.value) || 8;
  const roles = values(elements.staffingRoles.value);
  const credentials = values(elements.staffingCredentials.value);
  const equipment = values(elements.staffingEquipment.value);
  const avoid = values(elements.avoid.value, 4);

  const hardConstraints = [
    { id: `${token}-staffing-location`, kind: "location", label: projectSite, value: `${projectSite}, Oahu, Hawaii, US`, source: "current-request", factId: null },
    { id: `${token}-staffing-date`, kind: "date-range", label: `Date is ${date}`, value: date, source: "current-request", factId: null },
    ...roles.map((role, index) => ({
      id: `${token}-staffing-role-${index + 1}`,
      kind: "must-have",
      label: `Required role: ${role}`,
      value: role,
      source: "current-request",
      factId: null,
    })),
    ...credentials.map((req, index) => ({
      id: `${token}-staffing-cred-${index + 1}`,
      kind: "credential",
      label: `Credential requirement: ${req}`,
      value: req,
      source: "current-request",
      factId: null,
    })),
    ...equipment.map((req, index) => ({
      id: `${token}-staffing-equip-${index + 1}`,
      kind: "equipment",
      label: `Equipment requirement: ${req}`,
      value: req,
      source: "current-request",
      factId: null,
    })),
    {
      id: `${token}-staffing-hours`,
      kind: "custom",
      label: "Estimated project hours",
      value: hours,
      source: "current-request",
      factId: null,
    },
    ...(avoid.length ? [{
      id: `${token}-staffing-avoid`,
      kind: "avoid",
      label: "Hard exclusions",
      value: avoid,
      source: "current-request",
      factId: null,
    }] : []),
  ];

  return {
    originId: "services-lab",
    context: {
      brief: commonBrief({
        id: `decision-staffing-${crypto.randomUUID()}`,
        vertical: "staffing",
        goal: clean(elements.goal.value, 180),
        subjectIds: [clientId],
        facts: [],
        selectedFacts: [],
        constraints: hardConstraints,
        preferences: [],
        budget: budgetEnvelope(amount, 10),
        location: { label: projectSite, city: projectSite, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
        timeWindow: { start: `${date}T08:00:00-10:00`, end: `${date}T16:00:00-10:00`, timezone: "Pacific/Honolulu", flexible: false },
        output: "package",
        now,
      }),
      selectedFacts: [],
    },
  };
}

function buildDecision() {
  const now = new Date().toISOString();
  const token = crypto.randomUUID().slice(0, 8);
  const amount = Number(elements.budget.value);
  if (!Number.isFinite(amount)) throw new Error("Enter a valid maximum budget.");
  if (elements.vertical.value === "gift") return buildGift(now, token, amount);
  if (elements.vertical.value === "date") return buildDate(now, token, amount);
  if (elements.vertical.value === "vacation") return buildVacation(now, token, amount);
  return buildStaffing(now, token, amount);
}

function memoryTypeLabel(kind) {
  if (kind === "disliked-experience" || kind === "avoidance") return "Avoid later";
  if (kind === "existing-item") return "Already owned";
  if (kind === "interest") return "Interest";
  return "Liked experience";
}

function updateApprovedMemory(fact) {
  approvedMemories = [...approvedMemories.filter((item) => item.id !== fact.id), fact]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function renderMemoryBank(message = "") {
  const vertical = elements.vertical.value;
  const supported = vertical === "date" || vertical === "vacation" || vertical === "gift";
  elements.memoryFields.hidden = !supported;
  elements.memoryList.replaceChildren();
  if (!supported) return;
  const selectedSubjectId = elements.subject?.value || "profile-self";
  const eligible = approvedMemories.filter((fact) => fact.allowedUses.includes(vertical) && (fact.subjectId === selectedSubjectId || fact.subjectId === "profile-self"));
  elements.memoryEmpty.hidden = eligible.length > 0;
  elements.memoryStatus.textContent = message || (eligible.length
    ? "No memory is selected by default. Check a fact to use it in this decision."
    : "Nothing has been saved for this decision type.");
  for (const fact of eligible) {
    const item = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedMemoryIds.has(fact.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedMemoryIds.add(fact.id);
      else selectedMemoryIds.delete(fact.id);
      elements.memoryStatus.textContent = checkbox.checked
        ? "Selected memory will be included in the next complete decision context."
        : "Memory removed from this decision only. The approved on-device fact remains saved.";
    });
    const copy = document.createElement("span");
    copy.className = "memory-copy";
    copy.append(
      textNode("strong", "", fact.value),
      textNode("span", "", `${memoryTypeLabel(fact.kind)} | allowed for ${fact.allowedUses.join(" and ")} | ${fact.source}`),
    );
    label.append(checkbox, copy);

    const actions = document.createElement("div");
    actions.className = "memory-row-actions";
    const edit = textNode("button", "secondary-button", "Edit memory");
    edit.type = "button";
    const remove = textNode("button", "secondary-button", "Delete memory");
    remove.type = "button";
    actions.append(edit, remove);

    const editor = document.createElement("div");
    editor.className = "memory-edit";
    editor.hidden = true;
    const editInput = document.createElement("input");
    editInput.maxLength = 240;
    editInput.value = fact.value;
    const saveEdit = textNode("button", "", "Save correction");
    saveEdit.type = "button";
    const cancelEdit = textNode("button", "secondary-button", "Cancel edit");
    cancelEdit.type = "button";
    const editActions = document.createElement("div");
    editActions.className = "memory-row-actions";
    editActions.append(saveEdit, cancelEdit);
    editor.append(editInput, editActions);

    const confirmDelete = document.createElement("div");
    confirmDelete.className = "memory-confirm-delete";
    confirmDelete.hidden = true;
    const confirmDeleteButton = textNode("button", "", "Confirm deletion");
    confirmDeleteButton.type = "button";
    const cancelDelete = textNode("button", "secondary-button", "Keep memory");
    cancelDelete.type = "button";
    const deleteActions = document.createElement("div");
    deleteActions.className = "memory-row-actions";
    deleteActions.append(confirmDeleteButton, cancelDelete);
    confirmDelete.append(textNode("p", "", "This permanently removes the fact from this browser."), deleteActions);

    edit.addEventListener("click", () => {
      editor.hidden = false;
      confirmDelete.hidden = true;
      editInput.focus();
    });
    cancelEdit.addEventListener("click", () => { editor.hidden = true; });
    saveEdit.addEventListener("click", () => {
      const now = new Date().toISOString();
      saveApprovedMemoryFact({ ...fact, value: clean(editInput.value, 240), source: "user-stated", lastConfirmedAt: now, updatedAt: now })
        .then((saved) => {
          updateApprovedMemory(saved);
          renderMemoryBank("Correction saved on this device. Select it explicitly to use it.");
        })
        .catch((error) => { elements.memoryStatus.textContent = error.message; });
    });
    remove.addEventListener("click", () => {
      confirmDelete.hidden = false;
      editor.hidden = true;
    });
    cancelDelete.addEventListener("click", () => { confirmDelete.hidden = true; });
    confirmDeleteButton.addEventListener("click", () => {
      deleteApprovedMemoryFact(fact.id)
        .then(() => {
          approvedMemories = approvedMemories.filter((candidate) => candidate.id !== fact.id);
          selectedMemoryIds.delete(fact.id);
          renderMemoryBank("Memory deleted from this browser.");
        })
        .catch((error) => { elements.memoryStatus.textContent = error.message; });
    });
    item.append(label, actions, editor, confirmDelete);
    elements.memoryList.append(item);
  }
}

function resetOutcomePanels() {
  selectedOption = null;
  activeProposal = null;
  elements.outcomePanel.hidden = true;
  elements.proposalPanel.hidden = true;
  elements.outcomeFeedback.value = "";
  elements.outcomeStatus.textContent = "Nothing has been saved.";
}

function setVertical(vertical, reset = true) {
  const selected = verticalDefaults[vertical] ? vertical : "gift";
  elements.vertical.value = selected;
  elements.giftFields.hidden = selected !== "gift";
  elements.dateFields.hidden = selected !== "date";
  elements.vacationFields.hidden = selected !== "vacation";
  elements.staffingFields.hidden = selected !== "staffing";
  elements.strategyLabel.textContent = verticalDefaults[selected].strategy;
  elements.location.closest("label").hidden = selected === "gift";
  elements.giftQuery.required = selected === "gift";
  elements.dateDay.required = selected === "date";
  elements.vacationArrival.required = selected === "vacation";
  elements.vacationDeparture.required = selected === "vacation";
  elements.staffingDate.required = selected === "staffing";
  elements.staffingRoles.required = selected === "staffing";
  selectedMemoryIds.clear();
  renderMemoryBank();
  if (reset) {
    elements.budget.value = verticalDefaults[selected].budget;
    elements.goal.value = verticalDefaults[selected].goal;
    elements.avoid.value = "";
    currentDecisionId = null;
    elements.revision.hidden = true;
    elements.submit.textContent = "Plan this decision";
    elements.contextList.replaceChildren();
    elements.contextEmpty.hidden = false;
    elements.results.replaceChildren();
    elements.resultsEmpty.hidden = false;
    elements.resultsEmpty.textContent = "No options planned yet.";
    elements.summary.replaceChildren(
      textNode("strong", "", "No strategy has run yet"),
      textNode("p", "", "The result will identify the selected strategy, source state, context projection, and available next actions."),
    );
    elements.summary.dataset.status = "idle";
    elements.requestStatus.textContent = "Waiting for a decision";
    currentDecision = null;
    resetOutcomePanels();
  }
}

function appendContextRow(label, value) {
  const item = document.createElement("li");
  item.append(textNode("strong", "", label), textNode("span", "", value));
  elements.contextList.append(item);
}

function renderContext(payload, context) {
  elements.contextList.replaceChildren();
  elements.contextEmpty.hidden = true;
  appendContextRow("Decision", `${payload.vertical} | ${payload.decisionId}`);
  appendContextRow("Strategy", `${payload.strategy.id} | deterministic ${payload.strategy.resultKind}`);
  appendContextRow("Evidence", `${payload.evidence.originId} | ${payload.evidence.source} | ${payload.evidence.live ? "live" : "fallback"} | ${payload.evidence.offerCount} Offers`);
  appendContextRow("Subjects", payload.contextProjection.subjectIds.join(", ") || "None");
  appendContextRow("Selected fact IDs", payload.contextProjection.factIds.join(", ") || "No personal facts supplied");
  appendContextRow("Hard constraint IDs", payload.contextProjection.hardConstraintIds.join(", ") || "None");
  appendContextRow("Soft preference IDs", payload.contextProjection.softPreferenceIds.join(", ") || "None");
  appendContextRow("Budget", `${context.brief.budget.maximumAmount} ${context.brief.budget.currencyCode}`);
  appendContextRow("Handling", `${payload.handling.persistence} | ${payload.handling.cache} | external action ${payload.handling.externalAction}`);
  if (payload.revisionOf) appendContextRow("Revision of", payload.revisionOf);
}

function sourceLink(label, urlValue) {
  const url = safeUrl(urlValue);
  if (!url) return textNode("strong", "", label);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function selectOutcomeOption(option) {
  if (!currentDecision) return;
  selectedOption = option;
  activeProposal = null;
  elements.proposalPanel.hidden = true;
  elements.outcomePanel.hidden = false;
  elements.outcomeSelection.textContent = `${option.title} from decision ${currentDecision.decisionId}.`;
  elements.outcome.value = "selected";
  elements.memoryScope.value = "current";
  elements.outcomeFeedback.value = "";
  const supported = currentDecision.vertical === "date" || currentDecision.vertical === "vacation";
  elements.proposeMemory.disabled = !supported;
  elements.memoryScope.disabled = !supported;
  elements.outcomeStatus.textContent = supported
    ? "This outcome is page-only. Submit it to create a reviewable proposal, not a saved fact."
    : (currentDecision.vertical === "staffing"
      ? "Staffing crew outcomes remain decision-only in this unified self-profile loop."
      : "Gift-recipient outcomes remain decision-only in this unified self-profile loop.");
}

function outcomeButton(option) {
  const button = textNode("button", "result-choice", "Choose this option");
  button.type = "button";
  button.addEventListener("click", () => selectOutcomeOption(option));
  return button;
}

function renderGift(result) {
  const offers = new Map(result.offers.map((offer) => [offer.handle, offer]));
  for (const recommendation of result.recommendations) {
    const offer = offers.get(recommendation.handle);
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(textNode("span", "result-rank", `#${recommendation.rank} ${recommendation.label}`), textNode("strong", "result-score", `${recommendation.score}/100`));
    const matches = document.createElement("ul");
    matches.className = "result-matches";
    for (const match of recommendation.matchedFacts) matches.append(textNode("li", "", match.explanation));
    const footer = document.createElement("footer");
    footer.append(textNode("strong", "", offer ? money(offer.priceRange.min) : "Price unavailable"), offer ? sourceLink("View source", offer.url) : textNode("span", "", "Source unavailable"));
    article.append(
      header,
      offer ? sourceLink(offer.title, offer.url) : textNode("h3", "", recommendation.handle),
      textNode("p", "result-reason", recommendation.why),
      matches,
      textNode("p", "result-tradeoff", `Tradeoff: ${recommendation.tradeoff}`),
      textNode("p", "result-evidence", `Evidence: ${recommendation.evidenceConfidence}`),
      footer,
      outcomeButton({ id: recommendation.handle, title: offer?.title ?? recommendation.handle }),
    );
    elements.results.append(article);
  }
}

function renderTimeline(items) {
  const timeline = document.createElement("ol");
  timeline.className = "date-timeline";
  for (const item of items.filter((candidate) => candidate.status === "scheduled")) {
    const row = document.createElement("li");
    row.append(textNode("time", "", `${item.startLocal}-${item.endLocal}`));
    const detail = document.createElement("div");
    detail.append(sourceLink(item.title, item.sourceUrl), textNode("span", "", `${item.location} | ${money(item.price)}`));
    row.append(detail);
    timeline.append(row);
  }
  return timeline;
}

function renderDate(result) {
  for (const plan of result.plans) {
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(textNode("span", "result-rank", plan.label), textNode("strong", "result-score", `${plan.score}/100`));
    const matches = document.createElement("ul");
    matches.className = "result-matches";
    for (const match of plan.matchedFacts) matches.append(textNode("li", "", `${match.subjectId}: ${match.explanation}`));
    const footer = document.createElement("footer");
    footer.append(textNode("strong", "", `${money(plan.costRange.min)}-${plan.costRange.max.amount} ${plan.costRange.max.currencyCode}`), textNode("span", "", `Ceiling ${money(plan.budgetCeiling)}`));
    article.append(header, textNode("h3", "", plan.title), textNode("p", "result-reason", plan.why), renderTimeline(plan.itinerary.items), matches, textNode("p", "result-tradeoff", `Tradeoff: ${plan.tradeoff}`), textNode("p", "result-evidence", `Evidence: ${plan.evidenceConfidence}`), footer, outcomeButton({ id: plan.id, title: plan.title }));
    elements.results.append(article);
  }
}

function renderVacation(result) {
  for (const trip of result.packages) {
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(textNode("span", "result-rank", trip.label), textNode("strong", "result-score", `${trip.score}/100`));
    const items = document.createElement("ul");
    items.className = "package-items";
    for (const item of trip.items) {
      const row = document.createElement("li");
      row.append(textNode("span", "package-category", item.category));
      const detail = document.createElement("div");
      detail.append(sourceLink(item.title, item.sourceUrl), textNode("span", "", `${item.provider} | ${item.quantity} ${item.unitLabel} | ${money(item.total)}`));
      row.append(detail);
      items.append(row);
    }
    const matches = document.createElement("ul");
    matches.className = "result-matches";
    for (const match of trip.matchedFacts) matches.append(textNode("li", "", `${match.summary}: ${match.explanation}`));
    const footer = document.createElement("footer");
    footer.append(textNode("strong", "", `${money(trip.totals.planningRange.min)}-${trip.totals.planningRange.max.amount} ${trip.totals.planningRange.max.currencyCode}`), textNode("span", "", `Ceiling ${money(trip.budgetCeiling)}`));
    article.append(header, textNode("h3", "", trip.title), textNode("p", "result-reason", `${trip.nights} nights | ${trip.travelers} travelers. ${trip.why}`), items, renderTimeline(trip.itinerary.items), matches, textNode("p", "result-tradeoff", `Tradeoff: ${trip.tradeoff}`), textNode("p", "result-evidence", `Evidence: ${trip.evidenceConfidence}`), footer, outcomeButton({ id: trip.id, title: trip.title }));
    elements.results.append(article);
  }
}

function renderStaffing(result) {
  for (const crew of result.crews) {
    const article = document.createElement("article");
    const header = document.createElement("header");
    header.append(textNode("span", "result-rank", crew.label), textNode("strong", "result-score", `${crew.score}/100`));
    const items = document.createElement("ul");
    items.className = "package-items";
    for (const assignment of crew.assignments) {
      const row = document.createElement("li");
      row.append(textNode("span", "package-category", assignment.roleLabel || assignment.role));
      const detail = document.createElement("div");
      detail.append(
        sourceLink(assignment.provider.name, assignment.offer.url),
        textNode("span", "", `${assignment.price.quoteMode === "published-rate" ? "Published rate" : "Estimate only"} | ${money(assignment.price.published)} (${assignment.price.basis})`),
      );
      if (assignment.credentialEvidence?.length) {
        detail.append(textNode("span", "", `Verified: ${assignment.credentialEvidence.map((c) => c.label).join(", ")}`));
      }
      if (assignment.equipment?.length) {
        detail.append(textNode("span", "", `Equipment: ${assignment.equipment.join(", ")}`));
      }
      row.append(detail);
      items.append(row);
    }
    if (crew.missingRoles?.length) {
      const gapBox = document.createElement("ul");
      gapBox.className = "package-unknowns";
      for (const gap of crew.missingRoles) {
        gapBox.append(textNode("li", "", `Missing role: ${gap.role} - ${gap.reason}`));
      }
      items.append(gapBox);
    }
    if (crew.scheduleGaps?.length) {
      const gapBox = document.createElement("ul");
      gapBox.className = "package-unknowns";
      for (const gap of crew.scheduleGaps) {
        gapBox.append(textNode("li", "", `Schedule gap for ${gap.role}: ${gap.gapDescription}`));
      }
      items.append(gapBox);
    }
    const matches = document.createElement("ul");
    matches.className = "result-matches";
    matches.append(
      textNode("li", "", `Project Date: ${crew.projectDate} (${crew.estimatedHours}h estimated)`),
      textNode("li", "", `Quote accounting: ${crew.quoteAccounting.publishedRateAssignments} published-rate, ${crew.quoteAccounting.estimateOnlyAssignments} estimate-only`),
    );
    if (crew.quoteAccounting.unknownCosts?.length) {
      for (const costNote of crew.quoteAccounting.unknownCosts) {
        matches.append(textNode("li", "", costNote));
      }
    }
    const footer = document.createElement("footer");
    footer.append(
      textNode("strong", "", `${money(crew.costs.publishedSubtotal)}-${crew.costs.planningHigh.amount} ${crew.costs.planningHigh.currencyCode}`),
      textNode("span", "", `Ceiling ${money(crew.budgetCeiling)} (${crew.costs.withinBudget ? "within budget" : "over budget"})`),
    );
    article.append(
      header,
      textNode("h3", "", crew.title),
      textNode("p", "result-reason", `${crew.projectDate} | ${crew.estimatedHours}h. ${crew.why}`),
      items,
      matches,
      textNode("p", "result-tradeoff", `Tradeoff: ${crew.tradeoff}`),
      textNode("p", "result-evidence", `Evidence: ${crew.evidenceConfidence} | Provider review: ${crew.providerSourceReview}`),
      footer,
      outcomeButton({ id: crew.id, title: crew.title }),
    );
    elements.results.append(article);
  }
}

function renderResult(payload) {
  elements.results.replaceChildren();
  resetOutcomePanels();
  elements.results.dataset.vertical = payload.vertical;
  elements.resultsEmpty.hidden = payload.optionCount > 0;
  elements.resultsEmpty.textContent = payload.result.warning || "No complete option met the current constraints.";
  if (payload.vertical === "gift") renderGift(payload.result);
  if (payload.vertical === "date") renderDate(payload.result);
  if (payload.vertical === "vacation") renderVacation(payload.result);
  if (payload.vertical === "staffing") renderStaffing(payload.result);
  elements.summary.replaceChildren();
  elements.summary.dataset.status = payload.status === "planned" ? "ready" : "attention";
  elements.summary.append(
    textNode("strong", "", `${payload.optionCount} options from ${payload.strategy.id}`),
    textNode("p", "", `${payload.evidence.live ? "Live" : "Fallback"} ${payload.evidence.source} evidence. Revision is available. ${payload.vertical === "gift" || payload.vertical === "staffing" ? `${payload.vertical === "gift" ? "Gift-recipient" : "Staffing crew"} memory remains decision-only.` : "A chosen outcome can become a reviewable memory proposal."} Provider handoff remains unavailable.`),
  );
}

async function api(body, signal) {
  const response = await fetch("/api/decisions/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The decision could not be planned.");
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function profileUpdateApi(body, signal) {
  const response = await fetch("/api/profile-updates/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The memory proposal could not be created.");
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function runDecision({ signal } = {}, actor = "human") {
  const { context, originId, query } = buildDecision();
  const revisionOf = currentDecisionId;
  elements.requestStatus.textContent = `${actor} request in progress...`;
  elements.submit.disabled = true;
  try {
    const payload = await api({
      originId,
      ...(query ? { query } : {}),
      maxResults: 3,
      decisionContext: context,
      ...(revisionOf ? { revisionOf } : {}),
    }, signal);
    renderContext(payload, context);
    renderResult(payload);
    currentDecisionId = payload.decisionId;
    currentDecision = payload;
    elements.revision.hidden = false;
    elements.submit.textContent = "Revise complete context";
    elements.requestStatus.textContent = `${payload.optionCount} ${payload.vertical} options planned${payload.revisionOf ? " as a linked revision" : ""}.`;
    return {
      decisionId: payload.decisionId,
      revisionOf: payload.revisionOf,
      vertical: payload.vertical,
      status: payload.status,
      optionCount: payload.optionCount,
      strategy: payload.strategy,
      evidence: payload.evidence,
      externalAction: payload.handling.externalAction,
    };
  } finally {
    elements.submit.disabled = false;
  }
}

function proposalDetail(label, value) {
  elements.proposalDetails.append(textNode("dt", "", label), textNode("dd", "", value));
}

function renderProposal(proposal) {
  activeProposal = proposal;
  elements.proposalPanel.hidden = false;
  elements.proposalValue.value = proposal.factDraft.value;
  elements.proposalDetails.replaceChildren();
  proposalDetail("Operation", proposal.operation);
  proposalDetail("Fact type", proposal.factDraft.kind);
  proposalDetail("Subject", "Your self profile");
  proposalDetail("Allowed use", proposal.factDraft.allowedUses.join(" and "));
  proposalDetail("Current state", `${proposal.factDraft.confidence} | ${proposal.handling.approvalStatus}`);
  proposalDetail("Storage before approval", proposal.handling.persistence);
  elements.proposalReason.textContent = proposal.reason;
  elements.outcomeStatus.textContent = "Proposal created. Nothing has been saved. Review, edit, approve, or reject it below.";
}

async function proposeSelectedOutcome() {
  if (!currentDecision || !selectedOption) throw new Error("Choose a decision option first.");
  if (currentDecision.vertical !== "date" && currentDecision.vertical !== "vacation") {
    throw new Error(currentDecision.vertical === "staffing"
      ? "Staffing crew outcomes remain decision-only in this unified self-profile loop."
      : "Gift-recipient outcomes remain decision-only in this unified self-profile loop.");
  }
  const feedback = clean(elements.outcomeFeedback.value, 180);
  if (!feedback) throw new Error("Add a short reason before creating a memory proposal.");
  const allowedUses = elements.memoryScope.value === "experiences"
    ? ["date", "vacation"]
    : [currentDecision.vertical];
  const proposal = await profileUpdateApi({
    decisionId: currentDecision.decisionId,
    vertical: currentDecision.vertical,
    optionId: selectedOption.id,
    optionTitle: selectedOption.title,
    outcome: elements.outcome.value,
    feedback,
    allowedUses,
  });
  renderProposal(proposal);
}

async function approveActiveProposal() {
  if (!activeProposal) throw new Error("There is no profile proposal to approve.");
  const value = clean(elements.proposalValue.value, 240);
  if (!value) throw new Error("Approved memory text cannot be empty.");
  const now = new Date().toISOString();
  const edited = value !== activeProposal.factDraft.value;
  const fact = normalizeApprovedMemoryFact({
    ...activeProposal.factDraft,
    value,
    source: edited ? "user-stated" : "inferred-and-confirmed",
    confidence: "confirmed",
    lastConfirmedAt: now,
    updatedAt: now,
  }, now);
  const saved = await saveApprovedMemoryFact(fact);
  updateApprovedMemory(saved);
  selectedMemoryIds.delete(saved.id);
  activeProposal = null;
  elements.proposalPanel.hidden = true;
  elements.outcomeStatus.textContent = "Memory approved and saved on this device. It remains unselected until you explicitly include it in another decision.";
  renderMemoryBank("New memory approved. Select it explicitly to use it in the next decision.");
}

function applyToolInput(input) {
  setVertical(input.vertical, true);
  if (input.subjectId && elements.subject) elements.subject.value = input.subjectId;
  elements.goal.value = clean(input.goal, 180) || verticalDefaults[input.vertical].goal;
  elements.budget.value = input.maximumBudget;
  elements.avoid.value = values(input.avoid, 4).join(", ");
  if (input.vertical === "gift") {
    if (input.intent && elements.giftIntent) elements.giftIntent.value = input.intent;
    if (input.occasion && elements.giftOccasion) elements.giftOccasion.value = input.occasion;
    if (input.occasionDeadline && elements.giftDeadline) elements.giftDeadline.value = input.occasionDeadline;
    if (input.existingItems && elements.giftExistingItems) elements.giftExistingItems.value = values(input.existingItems).join(", ");
    elements.giftQuery.value = clean(input.query, 80) || "electric guitar";
    elements.giftInterests.value = values(input.primaryInterests).join(", ");
    elements.giftMemory.value = values(input.memorySignals, 3).join(", ");
  }
  if (input.vertical === "date") {
    elements.dateDay.value = clean(input.date, 10) || "2026-10-10";
    elements.dateYourInterests.value = values(input.primaryInterests).join(", ");
    elements.dateTheirInterests.value = values(input.secondaryInterests).join(", ");
    elements.datePrevious.value = values(input.previousActivities, 4).join(", ");
    if (["calm and connected", "playful and active", "creative and curious"].includes(input.mood)) elements.dateMood.value = input.mood;
  }
  if (input.vertical === "vacation") {
    elements.vacationArrival.value = clean(input.arrivalDate, 10) || "2026-10-09";
    elements.vacationDeparture.value = clean(input.departureDate, 10) || "2026-10-12";
    elements.vacationTravelers.value = input.travelers || 2;
    elements.vacationVisited.value = values(input.visitedPlaces).join(", ");
    elements.vacationExperiences.value = values(input.primaryInterests).join(", ");
    elements.vacationMemories.value = values(input.memorySignals).join(", ");
    elements.vacationLodging.value = clean(input.lodgingStyle, 120) || "small quiet lodging near water";
    elements.vacationDining.value = clean(input.diningPreference, 120) || "local plant-forward food";
    if (["one anchor activity per day", "balanced", "full days"].includes(input.pace)) elements.vacationPace.value = input.pace;
    if (input.explorationMode && ["balanced", "comfort-seeking", "novelty-seeking"].includes(input.explorationMode) && elements.vacationExplorationMode) {
      elements.vacationExplorationMode.value = input.explorationMode;
    }
  }
  if (input.vertical === "staffing") {
    if (input.location && elements.staffingLocation) elements.staffingLocation.value = clean(input.location, 120);
    elements.staffingDate.value = clean(input.date, 10) || "2026-10-17";
    elements.staffingHours.value = input.hours || 8;
    if (input.roles) elements.staffingRoles.value = values(input.roles).join(", ");
    if (input.credentials) elements.staffingCredentials.value = values(input.credentials).join(", ");
    if (input.equipment) elements.staffingEquipment.value = values(input.equipment).join(", ");
  }
}

elements.vertical.addEventListener("change", () => setVertical(elements.vertical.value));
if (elements.subject) elements.subject.addEventListener("change", () => renderMemoryBank());
if (elements.giftIntent) {
  elements.giftIntent.addEventListener("change", () => {
    if (elements.giftIntent.value === "self-treat" && elements.subject) {
      elements.subject.value = "profile-self";
    }
    renderMemoryBank();
  });
}
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runDecision({}, "human").catch((error) => {
    elements.requestStatus.textContent = `${error.code || "REQUEST_FAILED"}: ${error.message}`;
  });
});
elements.proposeMemory.addEventListener("click", () => {
  elements.outcomeStatus.textContent = "Creating a request-only proposal...";
  proposeSelectedOutcome().catch((error) => {
    elements.outcomeStatus.textContent = `${error.code || "PROPOSAL_FAILED"}: ${error.message}`;
  });
});
elements.approveMemory.addEventListener("click", () => {
  elements.approveMemory.disabled = true;
  approveActiveProposal()
    .catch((error) => { elements.outcomeStatus.textContent = `APPROVAL_FAILED: ${error.message}`; })
    .finally(() => { elements.approveMemory.disabled = false; });
});
elements.rejectMemory.addEventListener("click", () => {
  activeProposal = null;
  elements.proposalPanel.hidden = true;
  elements.outcomeStatus.textContent = "Proposal rejected. Nothing was saved.";
});
elements.dismissOutcome.addEventListener("click", () => {
  resetOutcomePanels();
});

async function registerWebMcpTool() {
  if (!document.modelContext?.registerTool) {
    elements.webmcp.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  await document.modelContext.registerTool({
    name: "plan_decision",
    description: "Plan a gift, date, vacation, or project staffing decision through Ribband's unified typed decision orchestrator. The tool updates the visible page, uses request-only context, and cannot buy, book, contact providers, pay, or save inferred facts.",
    inputSchema: {
      type: "object",
      properties: {
        vertical: { type: "string", enum: ["gift", "date", "vacation", "staffing"] },
        subjectId: { type: "string", maxLength: 64 },
        intent: { type: "string", enum: ["gift", "self-treat"] },
        occasion: { type: "string", maxLength: 80 },
        occasionDeadline: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        existingItems: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 80 } },
        goal: { type: "string", maxLength: 180 },
        maximumBudget: { type: "number", minimum: 25, maximum: 100000 },
        query: { type: "string", maxLength: 80 },
        primaryInterests: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        secondaryInterests: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        memorySignals: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        previousActivities: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        avoid: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        mood: { type: "string", enum: ["calm and connected", "playful and active", "creative and curious"] },
        arrivalDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        departureDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        travelers: { type: "integer", minimum: 1, maximum: 8 },
        visitedPlaces: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        lodgingStyle: { type: "string", maxLength: 120 },
        diningPreference: { type: "string", maxLength: 120 },
        pace: { type: "string", enum: ["one anchor activity per day", "balanced", "full days"] },
        explorationMode: { type: "string", enum: ["balanced", "comfort-seeking", "novelty-seeking"] },
        roles: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        location: { type: "string", maxLength: 120 },
        hours: { type: "integer", minimum: 1, maximum: 16 },
        credentials: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
        equipment: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", maxLength: 60 } },
      },
      required: ["vertical", "goal", "maximumBudget"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input, { signal } = {}) => {
      applyToolInput(input);
      return runDecision({ signal }, "agent via WebMCP");
    },
  });
  elements.webmcp.textContent = "1 unified decision tool registered";
}

setVertical("gift", false);
loadApprovedMemoryFacts()
  .then((facts) => {
    approvedMemories = facts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    renderMemoryBank();
  })
  .catch((error) => {
    elements.memoryStatus.textContent = error.message;
  });
registerWebMcpTool().catch((error) => {
  elements.webmcp.textContent = `WebMCP registration failed: ${error.message}`;
});
