import { money, type Money, type Offer } from "./offers";

export type ItineraryPace = "relaxed" | "balanced" | "full";
export type ItineraryConflictCode =
  | "date-required"
  | "destination-mismatch"
  | "not-itinerary-eligible"
  | "party-size"
  | "source-not-live"
  | "evidence-conflict"
  | "unavailable"
  | "no-published-window"
  | "schedule-capacity"
  | "budget-limit";

export type ItineraryConflict = {
  code: ItineraryConflictCode;
  severity: "blocking";
  handles: string[];
  message: string;
};

export type ActivityItineraryItem = {
  order: number;
  selectionOrder: number;
  handle: string;
  title: string;
  provider: string;
  location: string;
  city: string;
  timezone: string;
  durationMinutes: number;
  price: Money;
  publishedPrice: Money;
  priceBasis: string;
  publishedWindows: string[];
  sourceUrl: string;
  evidence: string;
  status: "scheduled" | "needs-attention";
  day: number | null;
  date: string | null;
  startLocal: string | null;
  endLocal: string | null;
  transitionBufferMinutes: number;
  reason: string | null;
};

export type ActivityItineraryDay = {
  day: number;
  date: string;
  weekday: string;
  itemHandles: string[];
  scheduledMinutes: number;
};

export type ActivityItinerary = {
  status: "planning-only";
  planStatus: "ready-for-review" | "needs-attention";
  goal: string;
  destination: {
    label: string;
    region: string;
    countryCode: string;
    timezone: string;
    cities: string[];
  };
  date: string | null;
  partySize: number;
  generatedAt: string;
  constraints: {
    days: number;
    pace: ItineraryPace;
    earliestStart: string;
    latestEnd: string;
    budget: Money | null;
    transitionBufferPolicy: string;
  };
  days: ActivityItineraryDay[];
  items: ActivityItineraryItem[];
  publishedPriceTotal: Money;
  selectedPriceTotal: Money;
  budgetRemaining: Money | null;
  conflicts: ItineraryConflict[];
  warnings: string[];
  markdown: string;
};

export type ActivityItineraryRequest = {
  goal: string;
  date?: string | undefined;
  days?: unknown;
  partySize?: unknown;
  budget?: unknown;
  pace?: unknown;
  earliestStart?: string | undefined;
  latestEnd?: string | undefined;
};

type PacePolicy = {
  maxActivitiesPerDay: number;
  sameCityBufferMinutes: number;
  differentCityBufferMinutes: number;
};

type Candidate = {
  offer: Offer;
  selectionOrder: number;
  costCents: number;
};

type PlanningDay = ActivityItineraryDay & {
  cursorMinutes: number;
  lastCity: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const LOCAL_TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const PACE_POLICIES: Record<ItineraryPace, PacePolicy> = {
  relaxed: { maxActivitiesPerDay: 2, sameCityBufferMinutes: 45, differentCityBufferMinutes: 75 },
  balanced: { maxActivitiesPerDay: 3, sameCityBufferMinutes: 30, differentCityBufferMinutes: 60 },
  full: { maxActivitiesPerDay: 4, sameCityBufferMinutes: 20, differentCityBufferMinutes: 45 },
};

function validateGoal(raw: string): string {
  const goal = raw.trim();
  if (!goal || goal.length > 160) throw new RangeError("Itinerary goal must be between 1 and 160 characters.");
  return goal;
}

function validateDate(raw?: string): string | null {
  const date = (raw ?? "").trim();
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError("Itinerary date must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new RangeError("Itinerary date must be a real calendar date.");
  }
  return date;
}

function boundedInteger(raw: unknown, defaultValue: number, min: number, max: number, label: string): number {
  const value = raw === undefined || raw === null || raw === "" ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function validatePace(raw: unknown): ItineraryPace {
  const value = raw === undefined || raw === null || raw === "" ? "balanced" : String(raw);
  if (value !== "relaxed" && value !== "balanced" && value !== "full") {
    throw new RangeError("Itinerary pace must be relaxed, balanced, or full.");
  }
  return value;
}

function validateLocalTime(raw: string | undefined, fallback: string, label: string): string {
  const value = (raw ?? "").trim() || fallback;
  if (!LOCAL_TIME_PATTERN.test(value)) throw new RangeError(`${label} must use 24-hour HH:MM time.`);
  return value;
}

function validateBudget(raw: unknown, currencyCode: string): Money | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 25 || value > 100_000) {
    throw new RangeError("Itinerary budget must be between 25 and 100000.");
  }
  return money(value, currencyCode);
}

