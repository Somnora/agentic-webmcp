function clean(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sourceUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : "Not supplied";
  } catch {
    return "Not supplied";
  }
}

function money(value) {
  return value?.amount && value?.currencyCode
    ? `${clean(value.amount, 24)} ${clean(value.currencyCode, 8)}`
    : "Not supplied";
}

function addSection(lines, title) {
  lines.push("", `## ${title}`, "");
}

export function dossierFilename(originId, generatedAt = new Date().toISOString()) {
  const origin = clean(originId, 64).toLocaleLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "origin";
  const date = clean(generatedAt, 32).slice(0, 10) || "undated";
  return `agentic-decision-dossier-${origin}-${date}.md`;
}

export function createDecisionDossier(snapshot) {
  const generatedAt = clean(snapshot.generatedAt || new Date().toISOString(), 40);
  const origin = snapshot.origin || {};
  const lines = [
    "# Agentic decision dossier",
    "",
    `Generated: ${generatedAt}`,
    `Origin: ${clean(origin.displayName || origin.id || "Not selected", 120)}`,
    `Canonical host: ${clean(origin.hostname || "Not supplied", 253)}`,
    `Authorization: ${clean(origin.authorization || "Not supplied", 80)}`,
    `Active adapter: ${clean(snapshot.activeAdapter || origin.adapter || "Not supplied", 80)}`,
  ];

  addSection(lines, "Research goal");
  const goal = snapshot.goal || {};
  lines.push(`Goal: ${clean(goal.query || goal.text || "No ranked research goal recorded.", 300)}`);
  lines.push(`Maximum delivered price: ${goal.maxDeliveredPrice === null || goal.maxDeliveredPrice === undefined ? "Not set" : `${clean(goal.maxDeliveredPrice, 24)} USD`}`);
  const intent = goal.intent || {};
  lines.push(`Shopping for: ${clean(intent.shoppingFor === "gift" ? "Someone else" : "Myself", 40)}`);
  lines.push(`Experience: ${clean(intent.mode === "explore" ? "Explore" : "Decide", 40)}`);
  lines.push(`Priorities: ${Array.isArray(intent.priorities) && intent.priorities.length ? intent.priorities.map((item) => clean(item, 24)).join(", ") : "Default evidence balance"}`);
  lines.push(`Taste or recipient context: ${clean(intent.tasteContext || "Not set", 160)}`);
  lines.push(`Must include: ${clean(intent.mustHave || "Not set", 100)}`);
  lines.push(`Avoid: ${clean(intent.avoid || "Not set", 100)}`);

  addSection(lines, "Ranking rubric");
  const rubric = snapshot.rubric || {};
  const rubricEntries = Object.entries(rubric);
  lines.push(rubricEntries.length
    ? rubricEntries.map(([name, score]) => `${clean(name, 40)} ${clean(score, 12)}`).join(" | ")
    : "No ranking rubric was used.");

  addSection(lines, "Refinement checkpoint");
  const refinement = snapshot.refinement;
  if (!refinement) {
    lines.push("No refinement checkpoint was recorded.");
  } else {
    lines.push(`Status: ${clean(refinement.status, 40)}`);
    lines.push(`Reason: ${clean(refinement.reason, 80)}`);
    lines.push(`Score margin: ${refinement.margin === null || refinement.margin === undefined ? "Not available" : clean(refinement.margin, 12)}`);
    if (refinement.question) lines.push(`Question: ${clean(refinement.question, 300)}`);
    const choices = Array.isArray(refinement.choices) ? refinement.choices : [];
    if (choices.length) lines.push(`Choices: ${choices.map((choice) => clean(choice.label || choice.id, 80)).join(" | ")}`);
    if (refinement.selectedChoice) lines.push(`Human answer: ${clean(refinement.selectedChoice.label || refinement.selectedChoice.id, 80)}`);
    lines.push(`Ranking changed: ${refinement.changed ? "Yes" : "No"}`);
    lines.push(`Outcome: ${clean(refinement.explanation || "Not supplied", 400)}`);
  }

  addSection(lines, "Ranked options");
  const rankedOptions = Array.isArray(snapshot.rankedOptions) ? snapshot.rankedOptions : [];
  if (!rankedOptions.length) lines.push("No ranked options were recorded.");
  for (const option of rankedOptions.slice(0, 8)) {
    lines.push(`${clean(option.rank, 4)}. ${clean(option.label || "Ranked option", 40)} | ${clean(option.title || option.handle, 180)} | score ${clean(option.score, 12)} | ${money(option.deliveredPrice)} delivered`);
    lines.push(`   Handle: ${clean(option.handle, 100)}`);
    lines.push(`   Source: ${sourceUrl(option.url)}`);
    if (option.why) lines.push(`   Why: ${clean(option.why, 300)}`);
    if (option.tradeoff) lines.push(`   Tradeoff: ${clean(option.tradeoff, 300)}`);
    if (option.evidenceConfidence) lines.push(`   Evidence confidence: ${clean(option.evidenceConfidence, 240)}`);
    if (option.factors) lines.push(`   Factors: ${Object.entries(option.factors).map(([name, score]) => `${clean(name, 40)} ${clean(score, 12)}`).join(" | ")}`);
  }

  addSection(lines, "Activity itinerary");
  const itinerary = snapshot.itinerary;
  if (!itinerary) {
    lines.push("No activity itinerary was recorded.");
  } else {
    lines.push(`Status: ${clean(itinerary.status || "planning-only", 40)}`);
    lines.push(`Plan status: ${clean(itinerary.planStatus || "Not recorded", 40)}`);
    lines.push(`Destination: ${clean(itinerary.destination?.label || itinerary.destination || "Not recorded", 160)}`);
    lines.push(`Date: ${clean(itinerary.date || "Not selected", 40)}`);
    lines.push(`Party size: ${clean(itinerary.partySize || 1, 8)}`);
    lines.push(`Days: ${clean(itinerary.constraints?.days || 1, 8)}`);
    lines.push(`Pace: ${clean(itinerary.constraints?.pace || "Not recorded", 40)}`);
    lines.push(`Day hours: ${clean(itinerary.constraints?.earliestStart || "Not recorded", 12)} to ${clean(itinerary.constraints?.latestEnd || "Not recorded", 12)}`);
    lines.push(`Activity budget: ${money(itinerary.constraints?.budget)}`);
    lines.push(`Published price total: ${money(itinerary.publishedPriceTotal)}`);
    lines.push(`Budget remaining: ${money(itinerary.budgetRemaining)}`);
    for (const item of (Array.isArray(itinerary.items) ? itinerary.items : []).slice(0, 8)) {
      const time = item.startLocal && item.endLocal ? `${clean(item.date, 40)} ${clean(item.startLocal, 12)}-${clean(item.endLocal, 12)}` : "Not scheduled";
      lines.push(`- ${clean(item.order, 4)}. ${clean(item.title || item.handle, 180)} | ${clean(item.status || "Not recorded", 40)} | ${time}`);
      lines.push(`  ${clean(item.location, 180)} | ${clean(item.durationMinutes, 12)} minutes | party total ${money(item.price)} | ${clean(item.priceBasis, 32)}`);
      lines.push(`  Provider: ${clean(item.provider || "Not supplied", 120)}`);
      lines.push(`  Source: ${sourceUrl(item.sourceUrl)}`);
      lines.push(`  Published windows: ${Array.isArray(item.publishedWindows) ? item.publishedWindows.map((window) => clean(window, 80)).join(", ") : "Not supplied"}`);
      if (item.reason) lines.push(`  Constraint: ${clean(item.reason, 240)}`);
    }
    for (const conflict of (Array.isArray(itinerary.conflicts) ? itinerary.conflicts : []).slice(0, 8)) {
      lines.push(`- Constraint ${clean(conflict.code || "unknown", 60)}: ${clean(conflict.message || "Review required", 300)}`);
    }
    for (const warning of (Array.isArray(itinerary.warnings) ? itinerary.warnings : []).slice(0, 4)) {
      lines.push(`- Limitation: ${clean(warning, 300)}`);
    }
  }

  addSection(lines, "Evidence reconciliation");
  const evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence : [];
  if (!evidence.length) lines.push("No page reconciliation was recorded.");
  for (const item of evidence.slice(0, 8)) {
    lines.push(`- ${clean(item.title || item.handle, 180)}: ${clean(item.label || item.state || "single-source", 240)}`);
    lines.push(`  Source: ${sourceUrl(item.url)}`);
    lines.push(`  Checked: ${clean(item.checkedAt || "Not recorded", 40)}`);
    const conflicts = Array.isArray(item.conflicts) ? item.conflicts : [];
    lines.push(`  Conflicts: ${conflicts.length ? conflicts.map((field) => clean(field, 40)).join(", ") : "None"}`);
  }

  addSection(lines, "Selected offer");
  const selection = snapshot.selection;
  if (!selection) {
    lines.push("No offer was prepared for human review.");
  } else {
    lines.push(`Title: ${clean(selection.title || selection.handle, 180)}`);
    lines.push(`Handle: ${clean(selection.handle, 100)}`);
    lines.push(`Quantity: ${clean(selection.quantity, 8)}`);
    lines.push(`Delivered total: ${money(selection.total)}`);
    lines.push(`Source: ${sourceUrl(selection.url)}`);
    lines.push(`Evidence: ${clean(selection.evidence || "Not recorded", 240)}`);
  }

  addSection(lines, "Human decision");
  const decision = snapshot.humanDecision;
  if (!decision) {
    lines.push("Status: Awaiting a human decision or no proposal was created.");
  } else {
    lines.push(`Status: ${clean(decision.status, 40)}`);
    lines.push(`Recorded: ${clean(decision.recordedAt || "Not recorded", 40)}`);
    lines.push(`Order created: No`);
    lines.push(`Payment handled: No`);
  }

  addSection(lines, "Decision activity");
  const activity = Array.isArray(snapshot.activity) ? snapshot.activity : [];
  if (!activity.length) lines.push("No activity was recorded.");
  for (const item of activity.slice(0, 20)) {
    lines.push(`- ${clean(item.time, 40)} | ${clean(item.actor, 80)} | ${clean(item.tool, 100)} | ${clean(item.originId, 64)}`);
  }

  addSection(lines, "Trust boundary");
  lines.push("This dossier records research, itinerary planning, and a human decision. Agentic did not create an order or booking, contact a provider, access an account, process payment, or operate merchant checkout.");
  return `${lines.join("\n").trim()}\n`;
}
