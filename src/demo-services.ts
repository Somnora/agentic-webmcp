export type DemoServiceWindow = {
  weekday: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  start_local: string;
  end_local: string;
};

export type DemoService = {
  id: string;
  handle: string;
  title: string;
  description: string;
  provider: { display_name: string; verification: "controlled-demo" };
  category: "activity" | "wellness" | "home-service";
  location: {
    city: string;
    region: string;
    country_code: string;
    venue: "provider-location" | "customer-location" | "outdoor";
  };
  duration_minutes: number;
  price: string;
  currency_code: "USD";
  price_basis: "fixed" | "hourly" | "per-person" | "estimate";
  party_size: { min: number; max: number };
  scheduling: { timezone: string; windows: DemoServiceWindow[] };
  cancellation: { refundable: boolean; window_hours: number | null; fee: string | null };
  itinerary_eligible: boolean;
  available: boolean;
};

export const DEMO_SERVICES: readonly DemoService[] = Object.freeze([
  Object.freeze({
    id: "service-north-shore-surf-foundations",
    handle: "north-shore-surf-foundations",
    title: "North Shore Surf Foundations",
    description: "A two-hour beginner Oahu surf lesson experience with board, leash, shoreline safety briefing, and a small group format.",
    provider: { display_name: "Pacific Current Instruction", verification: "controlled-demo" },
    category: "activity",
    location: { city: "Haleiwa", region: "Oahu, Hawaii", country_code: "US", venue: "outdoor" },
    duration_minutes: 120,
    price: "95.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 6 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Tuesday", start_local: "08:00", end_local: "12:00" },
        { weekday: "Thursday", start_local: "08:00", end_local: "12:00" },
        { weekday: "Saturday", start_local: "07:30", end_local: "12:30" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "0.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-haleiwa-food-story-walk",
    handle: "haleiwa-food-story-walk",
    title: "Haleiwa Food Story Walk",
    description: "A ninety-minute Oahu experience connecting local food traditions, town history, and four small tasting stops.",
    provider: { display_name: "Harbor Lane Guides", verification: "controlled-demo" },
    category: "activity",
    location: { city: "Haleiwa", region: "Oahu, Hawaii", country_code: "US", venue: "outdoor" },
    duration_minutes: 90,
    price: "58.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 8 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Wednesday", start_local: "11:30", end_local: "16:00" },
        { weekday: "Saturday", start_local: "11:30", end_local: "16:00" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "0.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-windward-botanical-sketch-walk",
    handle: "windward-botanical-sketch-walk",
    title: "Windward Botanical Sketch Walk",
    description: "A two-hour Oahu experience combining a guided plant walk with a quiet, beginner-friendly field sketch session.",
    provider: { display_name: "Rainline Field Studio", verification: "controlled-demo" },
    category: "activity",
    location: { city: "Kaneohe", region: "Oahu, Hawaii", country_code: "US", venue: "outdoor" },
    duration_minutes: 120,
    price: "64.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 8 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Tuesday", start_local: "09:00", end_local: "13:00" },
        { weekday: "Thursday", start_local: "09:00", end_local: "13:00" },
        { weekday: "Sunday", start_local: "09:00", end_local: "13:00" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "0.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-oahu-sunset-photo-walk",
    handle: "oahu-sunset-photo-walk",
    title: "Oahu Sunset Photo Walk",
    description: "A ninety-minute Oahu experience focused on composition, changing light, and a calm coastal walking pace.",
    provider: { display_name: "Silver Palm Field Notes", verification: "controlled-demo" },
    category: "activity",
    location: { city: "Waialua", region: "Oahu, Hawaii", country_code: "US", venue: "outdoor" },
    duration_minutes: 90,
    price: "72.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 6 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Friday", start_local: "16:00", end_local: "19:30" },
        { weekday: "Saturday", start_local: "16:00", end_local: "19:30" },
        { weekday: "Sunday", start_local: "16:00", end_local: "19:30" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "0.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-tangier-traditional-archery",
    handle: "tangier-traditional-archery",
    title: "Tangier Traditional Archery Introduction",
    description: "A ninety-minute introductory bow and arrow lesson covering range safety, stance, release, and supervised practice.",
    provider: { display_name: "Atlas Bow Workshop", verification: "controlled-demo" },
    category: "activity",
    location: { city: "Tangier", region: "Tanger-Tetouan-Al Hoceima", country_code: "MA", venue: "provider-location" },
    duration_minutes: 90,
    price: "68.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 8 },
    scheduling: {
      timezone: "Africa/Casablanca",
      windows: [
        { weekday: "Wednesday", start_local: "10:00", end_local: "16:00" },
        { weekday: "Friday", start_local: "10:00", end_local: "16:00" },
        { weekday: "Sunday", start_local: "09:00", end_local: "13:00" },
      ],
    },
    cancellation: { refundable: true, window_hours: 48, fee: "0.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-honolulu-restorative-massage",
    handle: "honolulu-restorative-massage",
    title: "Restorative Massage Session",
    description: "A sixty-minute relaxation-focused Oahu experience at a provider studio. Solo and paired sessions are available. This listing does not make medical claims.",
    provider: { display_name: "Harbor Bodywork Studio", verification: "controlled-demo" },
    category: "wellness",
    location: { city: "Honolulu", region: "Oahu, Hawaii", country_code: "US", venue: "provider-location" },
    duration_minutes: 60,
    price: "110.00",
    currency_code: "USD",
    price_basis: "per-person",
    party_size: { min: 1, max: 2 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Monday", start_local: "10:00", end_local: "17:00" },
        { weekday: "Wednesday", start_local: "10:00", end_local: "17:00" },
        { weekday: "Friday", start_local: "10:00", end_local: "17:00" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "25.00" },
    itinerary_eligible: true,
    available: true,
  } satisfies DemoService),
  Object.freeze({
    id: "service-home-repair-walkthrough",
    handle: "home-repair-walkthrough",
    title: "Home Repair Walkthrough",
    description: "A one-hour on-site walkthrough for small repair planning, scope notes, and a written estimate. Materials and repair work are not included.",
    provider: { display_name: "Neighborline Home Repair", verification: "controlled-demo" },
    category: "home-service",
    location: { city: "Honolulu", region: "Oahu, Hawaii", country_code: "US", venue: "customer-location" },
    duration_minutes: 60,
    price: "75.00",
    currency_code: "USD",
    price_basis: "estimate",
    party_size: { min: 1, max: 4 },
    scheduling: {
      timezone: "Pacific/Honolulu",
      windows: [
        { weekday: "Tuesday", start_local: "09:00", end_local: "15:00" },
        { weekday: "Thursday", start_local: "09:00", end_local: "15:00" },
      ],
    },
    cancellation: { refundable: true, window_hours: 24, fee: "0.00" },
    itinerary_eligible: false,
    available: true,
  } satisfies DemoService),
]);

export function demoService(handle: string): DemoService | undefined {
  return DEMO_SERVICES.find((service) => service.handle === handle);
}
