import type {
  BudgetEnvelope,
  DecisionBrief,
  DecisionConstraint,
  DecisionConstraintKind,
  DecisionContext,
  DecisionLocation,
  DecisionOutput,
  DecisionPreference,
  DecisionPreferenceKind,
  DecisionTimeWindow,
  DecisionValue,
  MissingInformation,
  RetailIntent,
} from "./decision-types";
import {
  projectProfileFacts,
  validateProfileFact,
  type DecisionVertical,
  type ProfileFact,
  type SubjectKind,
} from "./profile";

const BRIEF_KEYS = new Set([
  "version",
  "id",
  "vertical",
  "goal",
  "subjectIds",
  "intent",
  "subjectKind",
  "occasion",
  "occasionDeadline",
  "selectedFactIds",
  "decisionOnlyFacts",
  "hardConstraints",
  "softPreferences",
  "budget",
  "location",
  "timeWindow",
  "output",
  "missingInformation",
  "createdAt",
]);
const CONSTRAINT_KEYS = new Set(["id", "kind", "label", "value", "source", "factId"]);
const PREFERENCE_KEYS = new Set(["id", "kind", "label", "value", "weight", "source", "factId"]);
const BUDGET_KEYS = new Set(["currencyCode", "targetAmount", "maximumAmount", "includesTaxes", "includesFees", "contingencyPercent"]);
const LOCATION_KEYS = new Set(["label", "city", "region", "countryCode", "timezone", "flexible"]);
const TIME_WINDOW_KEYS = new Set(["start", "end", "timezone", "flexible"]);
const MISSING_INFORMATION_KEYS = new Set(["id", "question", "impact", "required"]);
const CONTEXT_REQUEST_KEYS = new Set(["brief", "selectedFacts"]);
const VERTICALS = ["vacation", "gift", "date", "staffing"] as const;
const OUTPUTS = ["shortlist", "single-choice", "package"] as const;
const SUBJECT_KINDS = ["self", "recipient", "partner", "collaborator"] as const;
const CONSTRAINT_KINDS = [
  "location",
  "date-range",
  "party-size",
  "delivery-deadline",
  "age-suitability",
  "availability",
  "accessibility",
  "dietary",
  "must-have",
  "avoid",
  "existing-item",
  "credential",
  "equipment",
  "service-area",
  "schedule",
  "custom",
] as const;
const PREFERENCE_KINDS = [
  "theme",
  "interest",
  "experience",
  "pace",
  "novelty",
  "condition",
  "price",
  "returns",
  "delivery",
  "lodging-style",
  "activity-level",
  "dining",
  "role-style",
  "custom",
] as const;
const SOURCES = ["current-request", "profile"] as const;
const WEIGHTS = ["low", "medium", "high"] as const;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/;
const MONEY_PATTERN = /^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/;
const DATE_OR_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new RangeError(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
}

function boundedString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new RangeError(`${label} must be a string.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maximum) {
    throw new RangeError(`${label} must be between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function nullableString(value: unknown, label: string, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return boundedString(value, label, maximum);
}

function identifier(value: unknown, label: string): string {
  const normalized = boundedString(value, label, 64);
  if (!ID_PATTERN.test(normalized)) throw new RangeError(`${label} has an unsupported format.`);
  return normalized;
}

function enumValue<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RangeError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new RangeError(`${label} must be a boolean.`);
  return value;
}

