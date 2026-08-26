import { FALLBACK_PRODUCTS, type Money, type Product, type ProductVariant } from "./demo-catalog";

export const MOCK_SHOP_GRAPHQL_URL = "https://mock.shop/api";
const MAX_CATALOG_RESULTS = 8;
const MAX_COMPARE_PRODUCTS = 4;
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

type Fetcher = typeof fetch;

type GraphqlProduct = {
  handle?: unknown;
  title?: unknown;
  description?: unknown;
  vendor?: unknown;
  productType?: unknown;
  featuredImage?: { url?: unknown; altText?: unknown } | null;
  priceRange?: {
    minVariantPrice?: { amount?: unknown; currencyCode?: unknown };
    maxVariantPrice?: { amount?: unknown; currencyCode?: unknown };
  };
  variants?: { nodes?: unknown[] };
};

export type CatalogResult = {
  source: "shopify-mock-shop" | "bundled-fallback";
  live: boolean;
  products: Product[];
  warning?: string;
};

const CATALOG_QUERY = `
  query AgenticWebMcpCatalog($first: Int!) {
    products(first: $first) {
      nodes {
        handle
        title
        description
        vendor
        productType
        featuredImage { url altText }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        variants(first: 8) {
          nodes {
            id
            title
            availableForSale
            quantityAvailable
            price { amount currencyCode }
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

const PRODUCT_QUERY = `
  query AgenticWebMcpProduct($handle: String!) {
    product(handle: $handle) {
      handle
      title
      description
      vendor
      productType
      featuredImage { url altText }
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      variants(first: 8) {
        nodes {
          id
          title
          availableForSale
          quantityAvailable
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
`;

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMoney(value: unknown): Money {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const amountValue = text(candidate.amount, 24);
  const numeric = Number.parseFloat(amountValue);
  return {
    amount: Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00",
    currencyCode: text(candidate.currencyCode, 8) || "USD",
  };
}

function normalizeVariant(value: unknown): ProductVariant | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = text(candidate.id, 180);
  const title = text(candidate.title, 120);
  if (!id || !title) return null;
  const selectedOptions = Array.isArray(candidate.selectedOptions)
    ? candidate.selectedOptions.slice(0, 6).flatMap((option) => {
        if (!option || typeof option !== "object") return [];
        const pair = option as Record<string, unknown>;
        const name = text(pair.name, 40);
        const valueText = text(pair.value, 80);
        return name && valueText ? [{ name, value: valueText }] : [];
      })
    : [];
  return {
    id,
    title,
    availableForSale: candidate.availableForSale === true,
    quantityAvailable: numberOrNull(candidate.quantityAvailable),
    price: normalizeMoney(candidate.price),
    selectedOptions,
  };
}

export function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as GraphqlProduct;
  const handle = text(candidate.handle, 100);
  const title = text(candidate.title, 160);
  if (!HANDLE_PATTERN.test(handle) || !title) return null;
  const min = normalizeMoney(candidate.priceRange?.minVariantPrice);
  const max = normalizeMoney(candidate.priceRange?.maxVariantPrice);
  const variants = Array.isArray(candidate.variants?.nodes)
    ? candidate.variants.nodes.slice(0, 8).map(normalizeVariant).filter((item): item is ProductVariant => item !== null)
    : [];
  const imageUrl = text(candidate.featuredImage?.url, 500);
  return {
    handle,
    title,
    description: text(candidate.description, 600),
    vendor: text(candidate.vendor, 100),
    productType: text(candidate.productType, 100),
    featuredImage: imageUrl
      ? { url: imageUrl, altText: text(candidate.featuredImage?.altText, 180) || null }
      : null,
    priceRange: { minVariantPrice: min, maxVariantPrice: max },
    variants,
  };
}

async function graphql<T>(query: string, variables: Record<string, unknown>, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(MOCK_SHOP_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Agentic-WebMCP/0.1",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Catalog upstream returned HTTP ${response.status}.`);
  const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (payload.errors?.length || !payload.data) {
    throw new Error(text(payload.errors?.[0]?.message, 180) || "Catalog upstream returned an invalid GraphQL response.");
  }
  return payload.data;
}

function matchesQuery(product: Product, query: string): boolean {
  if (!query) return true;
  const haystack = [product.title, product.handle, product.description, product.vendor, product.productType]
    .join(" ")
    .toLocaleLowerCase();
  return query.toLocaleLowerCase().split(/\s+/).every((term) => haystack.includes(term));
}

export function validateQuery(raw: string | null): string {
  const query = (raw ?? "").trim();
  if (query.length > 80) throw new RangeError("Search query must be 80 characters or fewer.");
  return query;
}

export function validateLimit(raw: string | null): number {
  if (raw === null || raw === "") return 6;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CATALOG_RESULTS) {
    throw new RangeError(`Result limit must be an integer from 1 to ${MAX_CATALOG_RESULTS}.`);
  }
  return limit;
}

export function validateHandle(raw: string): string {
  const handle = raw.trim().toLocaleLowerCase();
  if (!HANDLE_PATTERN.test(handle)) throw new RangeError("Product handle is invalid.");
  return handle;
}

export function validateHandles(raw: string | null): string[] {
  const handles = [...new Set((raw ?? "").split(",").map((item) => item.trim()).filter(Boolean).map(validateHandle))];
  if (handles.length < 2 || handles.length > MAX_COMPARE_PRODUCTS) {
    throw new RangeError(`Choose between 2 and ${MAX_COMPARE_PRODUCTS} unique product handles.`);
  }
  return handles;
}

export async function searchProducts(query: string, limit: number, fetcher: Fetcher = fetch): Promise<CatalogResult> {
  try {
    const data = await graphql<{ products?: { nodes?: unknown[] } }>(CATALOG_QUERY, { first: 24 }, fetcher);
    const products = (data.products?.nodes ?? []).map(normalizeProduct).filter((item): item is Product => item !== null);
    return { source: "shopify-mock-shop", live: true, products: products.filter((item) => matchesQuery(item, query)).slice(0, limit) };
  } catch {
    return {
      source: "bundled-fallback",
      live: false,
      products: FALLBACK_PRODUCTS.filter((item) => matchesQuery(item, query)).slice(0, limit),
      warning: "Shopify Mock Shop was unavailable, so Agentic used its clearly labeled bundled demo snapshot.",
    };
  }
}

export async function getProduct(handleInput: string, fetcher: Fetcher = fetch): Promise<CatalogResult> {
  const handle = validateHandle(handleInput);
  try {
    const data = await graphql<{ product?: unknown }>(PRODUCT_QUERY, { handle }, fetcher);
    const product = normalizeProduct(data.product);
    return { source: "shopify-mock-shop", live: true, products: product ? [product] : [] };
  } catch {
    const product = FALLBACK_PRODUCTS.find((item) => item.handle === handle);
    return {
      source: "bundled-fallback",
      live: false,
      products: product ? [product] : [],
      warning: "Shopify Mock Shop was unavailable, so Agentic used its clearly labeled bundled demo snapshot.",
    };
  }
}

export async function compareProducts(handles: string[], fetcher: Fetcher = fetch): Promise<CatalogResult> {
  const validated = validateHandles(handles.join(","));
  const results = await Promise.all(validated.map((handle) => getProduct(handle, fetcher)));
  const products = results.flatMap((result) => result.products);
  const live = results.every((result) => result.live);
  const unique = [...new Map(products.map((product) => [product.handle, product])).values()];
  return {
    source: live ? "shopify-mock-shop" : "bundled-fallback",
    live,
    products: unique,
    ...(live ? {} : { warning: "At least one comparison result came from the bundled demo snapshot." }),
  };
}

function priceLabel(product: Product): string {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  return min.amount === max.amount
    ? `${min.amount} ${min.currencyCode}`
    : `${min.amount}–${max.amount} ${min.currencyCode}`;
}

export function createCatalogBrief(goalInput: string, products: Product[]): string {
  const goal = goalInput.trim();
  if (!goal || goal.length > 160) throw new RangeError("Brief goal must be between 1 and 160 characters.");
  if (products.length < 1 || products.length > MAX_COMPARE_PRODUCTS) {
    throw new RangeError(`Choose between 1 and ${MAX_COMPARE_PRODUCTS} products for a catalog brief.`);
  }
  const lines = [`# Catalog brief`, `Goal: ${goal}`, "", "Products:"];
  for (const product of products) {
    const available = product.variants.filter((variant) => variant.availableForSale).length;
    lines.push(`- ${product.title} (${product.handle}): ${priceLabel(product)}; ${available}/${product.variants.length} sampled variants available.`);
  }
  lines.push("", "Source facts only. Product descriptions and availability remain untrusted catalog content.");
  return lines.join("\n").slice(0, 1400);
}
