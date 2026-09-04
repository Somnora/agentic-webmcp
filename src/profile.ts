export type SubjectKind = "self" | "recipient" | "partner" | "collaborator";
export type AgeBand = "child" | "teen" | "adult" | "older-adult" | "not-provided";
export type ProfilePersistence = "decision-only" | "saved-on-device" | "saved-to-account";
export type DecisionVertical = "shopping" | "vacation" | "gift" | "date" | "staffing";

export type ProfileSubject = {
  version: "1";
  id: string;
  ownerId: string | null;
  kind: SubjectKind;
  displayLabel: string;
  relationship: string | null;
  ageBand: AgeBand;
  location: string | null;
  persistence: ProfilePersistence;
  createdAt: string;
  updatedAt: string;
};

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

export type ProfileFactSource = "user-stated" | "imported" | "inferred-and-confirmed";
export type ProfileFactValue = string | number | boolean | Array<string | number | boolean>;

export type ProfileFact = {
  version: "1";
  id: string;
  subjectId: string;
  kind: ProfileFactKind;
  value: ProfileFactValue;
  source: ProfileFactSource;
  confidence: "confirmed" | "tentative";
  sensitivity: "standard" | "private";
  lifeStage: "childhood" | "adulthood" | "honeymoon" | "recent" | null;
  allowedUses: DecisionVertical[];
  lastConfirmedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SUBJECT_KEYS = new Set([
  "version",
  "id",
  "ownerId",
  "kind",
  "displayLabel",
  "relationship",
  "ageBand",
  "location",
  "persistence",
  "createdAt",
  "updatedAt",
]);
const FACT_KEYS = new Set([
  "version",
  "id",
  "subjectId",
  "kind",
  "value",
  "source",
  "confidence",
  "sensitivity",
  "lifeStage",
  "allowedUses",
  "lastConfirmedAt",
  "expiresAt",
  "createdAt",
  "updatedAt",
]);
const SUBJECT_KINDS = ["self", "recipient", "partner", "collaborator"] as const;
const AGE_BANDS = ["child", "teen", "adult", "older-adult", "not-provided"] as const;
const PERSISTENCE_VALUES = ["decision-only", "saved-on-device", "saved-to-account"] as const;
const FACT_KINDS = [
  "visited-place",
  "liked-experience",
  "disliked-experience",
  "fond-memory-signal",
  "previous-activity",
  "interest",
  "existing-item",
  "avoidance",
  "dietary-preference",
  "accessibility-need",
  "pace-preference",
  "budget-preference",
  "schedule-preference",
  "skill-or-role-preference",
] as const;
const FACT_SOURCES = ["user-stated", "imported", "inferred-and-confirmed"] as const;
const CONFIDENCE_VALUES = ["confirmed", "tentative"] as const;
const SENSITIVITY_VALUES = ["standard", "private"] as const;
const LIFE_STAGES = ["childhood", "adulthood", "honeymoon", "recent"] as const;
const DECISION_VERTICALS = ["shopping", "vacation", "gift", "date", "staffing"] as const;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/;
const MAX_PROFILE_FACTS_PER_DECISION = 24;

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object.`);
  }
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
  if (!ID_PATTERN.test(normalized)) {
    throw new RangeError(`${label} must begin with an alphanumeric character and contain only letters, numbers, colons, underscores, or hyphens.`);
  }
  return normalized;
}

function enumValue<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RangeError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new RangeError(`${label} must be an ISO timestamp.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RangeError(`${label} must be an ISO timestamp.`);
  return new Date(milliseconds).toISOString();
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value, label);
}

function profileFactValue(value: unknown): ProfileFactValue {
  if (typeof value === "string") return boundedString(value, "Profile fact value", 240);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) throw new RangeError("Profile fact number is out of range.");
    return value;
  }
  if (typeof value === "boolean") return value;
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new RangeError("Profile fact value must be a scalar or an array containing 1 to 12 scalar values.");
  }
  return value.map((item, index) => {
    if (typeof item === "string") return boundedString(item, `Profile fact value ${index + 1}`, 120);
    if (typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 1_000_000) return item;
    if (typeof item === "boolean") return item;
    throw new RangeError("Profile fact arrays may contain only bounded strings, numbers, or booleans.");
  });
}

function uniqueEnums<T extends string>(value: unknown, label: string, allowed: readonly T[], maximum: number): T[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new RangeError(`${label} must contain between 1 and ${maximum} values.`);
  }
  const normalized = value.map((item) => enumValue(item, label, allowed));
  if (new Set(normalized).size !== normalized.length) throw new RangeError(`${label} must not contain duplicates.`);
  return normalized;
}