function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function localTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const remainder = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${remainder}`;
}

function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + offset));
  return value.toISOString().slice(0, 10);
}

function weekday(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
}

function itemPriceCents(offer: Offer, partySize: number): number {
  const amount = Number.parseFloat(offer.priceRange.min.amount);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) * (offer.service?.priceBasis === "per-person" ? partySize : 1);
}

function locationLabel(offer: Offer): string {
  const location = offer.service!.location;
  return `${location.city}, ${location.region}, ${location.countryCode}`;
}

function destinationKey(offer: Offer): string {
  const service = offer.service!;
  return `${service.location.region.toLocaleLowerCase()}|${service.location.countryCode}|${service.scheduling.timezone}`;
}

function itemFromCandidate(candidate: Candidate, partySize: number, reason: string | null): ActivityItineraryItem {
  const { offer, selectionOrder, costCents } = candidate;
  const service = offer.service!;
  return {
    order: 0,
    selectionOrder,
    handle: offer.handle,
    title: offer.title,
    provider: service.provider.displayName,
    location: locationLabel(offer),
    city: service.location.city,
    timezone: service.scheduling.timezone,
    durationMinutes: service.durationMinutes,
    price: money(costCents / 100, offer.priceRange.min.currencyCode),
    publishedPrice: offer.priceRange.min,
    priceBasis: service.priceBasis,
    publishedWindows: service.scheduling.windows.slice(0, 6).map((window) => `${window.weekday} ${window.startLocal}-${window.endLocal}`),
    sourceUrl: offer.url,
    evidence: offer.provenance.verification.label,
    status: "needs-attention",
    day: null,
    date: null,
    startLocal: null,
    endLocal: null,
    transitionBufferMinutes: 0,
    reason,
  };
}

function addConflict(conflicts: ItineraryConflict[], code: ItineraryConflictCode, candidate: Candidate, message: string): void {
  conflicts.push({ code, severity: "blocking", handles: [candidate.offer.handle], message });
}

function publishedWindowOnPlanningDays(candidate: Candidate, days: PlanningDay[]): boolean {
  return days.some((day) => candidate.offer.service!.scheduling.windows.some((window) => window.weekday === day.weekday));
}

function candidateSlot(
  candidate: Candidate,
  day: PlanningDay,
  policy: PacePolicy,
  earliestMinutes: number,
  latestMinutes: number,
): { start: number; end: number; buffer: number } | null {
  if (day.itemHandles.length >= policy.maxActivitiesPerDay) return null;
  const service = candidate.offer.service!;
  const buffer = day.lastCity === null
    ? 0
    : day.lastCity === service.location.city ? policy.sameCityBufferMinutes : policy.differentCityBufferMinutes;
  const cursor = Math.max(earliestMinutes, day.cursorMinutes + buffer);
  let best: { start: number; end: number; buffer: number } | null = null;
  for (const window of service.scheduling.windows) {
    if (window.weekday !== day.weekday) continue;
    const start = Math.max(cursor, timeMinutes(window.startLocal));
    const end = start + service.durationMinutes;
    if (end > timeMinutes(window.endLocal) || end > latestMinutes) continue;
    if (!best || start < best.start) best = { start, end, buffer };
  }
  return best;
}

function markdownFor(itinerary: Omit<ActivityItinerary, "markdown">): string {
  const lines = [
    `# ${itinerary.destination.region} activity plan`,
    `Goal: ${itinerary.goal}`,
    `Plan status: ${itinerary.planStatus}`,
    `Destination: ${itinerary.destination.label}`,
    `Dates: ${itinerary.date ?? "Start date needed"}${itinerary.date ? ` for ${itinerary.constraints.days} day${itinerary.constraints.days === 1 ? "" : "s"}` : ""}`,
    `Party: ${itinerary.partySize} | Pace: ${itinerary.constraints.pace} | Day: ${itinerary.constraints.earliestStart}-${itinerary.constraints.latestEnd}`,
    `Budget: ${itinerary.constraints.budget ? `${itinerary.constraints.budget.amount} ${itinerary.constraints.budget.currencyCode}` : "Not set"}`,
  ];
  for (const day of itinerary.days) {
    lines.push("", `## Day ${day.day} | ${day.weekday}, ${day.date}`);
    const items = itinerary.items.filter((item) => item.day === day.day && item.status === "scheduled");
    if (!items.length) lines.push("No activities fit the selected constraints.");
    for (const item of items) {
      lines.push(
        `${item.startLocal}-${item.endLocal} | ${item.title}`,
        `${item.location} | ${item.durationMinutes} minutes | ${item.price.amount} ${item.price.currencyCode} party total`,
        `Source: ${item.sourceUrl}`,
      );
    }
  }
  const attention = itinerary.items.filter((item) => item.status === "needs-attention");
  if (attention.length) {
    lines.push("", "## Needs attention");
    for (const item of attention) lines.push(`- ${item.title}: ${item.reason}`);
  }
  lines.push(
    "",
    `Planned published total: ${itinerary.publishedPriceTotal.amount} ${itinerary.publishedPriceTotal.currencyCode}`,
    "",
    "## Guardrails",
    ...itinerary.warnings.map((warning) => `- ${warning}`),
  );
  return lines.join("\n").slice(0, 2600);
}

