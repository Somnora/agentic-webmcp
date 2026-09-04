function fact(id, subjectId, kind, value, allowedUse, timestamp, sensitivity = "standard", lifeStage = null) {
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
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function baseBrief(id, vertical, goal, subjectIds, timestamp) {
  return {
    version: "1",
    id,
    vertical,
    goal,
    subjectIds,
    selectedFactIds: [],
    decisionOnlyFacts: [],
    hardConstraints: [],
    softPreferences: [],
    budget: null,
    location: null,
    timeWindow: null,
    output: "package",
    missingInformation: [],
    createdAt: timestamp,
  };
}

function budget(maximumAmount, contingencyPercent) {
  return {
    currencyCode: "USD",
    targetAmount: null,
    maximumAmount,
    includesTaxes: false,
    includesFees: false,
    contingencyPercent,
  };
}

function giftContext(timestamp) {
  const interests = fact("rc-gift-interests", "profile-recipient", "interest", ["single coil", "classic shapes"], "gift", timestamp);
  const avoid = fact("rc-gift-avoid", "profile-recipient", "avoidance", ["acoustic guitar"], "gift", timestamp);
  return {
    brief: {
      ...baseBrief("rc-decision-gift", "gift", "Find a thoughtful guitar for my nephew", ["profile-recipient"], timestamp),
      intent: "gift",
      subjectKind: "recipient",
      occasion: "Birthday",
      occasionDeadline: null,
      decisionOnlyFacts: [interests, avoid],
      hardConstraints: [{ id: "rc-gift-avoid-constraint", kind: "avoid", label: "Hard exclusions", value: ["acoustic guitar"], source: "profile", factId: avoid.id }],
      softPreferences: [{ id: "rc-gift-interest-preference", kind: "interest", label: "Recipient interests", value: interests.value, weight: "high", source: "profile", factId: interests.id }],
      budget: budget("900.00", 0),
      output: "shortlist",
    },
    selectedFacts: [],
  };
}

function dateContext(timestamp) {
  const yours = fact("rc-date-yours", "date-you", "interest", ["photography", "local food"], "date", timestamp);
  const theirs = fact("rc-date-theirs", "date-partner", "interest", ["surf", "local history"], "date", timestamp);
  const previous = fact("rc-date-previous", "date-you", "previous-activity", ["movie night"], "date", timestamp, "private", "recent");
  return {
    brief: {
      ...baseBrief("rc-decision-date", "date", "Plan a source-backed Oahu date for both of us", ["date-you", "date-partner"], timestamp),
      decisionOnlyFacts: [yours, theirs, previous],
      hardConstraints: [
        { id: "rc-date-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "rc-date-day", kind: "date-range", label: "Date is 2026-10-10", value: "2026-10-10", source: "current-request", factId: null },
        { id: "rc-date-party", kind: "party-size", label: "Two participants", value: 2, source: "current-request", factId: null },
      ],
      softPreferences: [
        { id: "rc-date-yours-preference", kind: "interest", label: "Your interests", value: yours.value, weight: "high", source: "profile", factId: yours.id },
        { id: "rc-date-theirs-preference", kind: "interest", label: "Their interests", value: theirs.value, weight: "high", source: "profile", factId: theirs.id },
        { id: "rc-date-mood", kind: "theme", label: "Desired mood", value: "creative and curious", weight: "medium", source: "current-request", factId: null },
        { id: "rc-date-novelty", kind: "novelty", label: "Novelty", value: "mostly-new", weight: "high", source: "current-request", factId: null },
      ],
      budget: budget("500.00", 10),
      location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-10T08:00:00-10:00", end: "2026-10-10T20:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

function vacationContext(timestamp) {
  const visited = fact("rc-vacation-visited", "vacation-traveler", "visited-place", ["Maui"], "vacation", timestamp);
  const memory = fact("rc-vacation-memory", "vacation-traveler", "fond-memory-signal", ["early mornings at the beach with my family"], "vacation", timestamp, "private", "childhood");
  const experiences = fact("rc-vacation-experiences", "vacation-traveler", "liked-experience", ["photography", "local food", "ocean"], "vacation", timestamp);
  const pace = fact("rc-vacation-pace", "vacation-traveler", "pace-preference", ["balanced"], "vacation", timestamp);
  return {
    brief: {
      ...baseBrief("rc-decision-vacation", "vacation", "Build a three-night Oahu package around memories and new experiences", ["vacation-traveler"], timestamp),
      decisionOnlyFacts: [visited, memory, experiences, pace],
      hardConstraints: [
        { id: "rc-trip-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "rc-trip-dates", kind: "date-range", label: "October 9 through October 12", value: ["2026-10-09", "2026-10-12"], source: "current-request", factId: null },
        { id: "rc-trip-party", kind: "party-size", label: "Two travelers", value: 2, source: "current-request", factId: null },
      ],
      softPreferences: [
        { id: "rc-trip-memory-preference", kind: "theme", label: "Memory signals", value: memory.value, weight: "high", source: "profile", factId: memory.id },
        { id: "rc-trip-experience-preference", kind: "experience", label: "Liked experiences", value: experiences.value, weight: "high", source: "profile", factId: experiences.id },
        { id: "rc-trip-lodging", kind: "lodging-style", label: "Lodging style", value: "quiet near the coast", weight: "high", source: "current-request", factId: null },
        { id: "rc-trip-dining", kind: "dining", label: "Dining", value: "local and plant-forward", weight: "medium", source: "current-request", factId: null },
        { id: "rc-trip-pace", kind: "pace", label: "Pace", value: "balanced", weight: "high", source: "profile", factId: pace.id },
        { id: "rc-trip-novelty", kind: "novelty", label: "Exploration mode: balanced", value: "balanced", weight: "high", source: "current-request", factId: null },
      ],
      budget: budget("2200.00", 10),
      location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-09T08:00:00-10:00", end: "2026-10-12T20:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

function staffingContext(timestamp, location = "Honolulu") {
  return {
    brief: {
      ...baseBrief("rc-decision-staffing", "staffing", "Assemble an electrical and carpentry project crew", ["staffing-client"], timestamp),
      hardConstraints: [
        { id: "rc-staffing-location", kind: "location", label: location, value: `${location}, Oahu, Hawaii, US`, source: "current-request", factId: null },
        { id: "rc-staffing-date", kind: "date-range", label: "Date is 2026-10-17", value: "2026-10-17", source: "current-request", factId: null },
        { id: "rc-staffing-role-1", kind: "must-have", label: "Residential electrician", value: "residential electrician", source: "current-request", factId: null },
        { id: "rc-staffing-role-2", kind: "must-have", label: "Finish carpenter", value: "finish carpenter", source: "current-request", factId: null },
        { id: "rc-staffing-hours", kind: "custom", label: "Estimated project hours", value: 8, source: "current-request", factId: null },
      ],
      budget: budget("2500.00", 10),
      location: { label: location, city: location, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-17T08:00:00-10:00", end: "2026-10-17T16:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

async function postDecision(baseUrl, originId, decisionContext, query) {
  const response = await fetch(`${baseUrl}/api/decisions/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originId, ...(query ? { query } : {}), maxResults: 3, decisionContext }),
  });
  const body = await response.json();
  if (response.status !== 200) throw new Error(`${body.code || response.status}: ${body.error || "decision request failed"}`);
  if (response.headers.get("Cache-Control") !== "no-store") throw new Error("decision response is not no-store");
  return body;
}

export function releaseCandidateChecks(baseUrl) {
  const timestamp = new Date().toISOString();
  return [
    {
      name: "personalized release-candidate routes",
      run: async () => {
        for (const [path, marker] of [["/decide", "decision-form"], ["/workspace", "gift-profile-form"], ["/date", "date-profile-form"], ["/vacation", "vacation-profile-form"]]) {
          const response = await fetch(`${baseUrl}${path}`);
          const html = await response.text();
          if (response.status !== 200 || !html.includes(marker)) throw new Error(`${path} is unavailable`);
        }
      },
    },
    {
      name: "unified gift strategy",
      run: async () => {
        const body = await postDecision(baseUrl, "catalog-lab", giftContext(timestamp), "guitar");
        if (body.status !== "planned" || body.optionCount !== 3 || body.strategy?.id !== "gift-marketplace-v1") throw new Error("gift strategy did not return three planned options");
        if (body.result?.offers?.some((offer) => offer.handle === "natural-dreadnought-acoustic")) throw new Error("gift avoidance did not filter the acoustic option");
        if (body.handling?.externalAction !== "none") throw new Error("gift strategy exposed an external action");
      },
    },
    {
      name: "unified date strategy",
      run: async () => {
        const body = await postDecision(baseUrl, "services-lab", dateContext(timestamp));
        if (body.status !== "planned" || body.optionCount !== 3 || body.strategy?.id !== "date-services-v1") throw new Error("date strategy did not return all three cost bands");
        if (!body.result?.plans?.every((plan) => plan.itinerary?.status === "planning-only")) throw new Error("date plan escaped the planning-only boundary");
      },
    },
    {
      name: "unified vacation strategy",
      run: async () => {
        const body = await postDecision(baseUrl, "services-lab", vacationContext(timestamp));
        if (body.status !== "planned" || body.optionCount !== 3 || body.strategy?.id !== "vacation-package-v1") throw new Error("vacation strategy did not return all three package tiers");
        if (!body.result?.packages?.every((item) => item.items?.some((entry) => entry.category === "lodging") && item.items?.some((entry) => entry.category === "transport") && item.items?.some((entry) => entry.category === "dining") && item.items?.some((entry) => entry.category === "activity"))) {
          throw new Error("vacation package is missing a required category");
        }
      },
    },
    {
      name: "verified staffing and human-only source review",
      run: async () => {
        const body = await postDecision(baseUrl, "services-lab", staffingContext(timestamp));
        const handoff = body.nextActions?.find((action) => action.id === "handoff");
        const assignments = body.result?.crews?.[0]?.assignments ?? [];
        if (body.status !== "planned" || body.strategy?.id !== "staffing-provider-v1" || assignments.length !== 2) throw new Error("staffing strategy did not return the complete controlled crew");
        if (handoff?.available !== true || handoff?.requiresHumanApproval !== true) throw new Error("staffing handoff is not human-gated");
        if (assignments.some((assignment) => assignment.sourceReview?.action !== "human-only" || !assignment.sourceReview?.url?.startsWith("https://agentic-webmcp-origin.somnora.workers.dev/services/"))) {
          throw new Error("staffing source review escaped the controlled human-only boundary");
        }
      },
    },
    {
      name: "staffing service-area failure",
      run: async () => {
        const body = await postDecision(baseUrl, "services-lab", staffingContext(timestamp, "Atlantis"));
        const handoff = body.nextActions?.find((action) => action.id === "handoff");
        if (body.status !== "needs-attention" || handoff?.available !== false || body.result?.crews?.some((crew) => crew.assignments?.length)) throw new Error("unverified staffing location did not fail closed");
      },
    },
    {
      name: "outcome memory remains proposal-only",
      run: async () => {
        const response = await fetch(`${baseUrl}/api/profile-updates/propose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decisionId: "rc-decision-vacation",
            vertical: "vacation",
            optionId: "rc-vacation-balanced",
            optionTitle: "Balanced Oahu package",
            outcome: "completed",
            feedback: "Quiet coastal mornings and photography felt right.",
            allowedUses: ["vacation", "date"],
          }),
        });
        const body = await response.json();
        if (response.status !== 200 || response.headers.get("Cache-Control") !== "no-store") throw new Error("memory proposal route is unavailable or cacheable");
        if (body.handling?.persistence !== "none" || body.handling?.approvalStatus !== "awaiting-human-confirmation" || body.factDraft?.confidence !== "tentative") {
          throw new Error("memory proposal crossed the approval boundary");
        }
      },
    },
  ];
}
