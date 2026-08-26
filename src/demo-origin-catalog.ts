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
  variants: DemoVariant[];
};

export const DEMO_PRODUCTS: readonly DemoProduct[] = Object.freeze([
  Object.freeze({
    id: "product-field-notebook",
    handle: "field-notebook",
    title: "Field Notebook",
    body_html: "<p>A compact dot-grid notebook with a lay-flat binding and 160 numbered pages.</p>",
    vendor: "Agentic Catalog Lab",
    product_type: "stationery",
    options: [{ name: "Cover" }],
    image: null,
    variants: [
      { id: "field-notebook-sand", title: "Sand", available: true, price: "18.00", option1: "Sand" },
      { id: "field-notebook-slate", title: "Slate", available: true, price: "20.00", option1: "Slate" },
    ],
  }),
  Object.freeze({
    id: "product-cable-organizer",
    handle: "travel-cable-organizer",
    title: "Travel Cable Organizer",
    body_html: "<p>A zip organizer with labeled loops for charging cables, adapters, and small tools.</p>",
    vendor: "Agentic Catalog Lab",
    product_type: "travel-accessory",
    options: [{ name: "Size" }],
    image: null,
    variants: [
      { id: "cable-organizer-compact", title: "Compact", available: true, price: "24.00", option1: "Compact" },
      { id: "cable-organizer-extended", title: "Extended", available: true, price: "32.00", option1: "Extended" },
    ],
  }),
  Object.freeze({
    id: "product-modular-desk-tray",
    handle: "modular-desk-tray",
    title: "Modular Desk Tray",
    body_html: "<p>A stackable desktop tray with removable dividers for notebooks, cables, and writing tools.</p>",
    vendor: "Agentic Catalog Lab",
    product_type: "desk-accessory",
    options: [{ name: "Size" }],
    image: null,
    variants: [
      { id: "desk-tray-small", title: "Small", available: true, price: "38.00", option1: "Small" },
      { id: "desk-tray-large", title: "Large", available: false, price: "52.00", option1: "Large" },
    ],
  }),
  Object.freeze({
    id: "product-studio-tool-roll",
    handle: "studio-tool-roll",
    title: "Studio Tool Roll",
    body_html: "<p>A twelve-pocket canvas roll for pens, brushes, cables, and compact studio tools.</p>",
    vendor: "Agentic Catalog Lab",
    product_type: "studio-accessory",
    options: [{ name: "Color" }],
    image: null,
    variants: [
      { id: "tool-roll-canvas", title: "Canvas", available: true, price: "44.00", option1: "Canvas" },
      { id: "tool-roll-charcoal", title: "Charcoal", available: true, price: "44.00", option1: "Charcoal" },
    ],
  }),
]);

export function demoProduct(handle: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((product) => product.handle === handle);
}