export function createActivityItinerary(
  request: ActivityItineraryRequest,
  offers: Offer[],
  generatedAt = new Date().toISOString(),
): ActivityItinerary {
  const goal = validateGoal(request.goal);
  const date = validateDate(request.date);
  const partySize = boundedInteger(request.partySize, 1, 1, 20, "Party size");
  const numberOfDays = boundedInteger(request.days, 1, 1, 3, "Itinerary days");
  const pace = validatePace(request.pace);
  const earliestStart = validateLocalTime(request.earliestStart, "08:00", "Earliest start");
  const latestEnd = validateLocalTime(request.latestEnd, "19:00", "Latest end");
  if (timeMinutes(earliestStart) + 60 > timeMinutes(latestEnd)) {
    throw new RangeError("The itinerary day must span at least one hour.");
  }
  if (offers.length < 1 || offers.length > 4) throw new RangeError("Choose between 1 and 4 services for an activity itinerary.");
  if (offers.some((offer) => offer.vertical !== "services" || !offer.service)) {
    throw new RangeError("Activity itineraries require normalized service Offers.");
  }
  const currency = offers[0]!.priceRange.min.currencyCode;
  if (offers.some((offer) => offer.priceRange.min.currencyCode !== currency)) {
    throw new RangeError("Itinerary services must use one currency.");
  }
  const budget = validateBudget(request.budget, currency);
  const budgetCents = budget ? Math.round(Number.parseFloat(budget.amount) * 100) : null;
  const policy = PACE_POLICIES[pace];
  const anchor = offers.find((offer) => (
    offer.service?.itineraryEligible
    && offer.source.live
    && offer.provenance.verification.state !== "conflict"
    && offer.constraints.available
  )) ?? offers.find((offer) => offer.service?.itineraryEligible) ?? offers[0]!;
  const anchorKey = destinationKey(anchor);
  const anchorService = anchor.service!;
  const destinationOffers = offers.filter((offer) => destinationKey(offer) === anchorKey);
  const destination = {
    label: `${anchorService.location.region}, ${anchorService.location.countryCode}`,
    region: anchorService.location.region,
    countryCode: anchorService.location.countryCode,
    timezone: anchorService.scheduling.timezone,
    cities: [...new Set(destinationOffers.map((offer) => offer.service!.location.city))],
  };
  const planningDays: PlanningDay[] = date
    ? Array.from({ length: numberOfDays }, (_, index) => {
      const planningDate = addDays(date, index);
      return {
        day: index + 1,
        date: planningDate,
        weekday: weekday(planningDate),
        itemHandles: [],
        scheduledMinutes: 0,
        cursorMinutes: timeMinutes(earliestStart),
        lastCity: null,
      };
    })
    : [];
  const candidates: Candidate[] = offers.map((offer, index) => ({
    offer,
    selectionOrder: index + 1,
    costCents: itemPriceCents(offer, partySize),
  }));
  const conflicts: ItineraryConflict[] = [];
  const items: ActivityItineraryItem[] = [];
  const ready: Candidate[] = [];

  for (const candidate of candidates) {
    const { offer } = candidate;
    const service = offer.service!;
    let reason: string | null = null;
    let code: ItineraryConflictCode | null = null;
    if (!service.itineraryEligible) {
      code = "not-itinerary-eligible";
      reason = "This service is not marked as an itinerary activity.";
    } else if (destinationKey(offer) !== anchorKey) {
      code = "destination-mismatch";
      reason = `This service is outside ${destination.label}.`;
    } else if (partySize < service.partySize.min || partySize > service.partySize.max) {
      code = "party-size";
      reason = `The published party limit is ${service.partySize.min} to ${service.partySize.max}.`;
    } else if (!offer.source.live) {
      code = "source-not-live";
      reason = "The current service facts are not from a live source.";
    } else if (offer.provenance.verification.state === "conflict") {
      code = "evidence-conflict";
      reason = `Source evidence conflicts on ${offer.provenance.verification.conflictFields.join(", ")}.`;
    } else if (!offer.constraints.available) {
      code = "unavailable";
      reason = "The service is not currently published as available.";
    }
    if (code && reason) {
      addConflict(conflicts, code, candidate, `${offer.title}: ${reason}`);
      items.push(itemFromCandidate(candidate, partySize, reason));
    } else {
      ready.push(candidate);
    }
  }

  if (!date) {
    for (const candidate of ready) {
      const reason = "Choose a start date before Ribband can match published weekday windows.";
      addConflict(conflicts, "date-required", candidate, `${candidate.offer.title}: ${reason}`);
      items.push(itemFromCandidate(candidate, partySize, reason));
    }
  } else {
    const remaining = [...ready];
    let scheduledCostCents = 0;
    for (const day of planningDays) {
      while (day.itemHandles.length < policy.maxActivitiesPerDay && remaining.length) {
        const options = remaining.flatMap((candidate) => {
          if (budgetCents !== null && scheduledCostCents + candidate.costCents > budgetCents) return [];
          const slot = candidateSlot(candidate, day, policy, timeMinutes(earliestStart), timeMinutes(latestEnd));
          return slot ? [{ candidate, slot }] : [];
        }).sort((left, right) => (
          left.slot.start - right.slot.start
          || left.candidate.selectionOrder - right.candidate.selectionOrder
        ));
        const next = options[0];
        if (!next) break;
        const index = remaining.indexOf(next.candidate);
        remaining.splice(index, 1);
        const item = itemFromCandidate(next.candidate, partySize, null);
        item.status = "scheduled";
        item.day = day.day;
        item.date = day.date;
        item.startLocal = localTime(next.slot.start);
        item.endLocal = localTime(next.slot.end);
        item.transitionBufferMinutes = next.slot.buffer;
        items.push(item);
        day.itemHandles.push(item.handle);
        day.scheduledMinutes += item.durationMinutes;
        day.cursorMinutes = next.slot.end;
        day.lastCity = item.city;
        scheduledCostCents += next.candidate.costCents;
      }
    }
    const plannedCostCents = items.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + Math.round(Number.parseFloat(item.price.amount) * 100), 0);
    for (const candidate of remaining) {
      let code: ItineraryConflictCode;
      let reason: string;
      if (budgetCents !== null && plannedCostCents + candidate.costCents > budgetCents) {
        code = "budget-limit";
        reason = `Adding this service would exceed the ${budget!.amount} ${currency} budget.`;
      } else if (!publishedWindowOnPlanningDays(candidate, planningDays)) {
        code = "no-published-window";
        reason = "No published window matches the selected dates.";
      } else {
        code = "schedule-capacity";
        reason = `It does not fit the ${pace} daily pace or selected day hours.`;
      }
      addConflict(conflicts, code, candidate, `${candidate.offer.title}: ${reason}`);
      items.push(itemFromCandidate(candidate, partySize, reason));
    }
  }

  const orderedItems = items
    .sort((left, right) => (
      (left.day ?? Number.MAX_SAFE_INTEGER) - (right.day ?? Number.MAX_SAFE_INTEGER)
      || (left.startLocal ?? "99:99").localeCompare(right.startLocal ?? "99:99")
      || left.selectionOrder - right.selectionOrder
    ))
    .map((item, index) => ({ ...item, order: index + 1 }));
  const scheduledTotalCents = orderedItems
    .filter((item) => item.status === "scheduled")
    .reduce((sum, item) => sum + Math.round(Number.parseFloat(item.price.amount) * 100), 0);
  const selectedTotalCents = candidates.reduce((sum, candidate) => sum + candidate.costCents, 0);
  const warnings = [
    "Proposed times sit inside published windows but are not reservations or live availability confirmations.",
    "Transition buffers are planning allowances, not measured travel times.",
    "Lodging, transportation, taxes, weather, accessibility, and provider communication are not included.",
  ];
  const itineraryWithoutMarkdown = {
    status: "planning-only" as const,
    planStatus: conflicts.length ? "needs-attention" as const : "ready-for-review" as const,
    goal,
    destination,
    date,
    partySize,
    generatedAt,
    constraints: {
      days: numberOfDays,
      pace,
      earliestStart,
      latestEnd,
      budget,
      transitionBufferPolicy: `${policy.sameCityBufferMinutes} minutes in one city, ${policy.differentCityBufferMinutes} minutes between cities`,
    },
    days: planningDays.map(({ cursorMinutes: _cursor, lastCity: _lastCity, ...day }) => day),
    items: orderedItems,
    publishedPriceTotal: money(scheduledTotalCents / 100, currency),
    selectedPriceTotal: money(selectedTotalCents / 100, currency),
    budgetRemaining: budgetCents === null ? null : money((budgetCents - scheduledTotalCents) / 100, currency),
    conflicts,
    warnings,
  };
  return { ...itineraryWithoutMarkdown, markdown: markdownFor(itineraryWithoutMarkdown) };
}
