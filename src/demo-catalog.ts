export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: Money;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type Product = {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  variants: ProductVariant[];
};

const money = (amount: string): Money => ({ amount, currencyCode: "CAD" });

export const FALLBACK_PRODUCTS: Product[] = [
  {
    handle: "slides",
    title: "Slides",
    description: "Minimal iron-colored slides designed for comfortable everyday wear.",
    vendor: "Mock.shop snapshot",
    productType: "Footwear",
    featuredImage: null,
    priceRange: { minVariantPrice: money("25.00"), maxVariantPrice: money("25.00") },
    variants: ["Small", "Medium", "Large"].map((title, index) => ({
      id: `fallback-slides-${index + 1}`,
      title,
      availableForSale: true,
      quantityAvailable: 48 + index,
      price: money("25.00"),
      selectedOptions: [{ name: "Size", value: title }],
    })),
  },
  {
    handle: "sweatpants",
    title: "Sweatpants",
    description: "Soft stretch sweatpants in several colors for comfortable everyday wear.",
    vendor: "Mock.shop snapshot",
    productType: "Apparel",
    featuredImage: null,
    priceRange: { minVariantPrice: money("35.00"), maxVariantPrice: money("42.00") },
    variants: ["Green", "Olive", "Ocean"].map((color, index) => ({
      id: `fallback-sweatpants-${index + 1}`,
      title: `Small / ${color}`,
      availableForSale: true,
      quantityAvailable: 50,
      price: money(index === 2 ? "42.00" : "35.00"),
      selectedOptions: [{ name: "Size", value: "Small" }, { name: "Color", value: color }],
    })),
  },
  {
    handle: "men-t-shirt",
    title: "Men's T-shirt",
    description: "A relaxed organic-cotton T-shirt with a crew neckline and breathable fabric.",
    vendor: "Mock.shop snapshot",
    productType: "Apparel",
    featuredImage: null,
    priceRange: { minVariantPrice: money("40.00"), maxVariantPrice: money("40.00") },
    variants: ["Green", "Olive", "Ocean"].map((color, index) => ({
      id: `fallback-tshirt-${index + 1}`,
      title: `Small / ${color}`,
      availableForSale: true,
      quantityAvailable: 25 + index,
      price: money("40.00"),
      selectedOptions: [{ name: "Size", value: "Small" }, { name: "Color", value: color }],
    })),
  },
  {
    handle: "hoodie-old",
    title: "Hoodie",
    description: "A soft cotton hoodie with a fleece interior and unisex sizing.",
    vendor: "Mock.shop snapshot",
    productType: "Apparel",
    featuredImage: null,
    priceRange: { minVariantPrice: money("90.00"), maxVariantPrice: money("90.00") },
    variants: ["Green", "Ocean", "Purple"].map((color, index) => ({
      id: `fallback-hoodie-${index + 1}`,
      title: `Small / ${color}`,
      availableForSale: true,
      quantityAvailable: 3 + index,
      price: money("90.00"),
      selectedOptions: [{ name: "Size", value: "Small" }, { name: "Color", value: color }],
    })),
  },
];