function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === null || value === undefined) return null;
  return booleanValue(value, label);
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new RangeError(`${label} must be an ISO timestamp.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RangeError(`${label} must be an ISO timestamp.`);
  return new Date(milliseconds).toISOString();
}

function scalarDecisionValue(value: unknown, label: string): string | number | boolean {
  if (typeof value === "string") return boundedString(value, label, 240);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) throw new RangeError(`${label} is out of range.`);
    return value;
  }
  if (typeof value === "boolean") return value;
  throw new RangeError(`${label} must be a string, number, or boolean.`);
}

function decisionValue(value: unknown, label: string): DecisionValue {
  if (!Array.isArray(value)) return scalarDecisionValue(value, label);
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new RangeError(`${label} must be a scalar or an array containing 1 to 12 scalar values.`);
  }
  return value.map((item, index) => scalarDecisionValue(item, `${label} item ${index + 1}`));
}

function identifierArray(value: unknown, label: string, maximum: number, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw new RangeError(`${label} must contain ${allowEmpty ? "0" : "1"} to ${maximum} ids.`);
  }
  const normalized = value.map((item) => identifier(item, label));
  if (new Set(normalized).size !== normalized.length) throw new RangeError(`${label} must not contain duplicates.`);
  return normalized;
}

function recordArray<T>(value: unknown, label: string, maximum: number, validator: (item: unknown, index: number) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new RangeError(`${label} must contain no more than ${maximum} items.`);
  return value.map(validator);
}

function validateConstraint(input: unknown, index: number): DecisionConstraint {
  const value = objectValue(input, `Hard constraint ${index + 1}`);
  rejectUnknownKeys(value, CONSTRAINT_KEYS, `Hard constraint ${index + 1}`);
  const source = enumValue(value.source, `Hard constraint ${index + 1} source`, SOURCES);
  const factId = value.factId === null || value.factId === undefined ? null : identifier(value.factId, `Hard constraint ${index + 1} factId`);
  if ((source === "profile") !== Boolean(factId)) {
    throw new RangeError(`Hard constraint ${index + 1} must reference a fact only when its source is profile.`);
  }
  return {
    id: identifier(value.id, `Hard constraint ${index + 1} id`),
    kind: enumValue<DecisionConstraintKind>(value.kind, `Hard constraint ${index + 1} kind`, CONSTRAINT_KINDS),
    label: boundedString(value.label, `Hard constraint ${index + 1} label`, 100),
    value: decisionValue(value.value, `Hard constraint ${index + 1} value`),
    source,
    factId,
  };
}

function validatePreference(input: unknown, index: number): DecisionPreference {
  const value = objectValue(input, `Soft preference ${index + 1}`);
  rejectUnknownKeys(value, PREFERENCE_KEYS, `Soft preference ${index + 1}`);
  const source = enumValue(value.source, `Soft preference ${index + 1} source`, SOURCES);
  const factId = value.factId === null || value.factId === undefined ? null : identifier(value.factId, `Soft preference ${index + 1} factId`);
  if ((source === "profile") !== Boolean(factId)) {
    throw new RangeError(`Soft preference ${index + 1} must reference a fact only when its source is profile.`);
  }
  return {
    id: identifier(value.id, `Soft preference ${index + 1} id`),
    kind: enumValue<DecisionPreferenceKind>(value.kind, `Soft preference ${index + 1} kind`, PREFERENCE_KINDS),
    label: boundedString(value.label, `Soft preference ${index + 1} label`, 100),
    value: decisionValue(value.value, `Soft preference ${index + 1} value`),
    weight: enumValue(value.weight, `Soft preference ${index + 1} weight`, WEIGHTS),
    source,
    factId,
  };
}

function moneyAmount(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !MONEY_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a non-negative decimal string with no more than two decimal places.`);
  }
  return Number(value).toFixed(2);
}

function validateBudget(input: unknown): BudgetEnvelope | null {
  if (input === null || input === undefined) return null;
  const value = objectValue(input, "Decision budget");
  rejectUnknownKeys(value, BUDGET_KEYS, "Decision budget");
  const currencyCode = boundedString(value.currencyCode, "Decision budget currencyCode", 3).toLocaleUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new RangeError("Decision budget currencyCode must use three letters.");
  const targetAmount = moneyAmount(value.targetAmount, "Decision budget targetAmount");
  const maximumAmount = moneyAmount(value.maximumAmount, "Decision budget maximumAmount");
  if (targetAmount === null && maximumAmount === null) throw new RangeError("Decision budget needs a targetAmount or maximumAmount.");
  if (targetAmount !== null && maximumAmount !== null && Number(targetAmount) > Number(maximumAmount)) {
    throw new RangeError("Decision budget targetAmount cannot exceed maximumAmount.");
  }
  if (!Number.isInteger(value.contingencyPercent) || Number(value.contingencyPercent) < 0 || Number(value.contingencyPercent) > 30) {
    throw new RangeError("Decision budget contingencyPercent must be an integer from 0 to 30.");
  }
  return {
    currencyCode,
    targetAmount,
    maximumAmount,
    includesTaxes: nullableBoolean(value.includesTaxes, "Decision budget includesTaxes"),
    includesFees: nullableBoolean(value.includesFees, "Decision budget includesFees"),
    contingencyPercent: Number(value.contingencyPercent),
  };
}

