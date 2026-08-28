import type { MarketplaceCondition } from "./offers";

export type DemoVariant = {
  id: string;
  title: string;
  available: boolean;
  price: string;
  option1: string;
};

export type DemoProduct = {
  id: string;
  handle: string;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  options: Array<{ name: string }>;
  image: null;
  condition: MarketplaceCondition;
  condition_description: string;
  seller: {
    display_name: string;
    positive_feedback_percent: number;
    feedback_count: number;
  };
  shipping: {
    price: string;
    method: string;
    estimated_days_min: number;
    estimated_days_max: number;
  };
  returns: {
    accepted: boolean;
    window_days: number | null;
    paid_by: "buyer" | "seller" | "not-applicable";
  };
  variants: DemoVariant[];
};

export const DEMO_PRODUCTS: readonly DemoProduct[] = Object.freeze([
  Object.freeze({
    id: "listing-sunburst-s-style-electric",
    handle: "sunburst-s-style-electric",
    title: "Sunburst S-Style Electric Guitar",
    body_html: "<p>Alder-body electric guitar with three single-coil pickups. Light fret wear, clean electronics, and a fitted case are included.</p>",
    vendor: "Northline Music Co.",
    product_type: "electric-guitar",
    options: [{ name: "Listing" }],
    image: null,
    condition: "excellent",
    condition_description: "Light cosmetic wear on the back. Frets, electronics, and hardware were inspected and work as described.",
    seller: { display_name: "Northline Music Co.", positive_feedback_percent: 99.8, feedback_count: 1842 },
    shipping: { price: "35.00", method: "Insured ground", estimated_days_min: 3, estimated_days_max: 5 },
    returns: { accepted: true, window_days: 30, paid_by: "seller" as const },
    variants: [
      { id: "sunburst-s-style-electric-listed", title: "As listed", available: true, price: "575.00", option1: "As listed" },
    ],
  }),
  Object.freeze({
    id: "listing-mahogany-single-cut-electric",
    handle: "mahogany-single-cut-electric",
    title: "Mahogany Single-Cut Electric Guitar",
    body_html: "<p>Set-neck electric guitar with dual humbuckers. Moderate buckle wear, stable neck relief, and recently serviced controls.</p>",
    vendor: "Fret & Found",
    product_type: "electric-guitar",
    options: [{ name: "Listing" }],
    image: null,
    condition: "very-good",
    condition_description: "Visible finish wear and small edge marks. No structural repairs were reported and all controls were serviced.",
    seller: { display_name: "Fret & Found", positive_feedback_percent: 99.4, feedback_count: 782 },
    shipping: { price: "48.00", method: "Insured ground", estimated_days_min: 4, estimated_days_max: 7 },
    returns: { accepted: true, window_days: 14, paid_by: "buyer" as const },
    variants: [
      { id: "mahogany-single-cut-electric-listed", title: "As listed", available: true, price: "520.00", option1: "As listed" },
    ],
  }),
  Object.freeze({
    id: "listing-natural-dreadnought-acoustic",
    handle: "natural-dreadnought-acoustic",
    title: "Natural Dreadnought Acoustic Guitar",
    body_html: "<p>Solid-top acoustic guitar with a comfortable setup. Minor pick wear, a clean bridge, and a padded gig bag are included.</p>",
    vendor: "Cedar Room Instruments",
    product_type: "acoustic-guitar",
    options: [{ name: "Listing" }],
    image: null,
    condition: "excellent",
    condition_description: "Minor pick marks under normal light. Neck angle, bridge, and tuners were inspected and are stable.",
    seller: { display_name: "Cedar Room Instruments", positive_feedback_percent: 100, feedback_count: 326 },
    shipping: { price: "0.00", method: "Insured ground", estimated_days_min: 3, estimated_days_max: 6 },
    returns: { accepted: true, window_days: 30, paid_by: "buyer" as const },
    variants: [
      { id: "natural-dreadnought-acoustic-listed", title: "As listed", available: true, price: "440.00", option1: "As listed" },
    ],
  }),
  Object.freeze({
    id: "listing-offset-electric-ocean-blue",
    handle: "offset-electric-ocean-blue",
    title: "Ocean Blue Offset Electric Guitar",
    body_html: "<p>Offset electric guitar with dual single-coil pickups and a vibrato bridge. Recently set up with a hard case included.</p>",
    vendor: "Signal Path Guitars",
    product_type: "electric-guitar",
    options: [{ name: "Listing" }],
    image: null,
    condition: "very-good",
    condition_description: "Several shallow body marks and light hardware patina. Electronics and vibrato operate normally.",
    seller: { display_name: "Signal Path Guitars", positive_feedback_percent: 98.9, feedback_count: 2450 },
    shipping: { price: "25.00", method: "Insured ground", estimated_days_min: 2, estimated_days_max: 4 },
    returns: { accepted: false, window_days: null, paid_by: "not-applicable" as const },
    variants: [
      { id: "offset-electric-ocean-blue-listed", title: "As listed", available: true, price: "690.00", option1: "As listed" },
    ],
  }),
]);

export function demoProduct(handle: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((product) => product.handle === handle);
}
