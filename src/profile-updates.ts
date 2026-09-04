import type { DecisionVertical, ProfileFactKind } from "./profile";

export type DecisionOutcome = "selected" | "completed" | "not-for-me";
export type MemoryVertical = "date" | "vacation";

export type ProfileFactDraft = {
  version: "1";
  id: string;
  subjectId: "profile-self";
  kind: Extract<ProfileFactKind, "liked-experience" | "disliked-experience">;
  value: string;
  source: "inferred-pending-confirmation";
  confidence: "tentative";
  sensitivity: "private";
  lifeStage: "recent";
  allowedUses: MemoryVertical[];
  lastConfirmedAt: null;
  expiresAt: null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileUpdateProposal = {
  version: "1";
  id: string;
  decisionId: string;
  vertical: MemoryVertical;
  outcome: DecisionOutcome;
  option: {
    id: string;
    title: string;
  };
  operation: "add";
  factDraft: ProfileFactDraft;
  reason: string;
  handling: {
    persistence: "none";
    cache: "no-store";
    approvalStatus: "awaiting-human-confirmation";
    availableActions: ["approve", "edit", "reject"];
  };
};

const INPUT_KEYS = new Set(["decisionId", "vertical", "optionId", "optionTitle", "outcome", "feedback", "allowedUses"]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/;
const OUTCOMES = ["selected", "completed", "not-for-me"] as const;
const MEMORY_VERTICALS = ["date", "vacation"] as const;

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("Profile update input must be an object.");
  }
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new RangeError(`${label} must be a string.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maximum) {
    throw new RangeError(`${label} must be between 1 and ${maximum} characters.`);
  }
  return normalized;
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

function allowedUses(value: unknown, vertical: MemoryVertical): MemoryVertical[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MEMORY_VERTICALS.length) {
    throw new RangeError("allowedUses must contain one or two supported decision types.");
  }
  const normalized = value.map((item) => enumValue(item, "allowedUses", MEMORY_VERTICALS));
  if (new Set(normalized).size !== normalized.length) throw new RangeError("allowedUses must not contain duplicates.");
  if (!normalized.includes(vertical)) throw new RangeError(`allowedUses must include the source ${vertical} decision type.`);
  return normalized;
}

export function proposeProfileUpdate(input: unknown, now = new Date()): ProfileUpdateProposal {
  const value = objectValue(input);
  const unknown = Object.keys(value).filter((key) => !INPUT_KEYS.has(key));
  if (unknown.length) throw new RangeError(`Profile update input contains unsupported fields: ${unknown.join(", ")}.`);
  const vertical = enumValue<MemoryVertical>(value.vertical, "vertical", MEMORY_VERTICALS);
  const outcome = enumValue(value.outcome, "outcome", OUTCOMES);
  const optionTitle = boundedString(value.optionTitle, "optionTitle", 140);
  const feedback = boundedString(value.feedback, "feedback", 180);
  const uses = allowedUses(value.allowedUses, vertical);
  const timestamp = now.toISOString();
  const positive = outcome !== "not-for-me";
  return {
    version: "1",
    id: `proposal-${crypto.randomUUID()}`,
    decisionId: identifier(value.decisionId, "decisionId"),
    vertical,
    outcome,
    option: {
      id: identifier(value.optionId, "optionId"),
      title: optionTitle,
    },
    operation: "add",
    factDraft: {
      version: "1",
      id: `memory-${crypto.randomUUID()}`,
      subjectId: "profile-self",
      kind: positive ? "liked-experience" : "disliked-experience",
      value: `${positive ? "Enjoyed" : "Did not enjoy"} ${optionTitle}: ${feedback}`,
      source: "inferred-pending-confirmation",
      confidence: "tentative",
      sensitivity: "private",
      lifeStage: "recent",
      allowedUses: uses,
      lastConfirmedAt: null,
      expiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    reason: positive
      ? "Your outcome could improve later experience matching, but it is not a profile fact until you approve or edit it."
      : "Your outcome could prevent a similar suggestion later, but it is not a profile fact until you approve or edit it.",
    handling: {
      persistence: "none",
      cache: "no-store",
      approvalStatus: "awaiting-human-confirmation",
      availableActions: ["approve", "edit", "reject"],
    },
  };
}

export function supportsOutcomeMemory(vertical: DecisionVertical): vertical is MemoryVertical {
  return vertical === "date" || vertical === "vacation";
}