function validateLocation(input: unknown): DecisionLocation | null {
  if (input === null || input === undefined) return null;
  const value = objectValue(input, "Decision location");
  rejectUnknownKeys(value, LOCATION_KEYS, "Decision location");
  const countryCode = nullableString(value.countryCode, "Decision location countryCode", 2)?.toLocaleUpperCase() ?? null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new RangeError("Decision location countryCode must use two letters.");
  return {
    label: boundedString(value.label, "Decision location label", 100),
    city: nullableString(value.city, "Decision location city", 80),
    region: nullableString(value.region, "Decision location region", 80),
    countryCode,
    timezone: nullableString(value.timezone, "Decision location timezone", 64),
    flexible: booleanValue(value.flexible, "Decision location flexible"),
  };
}

function nullableDateOrTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !DATE_OR_TIMESTAMP_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RangeError(`${label} must be a calendar date or ISO timestamp.`);
  }
  return value;
}

function validateTimeWindow(input: unknown): DecisionTimeWindow | null {
  if (input === null || input === undefined) return null;
  const value = objectValue(input, "Decision timeWindow");
  rejectUnknownKeys(value, TIME_WINDOW_KEYS, "Decision timeWindow");
  const start = nullableDateOrTimestamp(value.start, "Decision timeWindow start");
  const end = nullableDateOrTimestamp(value.end, "Decision timeWindow end");
  if (start && end && Date.parse(start) > Date.parse(end)) throw new RangeError("Decision timeWindow start cannot be later than end.");
  return {
    start,
    end,
    timezone: nullableString(value.timezone, "Decision timeWindow timezone", 64),
    flexible: booleanValue(value.flexible, "Decision timeWindow flexible"),
  };
}

function validateMissingInformation(input: unknown, index: number): MissingInformation {
  const value = objectValue(input, `Missing information ${index + 1}`);
  rejectUnknownKeys(value, MISSING_INFORMATION_KEYS, `Missing information ${index + 1}`);
  return {
    id: identifier(value.id, `Missing information ${index + 1} id`),
    question: boundedString(value.question, `Missing information ${index + 1} question`, 180),
    impact: boundedString(value.impact, `Missing information ${index + 1} impact`, 180),
    required: booleanValue(value.required, `Missing information ${index + 1} required`),
  };
}

function uniqueRecordIds(records: ReadonlyArray<{ id: string }>, label: string): void {
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new RangeError(`${label} ids must not contain duplicates.`);
}