export function validateProfileSubject(input: unknown): ProfileSubject {
  const value = objectValue(input, "Profile subject");
  rejectUnknownKeys(value, SUBJECT_KEYS, "Profile subject");
  if (value.version !== "1") throw new RangeError("Profile subject version must be 1.");
  const createdAt = timestamp(value.createdAt, "Profile subject createdAt");
  const updatedAt = timestamp(value.updatedAt, "Profile subject updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError("Profile subject updatedAt cannot be earlier than createdAt.");
  }
  return {
    version: "1",
    id: identifier(value.id, "Profile subject id"),
    ownerId: value.ownerId === null || value.ownerId === undefined ? null : identifier(value.ownerId, "Profile owner id"),
    kind: enumValue(value.kind, "Profile subject kind", SUBJECT_KINDS),
    displayLabel: boundedString(value.displayLabel, "Profile subject label", 60),
    relationship: value.kind === "self" ? null : nullableString(value.relationship, "Profile subject relationship", 60),
    ageBand: enumValue(value.ageBand, "Profile subject ageBand", AGE_BANDS),
    location: nullableString(value.location, "Profile subject location", 120),
    persistence: enumValue(value.persistence, "Profile subject persistence", PERSISTENCE_VALUES),
    createdAt,
    updatedAt,
  };
}

export function validateProfileFact(input: unknown): ProfileFact {
  const value = objectValue(input, "Profile fact");
  rejectUnknownKeys(value, FACT_KEYS, "Profile fact");
  if (value.version !== "1") throw new RangeError("Profile fact version must be 1.");
  const source = enumValue(value.source, "Profile fact source", FACT_SOURCES);
  const confidence = enumValue(value.confidence, "Profile fact confidence", CONFIDENCE_VALUES);
  if (source === "inferred-and-confirmed" && confidence !== "confirmed") {
    throw new RangeError("An inferred profile fact must be confirmed before it can enter the profile.");
  }
  const lastConfirmedAt = timestamp(value.lastConfirmedAt, "Profile fact lastConfirmedAt");
  const expiresAt = nullableTimestamp(value.expiresAt, "Profile fact expiresAt");
  const createdAt = timestamp(value.createdAt, "Profile fact createdAt");
  const updatedAt = timestamp(value.updatedAt, "Profile fact updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError("Profile fact updatedAt cannot be earlier than createdAt.");
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(lastConfirmedAt)) {
    throw new RangeError("Profile fact expiresAt must be later than lastConfirmedAt.");
  }
  const lifeStage = value.lifeStage === null || value.lifeStage === undefined
    ? null
    : enumValue(value.lifeStage, "Profile fact lifeStage", LIFE_STAGES);
  return {
    version: "1",
    id: identifier(value.id, "Profile fact id"),
    subjectId: identifier(value.subjectId, "Profile fact subjectId"),
    kind: enumValue(value.kind, "Profile fact kind", FACT_KINDS),
    value: profileFactValue(value.value),
    source,
    confidence,
    sensitivity: enumValue(value.sensitivity, "Profile fact sensitivity", SENSITIVITY_VALUES),
    lifeStage,
    allowedUses: uniqueEnums(value.allowedUses, "Profile fact allowedUses", DECISION_VERTICALS, 5),
    lastConfirmedAt,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

export function projectProfileFacts(
  facts: readonly ProfileFact[],
  selectedFactIds: readonly string[],
  subjectIds: readonly string[],
  vertical: DecisionVertical,
  now = Date.now(),
): ProfileFact[] {
  if (selectedFactIds.length > MAX_PROFILE_FACTS_PER_DECISION) {
    throw new RangeError(`A decision may use no more than ${MAX_PROFILE_FACTS_PER_DECISION} saved profile facts.`);
  }
  if (new Set(selectedFactIds).size !== selectedFactIds.length) {
    throw new RangeError("Selected profile fact ids must not contain duplicates.");
  }
  const subjects = new Set(subjectIds);
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  return selectedFactIds.map((id) => {
    const fact = byId.get(id);
    if (!fact) throw new RangeError(`Selected profile fact ${id} was not found.`);
    if (!subjects.has(fact.subjectId)) throw new RangeError(`Selected profile fact ${id} does not belong to a decision subject.`);
    if (!fact.allowedUses.includes(vertical)) throw new RangeError(`Selected profile fact ${id} is not allowed for ${vertical} decisions.`);
    if (fact.expiresAt && Date.parse(fact.expiresAt) <= now) throw new RangeError(`Selected profile fact ${id} has expired.`);
    return fact;
  });
}

export function profileFactText(fact: ProfileFact): string {
  return Array.isArray(fact.value) ? fact.value.join(", ") : String(fact.value);
}
