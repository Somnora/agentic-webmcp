import type { DecisionConstraint, DecisionContext, DecisionValue } from "./decision-types";
import { money, type Money, type Offer, type ProviderCredential, type ServicePriceBasis } from "./offers";

export type StaffingGap = {
  role: string;
  reason: string;
  requiredCredentials: string[];
  requiredEquipment: string[];
};

export type StaffingScheduleGap = {
  role: string;
  date: string;
  reason: string;
};

export type ProximityFit = "local-match" | "cross-subregion-service";

export type StaffingAssignment = {
  role: string;
  offerHandle: string;
  offerTitle: string;
  providerId: string;
  providerName: string;
  providerVerification: {
    status: "controlled-demo" | "operator-attested";
    label: string;
    url: string;
    checkedAt: string;
  };
  serviceArea: {
    label: string;
    regions: string[];
    travelRadiusMiles: number | null;
    proximityFit: ProximityFit;
  };
  availability: {
    date: string;
    weekday: string;
    timezone: string;
    startLocal: string;
    endLocal: string;
  };
  credentialEvidence: Array<{
    id: string;
    label: string;
    status: ProviderCredential["status"];
    issuer: string | null;
    verificationLabel: string;
    checkedAt: string;
    expiresAt: string | null;
  }>;
  requiredCredentialMatches: string[];
  equipment: string[];
  requiredEquipmentMatches: string[];
  portfolioEvidence: Array<{
    title: string;
    category: string;
    verification: "controlled-demo" | "provider-attested";
  }>;
  price: {
    published: Money;
    basis: ServicePriceBasis;
    quoteMode: "published-rate" | "estimate-only";
    estimatedHours: number;
    publishedSubtotal: Money;
    planningHigh: Money;
  };
  sourceReview: {
    url: string;
    action: "human-only";
    transmittedInformation: string;
  };
};

export type StaffingCrewPlan = {
  id: string;
  label: string;
  title: string;
  status: "ready-for-review" | "needs-attention";
  score: number;
  projectDate: string;
  estimatedHours: number;
  requestedRoles: string[];
  assignments: StaffingAssignment[];
  missingRoles: StaffingGap[];
  scheduleGaps: StaffingScheduleGap[];
  budgetCeiling: Money;
  costs: {
    publishedSubtotal: Money;
    contingency: Money;
    planningHigh: Money;
    withinBudget: boolean;
    basis: string;
  };
  quoteAccounting: {
    publishedRateAssignments: number;
    estimateOnlyAssignments: number;
    unknownCosts: string[];
  };
  why: string;
  tradeoff: string;
  evidenceConfidence: string;
};

export type PersonalizedStaffingResult = {
  status: "planned" | "needs-attention";
  crews: StaffingCrewPlan[];
  staffing: {
    status: "applied" | "partial" | "not-applied";
    actionEligible: boolean;
    briefId: string;
    vertical: "staffing";
    handling: "request-only";
    providerSourceReview: "human-only";
    contactCapability: "unavailable";
    contractingCapability: "unavailable";
    unsupportedConstraints: Array<{ id: string; kind: string; label: string; reason: string }>;
    note: string;
  };
  warning?: string;
};

type RequirementMap = Map<string, string[]>;