export function validateDecisionBrief(input: unknown): DecisionBrief {
  const value = objectValue(input, "Decision brief");
  rejectUnknownKeys(value, BRIEF_KEYS, "Decision brief");
  if (value.version !== "1") throw new RangeError("Decision brief version must be 1.");
  const subjectIds = identifierArray(value.subjectIds, "Decision subjectIds", 8, false);
  const selectedFactIds = identifierArray(value.selectedFactIds, "Decision selectedFactIds", 24, true);
  const decisionOnlyFacts = recordArray(value.decisionOnlyFacts, "Decision decisionOnlyFacts", 12, (item) => validateProfileFact(item));
  const hardConstraints = recordArray(value.hardConstraints, "Decision hardConstraints", 24, validateConstraint);
  const softPreferences = recordArray(value.softPreferences, "Decision softPreferences", 24, validatePreference);
  const missingInformation = recordArray(value.missingInformation, "Decision missingInformation", 8, validateMissingInformation);
  uniqueRecordIds(decisionOnlyFacts, "Decision-only fact");
  uniqueRecordIds(hardConstraints, "Hard constraint");
  uniqueRecordIds(softPreferences, "Soft preference");
  uniqueRecordIds(missingInformation, "Missing information");
  const selectedFactSet = new Set(selectedFactIds);
  const decisionOnlyFactIds = new Set(decisionOnlyFacts.map((fact) => fact.id));
  if ([...decisionOnlyFactIds].some((id) => selectedFactSet.has(id))) {
    throw new RangeError("Decision-only fact ids must not duplicate saved selectedFactIds.");
  }
  const allFactIds = new Set([...selectedFactIds, ...decisionOnlyFactIds]);
  for (const item of [...hardConstraints, ...softPreferences]) {
    if (item.factId && !allFactIds.has(item.factId)) throw new RangeError(`${item.id} references a fact that is not part of this decision.`);
  }
  for (const fact of decisionOnlyFacts) {
    if (!subjectIds.includes(fact.subjectId)) throw new RangeError(`Decision-only fact ${fact.id} does not belong to a decision subject.`);
  }
  const vertical = enumValue<DecisionVertical>(value.vertical, "Decision vertical", VERTICALS);
  for (const fact of decisionOnlyFacts) {
    if (!fact.allowedUses.includes(vertical)) throw new RangeError(`Decision-only fact ${fact.id} is not allowed for ${vertical} decisions.`);
  }
  const intent = value.intent === undefined || value.intent === null
    ? null
    : enumValue<RetailIntent>(value.intent, "Decision brief intent", ["gift", "self-treat"]);
  const subjectKind = value.subjectKind === undefined || value.subjectKind === null
    ? null
    : enumValue<SubjectKind>(value.subjectKind, "Decision brief subjectKind", SUBJECT_KINDS);
  const occasion = nullableString(value.occasion, "Decision brief occasion", 80);
  const occasionDeadline = nullableDateOrTimestamp(value.occasionDeadline, "Decision brief occasionDeadline");

  if (intent === "self-treat" && subjectKind !== null && subjectKind !== "self") {
    throw new RangeError("self-treat intent requires a self subject.");
  }
  if (occasionDeadline && Date.parse(occasionDeadline) < Date.now()) {
    throw new RangeError("Occasion deadline cannot be in the past.");
  }

  return {
    version: "1",
    id: identifier(value.id, "Decision brief id"),
    vertical,
    goal: boundedString(value.goal, "Decision goal", 240),
    subjectIds,
    intent,
    subjectKind,
    occasion,
    occasionDeadline,
    selectedFactIds,
    decisionOnlyFacts,
    hardConstraints,
    softPreferences,
    budget: validateBudget(value.budget),
    location: validateLocation(value.location),
    timeWindow: validateTimeWindow(value.timeWindow),
    output: enumValue<DecisionOutput>(value.output, "Decision output", OUTPUTS),
    missingInformation,
    createdAt: timestamp(value.createdAt, "Decision createdAt"),
  };
}

export function buildDecisionContext(
  input: unknown,
  savedFacts: readonly ProfileFact[],
  now = Date.now(),
): DecisionContext {
  const brief = validateDecisionBrief(input);
  const selectedFacts = projectProfileFacts(savedFacts, brief.selectedFactIds, brief.subjectIds, brief.vertical, now);
  return { brief, selectedFacts: [...selectedFacts, ...brief.decisionOnlyFacts] };
}

export function validateDecisionContextRequest(input: unknown, now = Date.now()): DecisionContext {
  const value = objectValue(input, "Decision context");
  rejectUnknownKeys(value, CONTEXT_REQUEST_KEYS, "Decision context");
  const selectedFacts = recordArray(value.selectedFacts, "Decision selectedFacts", 24, (item) => validateProfileFact(item));
  uniqueRecordIds(selectedFacts, "Selected fact");
  const brief = validateDecisionBrief(value.brief);
  const providedIds = new Set(selectedFacts.map((fact) => fact.id));
  if (providedIds.size !== brief.selectedFactIds.length || brief.selectedFactIds.some((id) => !providedIds.has(id))) {
    throw new RangeError("Decision selectedFacts must contain exactly the saved facts named by selectedFactIds.");
  }
  return buildDecisionContext(brief, selectedFacts, now);
}
