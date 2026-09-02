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
  lines.push(`Goal: ${clean(goal.query || "No ranked research goal recorded.", 300)}`);
  lines.push(`Maximum delivered price: ${goal.maxDeliveredPrice === null || goal.maxDeliveredPrice === undefined ? "Not set" : `${clean(goal.maxDeliveredPrice, 24)} USD`}`);

  addSection(lines, "Ranking rubric");
  const rubric = snapshot.rubric || {};
  const rubricEntries = Object.entries(rubric);
  lines.push(rubricEntries.length
    ? rubricEntries.map(([name, score]) => `${clean(name, 40)} ${clean(score, 12)}`).join(" | ")
    : "No ranking rubric was used.");

  addSection(lines, "Ranked options");
  const rankedOptions = Array.isArray(snapshot.rankedOptions) ? snapshot.rankedOptions : [];
  if (!rankedOptions.length) lines.push("No ranked options were recorded.");
  for (const option of rankedOptions.slice(0, 8)) {
    lines.push(`${clean(option.rank, 4)}. ${clean(option.title || option.handle, 180)} | score ${clean(option.score, 12)} | ${money(option.deliveredPrice)} delivered`);
    lines.push(`   Handle: ${clean(option.handle, 100)}`);
    lines.push(`   Source: ${sourceUrl(option.url)}`);
    if (option.factors) lines.push(`   Factors: ${Object.entries(option.factors).map(([name, score]) => `${clean(name, 40)} ${clean(score, 12)}`).join(" | ")}`);
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
  lines.push("This dossier records research and a human decision. Agentic did not create an order, access an account, process payment, or operate merchant checkout.");
  return `${lines.join("\n").trim()}\n`;
}
