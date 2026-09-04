import type { DecisionVertical, ProfileFact, SubjectKind } from "./profile";

export type RetailIntent = "gift" | "self-treat";
export type DecisionValue = string | number | boolean | Array<string | number | boolean>;
export type DecisionOutput = "shortlist" | "single-choice" | "package";

export type DecisionConstraintKind =
  | "location"
  | "date-range"
  | "party-size"
  | "delivery-deadline"
  | "age-suitability"
  | "availability"
  | "accessibility"
  | "dietary"
  | "must-have"
  | "avoid"
  | "existing-item"
  | "credential"
  | "equipment"
  | "service-area"
  | "schedule"
  | "custom";

export type DecisionPreferenceKind =
  | "theme"
  | "interest"
  | "experience"
  | "pace"
  | "novelty"
  | "condition"
  | "price"
  | "returns"
  | "delivery"
  | "lodging-style"
  | "activity-level"
  | "dining"
  | "role-style"
  | "custom";

export type DecisionConstraint = {
  id: string;
  kind: DecisionConstraintKind;
  label: string;
  value: DecisionValue;
  source: "current-request" | "profile";
  factId: string | null;
};

export type DecisionPreference = {
  id: string;
  kind: DecisionPreferenceKind;
  label: string;
  value: DecisionValue;
  weight: "low" | "medium" | "high";
  source: "current-request" | "profile";
  factId: string | null;
};

export type BudgetEnvelope = {
  currencyCode: string;
  targetAmount: string | null;
  maximumAmount: string | null;
  includesTaxes: boolean | null;
  includesFees: boolean | null;
  contingencyPercent: number;
};

export type DecisionLocation = {
  label: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  timezone: string | null;
  flexible: boolean;
};

export type DecisionTimeWindow = {
  start: string | null;
  end: string | null;
  timezone: string | null;
  flexible: boolean;
};

export type MissingInformation = {
  id: string;
  question: string;
  impact: string;
  required: boolean;
};

export type DecisionBrief = {
  version: "1";
  id: string;
  vertical: DecisionVertical;
  goal: string;
  subjectIds: string[];
  intent?: RetailIntent | null;
  subjectKind?: SubjectKind | null;
  occasion?: string | null;
  occasionDeadline?: string | null;
  selectedFactIds: string[];
  decisionOnlyFacts: ProfileFact[];
  hardConstraints: DecisionConstraint[];
  softPreferences: DecisionPreference[];
  budget: BudgetEnvelope | null;
  location: DecisionLocation | null;
  timeWindow: DecisionTimeWindow | null;
  output: DecisionOutput;
  missingInformation: MissingInformation[];
  createdAt: string;
};

export type DecisionContext = {
  brief: DecisionBrief;
  selectedFacts: ProfileFact[];
};