const SUPPORTED_CONSTRAINT_KINDS = new Set([
  "location",
  "date-range",
  "availability",
  "must-have",
  "avoid",
  "credential",
  "equipment",
  "service-area",
  "schedule",
  "custom",
]);
const REQUIRED_VERIFIED_FIELDS = ["pricing", "availability", "provider", "priceBasis", "scheduling", "credentials", "serviceArea", "equipment", "portfolio"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function values(value: DecisionValue | undefined): string[] {
  const source = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [...new Set(source.map((item) => String(item).replace(/\s+/g, " ").trim().toLocaleLowerCase()).filter(Boolean))];
}

function canonical(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function exactOrContained(left: string, right: string): boolean {
  const leftValue = canonical(left);
  const rightValue = canonical(right);
  return leftValue === rightValue || leftValue.includes(rightValue) || rightValue.includes(leftValue);
}

function requirementMap(context: DecisionContext, kind: "credential" | "equipment"): RequirementMap {
  const output = new Map<string, string[]>();
  for (const constraint of context.brief.hardConstraints.filter((item) => item.kind === kind)) {
    for (const raw of values(constraint.value)) {
      const separator = raw.indexOf(":");
      if (separator < 1 || separator === raw.length - 1) {
        throw new RangeError(`${kind} requirements must use role: requirement.`);
      }
      const role = canonical(raw.slice(0, separator));
      const requirement = canonical(raw.slice(separator + 1));
      const existing = output.get(role) ?? [];
      output.set(role, [...new Set([...existing, requirement])]);
    }
  }
  return output;
}

function roleRequirements(map: RequirementMap, role: string): string[] {
  return [...map.entries()].flatMap(([requiredRole, requirements]) => exactOrContained(requiredRole, role) ? requirements : []);
}

function requiredRoles(context: DecisionContext): string[] {
  const roles = context.brief.hardConstraints
    .filter((item) => item.kind === "must-have")
    .flatMap((item) => values(item.value))
    .map(canonical);
  const unique = [...new Set(roles)];
  if (!unique.length || unique.length > 6) throw new RangeError("Staffing requires 1 to 6 explicit must-have roles.");
  return unique;
}

function projectDate(context: DecisionContext): string {
  const constraint = context.brief.hardConstraints.find((item) => item.kind === "date-range");
  const candidate = values(constraint?.value)[0] ?? context.brief.timeWindow?.start?.slice(0, 10) ?? "";
  if (!DATE_PATTERN.test(candidate)) throw new RangeError("Staffing requires a project date.");
  const [year, month, day] = candidate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw new RangeError("Staffing requires a real calendar date.");
  }
  return candidate;
}

function weekday(date: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

function scheduleHours(context: DecisionContext): { estimatedHours: number; startLocal: string; endLocal: string } {
  const hoursConstraint = context.brief.hardConstraints.find((item) => item.kind === "custom" && item.label.toLocaleLowerCase() === "estimated project hours");
  const raw = Array.isArray(hoursConstraint?.value) ? hoursConstraint.value[0] : hoursConstraint?.value;
  const estimatedHours = Number(raw ?? 8);
  if (!Number.isInteger(estimatedHours) || estimatedHours < 1 || estimatedHours > 16) {
    throw new RangeError("Estimated project hours must be an integer from 1 to 16.");
  }
  const startLocal = context.brief.timeWindow?.start?.slice(11, 16) || "08:00";
  const endLocal = context.brief.timeWindow?.end?.slice(11, 16) || "16:00";
  if (!/^\d{2}:\d{2}$/.test(startLocal) || !/^\d{2}:\d{2}$/.test(endLocal) || startLocal >= endLocal) {
    throw new RangeError("Staffing requires a valid local project schedule.");
  }
  return { estimatedHours, startLocal, endLocal };
}

function budgetCents(context: DecisionContext): number {
  const budget = context.brief.budget;
  if (!budget || budget.currencyCode !== "USD") throw new RangeError("Staffing currently requires a USD budget.");
  const amount = Number(budget.maximumAmount ?? budget.targetAmount);
  if (!Number.isFinite(amount) || amount < 100 || amount > 100_000) throw new RangeError("Staffing requires a maximum budget from 100 to 100000 USD.");
  return Math.round(amount * 100);
}

export type OahuSubregion = "honolulu" | "windward" | "north shore" | "central" | "leeward";

export const OAHU_SUBREGIONS: readonly OahuSubregion[] = [
  "honolulu",
  "windward",
  "north shore",
  "central",
  "leeward",
] as const;

// Hard-coded driving distances between Oahu subregions in miles.
// These distances are planning estimates, not verified travel measurements.
export const OAHU_DRIVING_DISTANCES: Record<OahuSubregion, Record<OahuSubregion, number>> = {
  honolulu: {
    honolulu: 0,
    windward: 14,
    central: 12,
    leeward: 22,
    "north shore": 30,
  },
  windward: {
    honolulu: 14,
    windward: 0,
    central: 15,
    leeward: 26,
    "north shore": 32,
  },
  central: {
    honolulu: 12,
    windward: 15,
    central: 0,
    leeward: 14,
    "north shore": 20,
  },
  leeward: {
    honolulu: 22,
    windward: 26,
    central: 14,
    leeward: 0,
    "north shore": 28,
  },
  "north shore": {
    honolulu: 30,
    windward: 32,
    central: 20,
    leeward: 28,
    "north shore": 0,
  },
};

export function getOahuDrivingDistance(from: OahuSubregion, to: OahuSubregion): number {
  return OAHU_DRIVING_DISTANCES[from][to];
}

const OAHU_CITY_SUBREGION_MAP: Record<string, OahuSubregion> = {
  // Honolulu
  honolulu: "honolulu",
  waikiki: "honolulu",
  manoa: "honolulu",
  kakaako: "honolulu",
  downtown: "honolulu",
  kahala: "honolulu",
  "east honolulu": "honolulu",
  makiki: "honolulu",
  kaimuki: "honolulu",
  "hawaii kai": "honolulu",
  kalihi: "honolulu",
  moanalua: "honolulu",
  nuuanu: "honolulu",
  palolo: "honolulu",
  "ala moana": "honolulu",

  // Windward
  windward: "windward",
  "windward oahu": "windward",
  kailua: "windward",
  kaneohe: "windward",
  waimanalo: "windward",
  kualoa: "windward",
  hauula: "windward",
  laie: "windward",
  kahaluu: "windward",

  // North Shore
  "north shore": "north shore",
  "north shore oahu": "north shore",
  haleiwa: "north shore",
  waimea: "north shore",
  kahuku: "north shore",
  "sunset beach": "north shore",
  "kawela bay": "north shore",
  waialua: "north shore",
  mokuleia: "north shore",

  // Central
  central: "central",
  "central oahu": "central",
  "pearl city": "central",
  aiea: "central",
  mililani: "central",
  wahiawa: "central",
  waipahu: "central",

  // Leeward
  leeward: "leeward",
  "leeward oahu": "leeward",
  kapolei: "leeward",
  "ewa beach": "leeward",
  ewa: "leeward",
  "ko olina": "leeward",
  waianae: "leeward",
  makaha: "leeward",
  nanakuli: "leeward",
  maille: "leeward",
};

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export function resolveOahuSubregion(text: string | null | undefined): OahuSubregion | null {
  if (!text) return null;
  const normalized = canonical(text);
  if (!normalized) return null;

  if (OAHU_CITY_SUBREGION_MAP[normalized]) {
    return OAHU_CITY_SUBREGION_MAP[normalized];
  }

  const sortedKeys = Object.keys(OAHU_CITY_SUBREGION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`(?:^|\\s)${escapeRegex(key)}(?:\\s|$)`);
    if (regex.test(normalized)) {
      return OAHU_CITY_SUBREGION_MAP[key]!;
    }
  }

  for (const subregion of OAHU_SUBREGIONS) {
    if (normalized.includes(subregion)) {
      return subregion;
    }
  }

  return null;
}

export function projectLocationName(context: DecisionContext): string {
  const loc = context.brief.location;
  if (!loc) return "the requested location";
  if (loc.label && !canonical(loc.label).includes("oahu hawaii") && canonical(loc.label) !== "oahu") {
    return loc.label;
  }
  if (loc.city && !canonical(loc.city).includes("oahu hawaii") && canonical(loc.city) !== "oahu") {
    return loc.city;
  }
  return loc.label || loc.city || "the requested location";
}

export function resolveProjectSubregion(context: DecisionContext): OahuSubregion | null {
  const loc = context.brief.location;
  if (loc?.city) {
    const subregion = resolveOahuSubregion(loc.city);
    if (subregion) return subregion;
  }
  if (loc?.label) {
    const subregion = resolveOahuSubregion(loc.label);
    if (subregion) return subregion;
  }
  for (const constraint of context.brief.hardConstraints.filter((c) => c.kind === "location")) {
    for (const val of values(constraint.value)) {
      const subregion = resolveOahuSubregion(val);
      if (subregion) return subregion;
    }
    const subregionFromLabel = resolveOahuSubregion(constraint.label);
    if (subregionFromLabel) return subregionFromLabel;
  }
  return null;
}

export function resolveProviderSubregion(offer: Offer): OahuSubregion | null {
  const city = offer.service?.location.city;
  if (city) {
    const subregion = resolveOahuSubregion(city);
    if (subregion) return subregion;
  }
  const region = offer.service?.location.region;
  if (region) {
    const subregion = resolveOahuSubregion(region);
    if (subregion) return subregion;
  }
  return null;
}

export function isIslandwideProvider(serviceArea: { label: string }): boolean {
  const norm = canonical(serviceArea.label);
  return norm.includes("islandwide") || norm.includes("production locations");
}

export function getDeclaredSubregions(serviceArea: { label: string; regions: readonly string[] }): Set<OahuSubregion> {
  const declared = new Set<OahuSubregion>();
  const text = canonical([serviceArea.label, ...serviceArea.regions].join(" "));
  for (const subregion of OAHU_SUBREGIONS) {
    if (text.includes(subregion)) {
      declared.add(subregion);
    }
  }
  for (const [town, subregion] of Object.entries(OAHU_CITY_SUBREGION_MAP)) {
    if (text.includes(town)) {
      declared.add(subregion);
    }
  }
  return declared;
}

export type GeographicEvaluation = {
  eligible: boolean;
  tier: 0 | 1 | 2;
  proximityFit?: ProximityFit;
  disqualificationReason?: "outside-service-area" | "radius-exceeded";
  distanceMiles: number;
  radiusLimit: number;
  providerSubregion: OahuSubregion | null;
  projectSubregion: OahuSubregion | null;
  projectLocationLabel: string;
};

export function evaluateGeographicProximity(offer: Offer, context: DecisionContext): GeographicEvaluation {
  const service = offer.service;
  const professional = service?.professional;
  const location = context.brief.location;

  const projectSubregion = resolveProjectSubregion(context);
  const providerSubregion = resolveProviderSubregion(offer);
  const locationLabel = projectLocationName(context);

  if (!service || !professional || !location || !projectSubregion || !providerSubregion) {
    return {
      eligible: false,
      tier: 0,
      disqualificationReason: "outside-service-area",
      distanceMiles: Infinity,
      radiusLimit: 0,
      providerSubregion,
      projectSubregion,
      projectLocationLabel: locationLabel,
    };
  }

  if (location.countryCode && service.location.countryCode !== location.countryCode) {
    return {
      eligible: false,
      tier: 0,
      disqualificationReason: "outside-service-area",
      distanceMiles: Infinity,
      radiusLimit: 0,
      providerSubregion,
      projectSubregion,
      projectLocationLabel: locationLabel,
    };
  }

  const distance = getOahuDrivingDistance(providerSubregion, projectSubregion);
  const travelRadius = professional.serviceArea.travelRadiusMiles ?? Infinity;
  const islandwide = isIslandwideProvider(professional.serviceArea);

  if (islandwide) {
    if (distance > travelRadius) {
      return {
        eligible: false,
        tier: 0,
        disqualificationReason: "radius-exceeded",
        distanceMiles: distance,
        radiusLimit: travelRadius,
        providerSubregion,
        projectSubregion,
        projectLocationLabel: locationLabel,
      };
    }
    const isLocal = providerSubregion === projectSubregion;
    return {
      eligible: true,
      tier: isLocal ? 1 : 2,
      proximityFit: isLocal ? "local-match" : "cross-subregion-service",
      distanceMiles: distance,
      radiusLimit: travelRadius,
      providerSubregion,
      projectSubregion,
      projectLocationLabel: locationLabel,
    };
  }

  const declaredSubregions = getDeclaredSubregions(professional.serviceArea);
  if (!declaredSubregions.has(projectSubregion)) {
    return {
      eligible: false,
      tier: 0,
      disqualificationReason: "outside-service-area",
      distanceMiles: distance,
      radiusLimit: travelRadius,
      providerSubregion,
      projectSubregion,
      projectLocationLabel: locationLabel,
    };
  }

  if (distance > travelRadius) {
    return {
      eligible: false,
      tier: 0,
      disqualificationReason: "radius-exceeded",
      distanceMiles: distance,
      radiusLimit: travelRadius,
      providerSubregion,
      projectSubregion,
      projectLocationLabel: locationLabel,
    };
  }

  const isLocal = providerSubregion === projectSubregion;
  return {
    eligible: true,
    tier: isLocal ? 1 : 2,
    proximityFit: isLocal ? "local-match" : "cross-subregion-service",
    distanceMiles: distance,
    radiusLimit: travelRadius,
    providerSubregion,
    projectSubregion,
    projectLocationLabel: locationLabel,
  };
}

export function locationMatches(offer: Offer, context: DecisionContext): boolean {
  return evaluateGeographicProximity(offer, context).eligible;
}

function evidenceVerified(offer: Offer): boolean {
  const verification = offer.provenance.verification;
  return offer.source.live
    && verification.state === "verified"
    && REQUIRED_VERIFIED_FIELDS.every((field) => verification.verifiedFields.includes(field));
}

function roleMatches(offer: Offer, role: string): boolean {
  return offer.service?.professional?.roles.some((candidate) => exactOrContained(candidate, role)) === true;
}

function scheduleWindow(offer: Offer, date: string, startLocal: string, endLocal: string) {
  const day = weekday(date);
  return offer.service?.scheduling.windows.find((window) => (
    window.weekday === day && window.startLocal <= startLocal && window.endLocal >= endLocal
  ));
}

function unexpiredControlledCredentials(offer: Offer, date: string): ProviderCredential[] {
  return (offer.service?.professional?.credentials ?? []).filter((credential) => (
    credential.status === "controlled-verified"
    && (!credential.expiresAt || Date.parse(credential.expiresAt) >= Date.parse(`${date}T23:59:59Z`))
  ));
}

function requirementsMatch(available: readonly string[], required: readonly string[]): boolean {
  return required.every((requirement) => available.some((candidate) => exactOrContained(candidate, requirement)));
}

function avoids(offer: Offer, exclusions: readonly string[]): boolean {
  if (!exclusions.length) return false;
  const service = offer.service!;
  const haystack = canonical([
    offer.title,
    offer.description,
    service.provider.displayName,
    ...(service.professional?.roles ?? []),
    ...(service.professional?.equipment ?? []),
  ].join(" "));
  return exclusions.some((term) => haystack.includes(canonical(term)));
}

function assignmentCostCents(offer: Offer, estimatedHours: number): number {
  const cents = Math.round(Number(offer.priceRange.min.amount) * 100);
  if (offer.service?.priceBasis === "hourly") return cents * estimatedHours;
  if (offer.service?.priceBasis === "fixed" || offer.service?.priceBasis === "estimate") return cents;
  return Number.POSITIVE_INFINITY;
}

function staffingCandidates(offers: readonly Offer[]): Offer[] {
  return offers.filter((offer) => (
    offer.service?.category === "professional-service"
    && Boolean(offer.service.professional)
    && Boolean(offer.service.provider.id)
    && Boolean(offer.service.provider.verificationSource)
    && offer.constraints.available
  ));
}

function gapReason(
  roleOffers: readonly Offer[],
  locationOffers: readonly Offer[],
  scheduleOffers: readonly Offer[],
  qualifiedOffers: readonly Offer[],
  requiredCredentials: readonly string[],
  requiredEquipment: readonly string[],
  context: DecisionContext,
): string {
  if (!roleOffers.length) return "No verified provider Offer declares this role.";
  if (!locationOffers.length) {
    const projectSubregion = resolveProjectSubregion(context);
    const locationLabel = projectLocationName(context);
    if (!projectSubregion) {
      return `The project location (${locationLabel}) service area could not be verified.`;
    }
    const evaluations = roleOffers.map((offer) => evaluateGeographicProximity(offer, context));
    const unverifiedProvider = evaluations.find((ev) => !ev.providerSubregion);
    if (unverifiedProvider) {
      return "Provider service area could not be verified for this role.";
    }
    const radiusExceeded = evaluations.find((ev) => ev.disqualificationReason === "radius-exceeded");
    if (radiusExceeded) {
      return `Role supply exists, but project location exceeds provider travel radius (distance exceeds ${radiusExceeded.radiusLimit} miles).`;
    }
    return `Role supply exists, but no provider serves the required project location: ${locationLabel} (outside provider service area).`;
  }
  if (!scheduleOffers.length) return "Role supply exists in the service area, but no provider covers the requested schedule.";
  if (!qualifiedOffers.length && requiredCredentials.length) return `No scheduled provider has every required controlled-verified credential: ${requiredCredentials.join(", ")}.`;
  if (!qualifiedOffers.length && requiredEquipment.length) return `No scheduled provider lists every required equipment item: ${requiredEquipment.join(", ")}.`;
  return "No provider met every hard staffing constraint.";
}

function unsupportedConstraints(constraints: readonly DecisionConstraint[]) {
  return constraints.flatMap((constraint) => {
    if (!SUPPORTED_CONSTRAINT_KINDS.has(constraint.kind)) {
      return [{ id: constraint.id, kind: constraint.kind, label: constraint.label, reason: "This hard constraint has no verified staffing evaluator." }];
    }
    if (constraint.kind === "custom" && constraint.label.toLocaleLowerCase() !== "estimated project hours") {
      return [{ id: constraint.id, kind: constraint.kind, label: constraint.label, reason: "Only the exact Estimated project hours custom constraint is supported." }];
    }
    return [];
  });
}

export function createPersonalizedStaffingPlans(context: DecisionContext, offers: readonly Offer[]): PersonalizedStaffingResult {
  if (context.brief.vertical !== "staffing") throw new RangeError("Staffing planning requires a staffing DecisionContext.");
  const roles = requiredRoles(context);
  const credentialsByRole = requirementMap(context, "credential");
  const equipmentByRole = requirementMap(context, "equipment");
  const date = projectDate(context);
  const { estimatedHours, startLocal, endLocal } = scheduleHours(context);
  const maximumCents = budgetCents(context);
  const contingencyPercent = context.brief.budget!.contingencyPercent;
  const exclusions = context.brief.hardConstraints.filter((item) => item.kind === "avoid").flatMap((item) => values(item.value));
  const unsupported = unsupportedConstraints(context.brief.hardConstraints);
  const candidates = staffingCandidates(offers).filter(evidenceVerified).filter((offer) => !avoids(offer, exclusions));
  const assignments: StaffingAssignment[] = [];
  const missingRoles: StaffingGap[] = [];
  const scheduleGaps: StaffingScheduleGap[] = [];

  for (const role of roles) {
    const requiredCredentials = roleRequirements(credentialsByRole, role);
    const requiredEquipment = roleRequirements(equipmentByRole, role);
    const roleOffers = candidates.filter((offer) => roleMatches(offer, role));
    const locationOffers = roleOffers.filter((offer) => locationMatches(offer, context));
    const scheduled = locationOffers.filter((offer) => Boolean(scheduleWindow(offer, date, startLocal, endLocal)));
    if (locationOffers.length && !scheduled.length) {
      scheduleGaps.push({ role, date, reason: `No verified ${role} Offer covers ${weekday(date)} ${startLocal}-${endLocal}.` });
    }
    const qualified = scheduled.filter((offer) => {
      const credentials = unexpiredControlledCredentials(offer, date).map((credential) => credential.label);
      const equipment = offer.service!.professional!.equipment;
      return requirementsMatch(credentials, requiredCredentials) && requirementsMatch(equipment, requiredEquipment);
    });
    const selected = [...qualified].sort((left, right) => {
      const leftGeo = evaluateGeographicProximity(left, context);
      const rightGeo = evaluateGeographicProximity(right, context);
      const tierDiff = leftGeo.tier - rightGeo.tier;
      if (tierDiff !== 0) return tierDiff;
      const cost = assignmentCostCents(left, estimatedHours) - assignmentCostCents(right, estimatedHours);
      return cost || left.service!.provider.displayName.localeCompare(right.service!.provider.displayName);
    })[0];
    if (!selected) {
      missingRoles.push({
        role,
        reason: gapReason(roleOffers, locationOffers, scheduled, qualified, requiredCredentials, requiredEquipment, context),
        requiredCredentials,
        requiredEquipment,
      });
      continue;
    }
    const service = selected.service!;
    const professional = service.professional!;
    const source = service.provider.verificationSource!;
    const window = scheduleWindow(selected, date, startLocal, endLocal)!;
    const subtotalCents = assignmentCostCents(selected, estimatedHours);
    const planningHighCents = Math.ceil((subtotalCents * (100 + contingencyPercent)) / 100);
    const controlledCredentials = unexpiredControlledCredentials(selected, date);
    const geo = evaluateGeographicProximity(selected, context);
    assignments.push({
      role,
      offerHandle: selected.handle,
      offerTitle: selected.title,
      providerId: service.provider.id!,
      providerName: service.provider.displayName,
      providerVerification: {
        status: service.provider.verification,
        label: source.label,
        url: source.url,
        checkedAt: source.checkedAt,
      },
      serviceArea: {
        ...professional.serviceArea,
        regions: [...professional.serviceArea.regions],
        proximityFit: geo.proximityFit ?? (geo.tier === 1 ? "local-match" : "cross-subregion-service"),
      },
      availability: {
        date,
        weekday: window.weekday,
        timezone: service.scheduling.timezone,
        startLocal: window.startLocal,
        endLocal: window.endLocal,
      },
      credentialEvidence: professional.credentials.map((credential) => ({
        id: credential.id,
        label: credential.label,
        status: credential.status,
        issuer: credential.issuer,
        verificationLabel: credential.verificationSource.label,
        checkedAt: credential.verificationSource.checkedAt,
        expiresAt: credential.expiresAt,
      })),
      requiredCredentialMatches: requiredCredentials.filter((requirement) => controlledCredentials.some((credential) => exactOrContained(credential.label, requirement))),
      equipment: [...professional.equipment],
      requiredEquipmentMatches: requiredEquipment.filter((requirement) => professional.equipment.some((item) => exactOrContained(item, requirement))),
      portfolioEvidence: professional.portfolio.map((item) => ({ title: item.title, category: item.category, verification: item.verification })),
      price: {
        published: { ...selected.priceRange.min },
        basis: service.priceBasis,
        quoteMode: professional.quoteMode,
        estimatedHours,
        publishedSubtotal: money(subtotalCents / 100, "USD"),
        planningHigh: money(planningHighCents / 100, "USD"),
      },
      sourceReview: {
        url: selected.url,
        action: "human-only",
        transmittedInformation: "Opening the controlled source sends an ordinary browser request to that page. Ribband sends no project brief, contact details, contract, or payment data.",
      },
    });
  }

  const publishedSubtotalCents = assignments.reduce((sum, assignment) => sum + Math.round(Number(assignment.price.publishedSubtotal.amount) * 100), 0);
  const planningHighCents = Math.ceil((publishedSubtotalCents * (100 + contingencyPercent)) / 100);
  const contingencyCents = planningHighCents - publishedSubtotalCents;
  const withinBudget = planningHighCents <= maximumCents;
  const complete = assignments.length === roles.length && !missingRoles.length && !scheduleGaps.length && !unsupported.length && withinBudget;
  const status = complete ? "planned" : "needs-attention";
  const unknownCosts = [
    "Taxes, permits, materials, travel surcharges, overtime, and project-specific scope changes are not included unless a listing says otherwise.",
    ...(assignments.some((assignment) => assignment.price.quoteMode === "estimate-only") ? ["At least one assignment is estimate-only and needs a human-reviewed provider quote."] : []),
  ];
  const localCount = assignments.filter((a) => a.serviceArea.proximityFit === "local-match").length;
  const crossCount = assignments.filter((a) => a.serviceArea.proximityFit === "cross-subregion-service").length;
  const proximityNote = assignments.length
    ? localCount === assignments.length
      ? "Proximity fit: all assigned providers are local subregion matches."
      : crossCount === assignments.length
        ? "Proximity fit: all assigned providers provide cross-subregion service within verified travel radius."
        : `Proximity fit: ${localCount} local subregion match${localCount === 1 ? "" : "es"} and ${crossCount} cross-subregion service provider${crossCount === 1 ? "" : "s"} within verified travel radius.`
    : "";
  const plan: StaffingCrewPlan = {
    id: `${context.brief.id}-crew-1`,
    label: complete ? "Verified crew plan" : "Partial verified crew plan",
    title: `${roles.length}-role project crew for ${context.brief.location?.label ?? "the requested area"}`,
    status: complete ? "ready-for-review" : "needs-attention",
    score: Math.max(0, Math.min(100, 100 - missingRoles.length * 25 - scheduleGaps.length * 10 - unsupported.length * 15 - (withinBudget ? 0 : 20))),
    projectDate: date,
    estimatedHours,
    requestedRoles: roles,
    assignments,
    missingRoles,
    scheduleGaps,
    budgetCeiling: money(maximumCents / 100, "USD"),
    costs: {
      publishedSubtotal: money(publishedSubtotalCents / 100, "USD"),
      contingency: money(contingencyCents / 100, "USD"),
      planningHigh: money(planningHighCents / 100, "USD"),
      withinBudget,
      basis: `${estimatedHours} planned hours for hourly roles, published fixed price for fixed roles, plus ${contingencyPercent}% contingency`,
    },
    quoteAccounting: {
      publishedRateAssignments: assignments.filter((assignment) => assignment.price.quoteMode === "published-rate").length,
      estimateOnlyAssignments: assignments.filter((assignment) => assignment.price.quoteMode === "estimate-only").length,
      unknownCosts,
    },
    why: complete
      ? `Every assigned provider matches the requested role, controlled-verified qualification requirements, service area, published schedule, listed equipment, and planning budget.${proximityNote ? ` ${proximityNote}` : ""}`
      : `Only providers that passed every applicable hard constraint were assigned. Missing qualifications, schedule coverage, unsupported constraints, or budget conflicts remain visible instead of being softened into preferences.${proximityNote ? ` ${proximityNote}` : ""}`,
    tradeoff: "This proof uses original controlled provider fixtures. Driving distances are planning estimates, not verified travel measurements. It verifies evidence flow and decision boundaries, not real-world provider availability or licensure.",
    evidenceConfidence: complete
      ? "All assignment-critical provider fields were reconciled across controlled service JSON and semantic page evidence."
      : "Assigned roles have reconciled evidence, but the complete requested crew is not currently actionable.",
  };
  return {
    status,
    crews: [plan],
    staffing: {
      status: complete ? "applied" : assignments.length ? "partial" : "not-applied",
      actionEligible: complete,
      briefId: context.brief.id,
      vertical: "staffing",
      handling: "request-only",
      providerSourceReview: "human-only",
      contactCapability: "unavailable",
      contractingCapability: "unavailable",
      unsupportedConstraints: unsupported,
      note: "Ribband may prepare a page-only source review. It cannot contact a provider, request a quote, contract, book labor, or pay.",
    },
    ...(!complete ? { warning: "The crew needs attention. Review the visible role, schedule, qualification, evidence, or budget gaps before any source handoff." } : {}),
  };
}
