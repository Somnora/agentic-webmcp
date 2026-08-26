import {
  compareProducts,
  createCatalogBrief,
  getProduct,
  searchProducts,
  validateHandle,
  validateHandles,
  validateLimit,
  validateQuery,
  type CatalogEnv,
} from "./catalog";
import { commitCartAdd, proposeCartAdd, type CartInput } from "./cart";
import { interpolatePage } from "./interpolate";
import { DEFAULT_ORIGIN_ID, ORIGINS, getOrigin, publicOrigin, type Origin } from "./origins";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_JSON_BODY_BYTES = 4096;

class UnsupportedMediaTypeError extends Error {}

function securityHeaders(headers: Headers): Headers {
  headers.set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
  headers.set("Permissions-Policy", "tools=(self), camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

function jsonResponse(payload: unknown, status = 200, cache = false): Response {
  const headers = securityHeaders(new Headers(JSON_HEADERS));
  headers.set("Cache-Control", cache ? "public, max-age=60, stale-while-revalidate=300" : "no-store");
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(error: unknown): Response {
  if (error instanceof UnsupportedMediaTypeError) return jsonResponse({ error: error.message }, 415);
  const known = error instanceof RangeError;
  return jsonResponse({ error: known ? error.message : "The allowlisted origin request could not be completed." }, known ? 400 : 502);
}

async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("Content-Type") ?? "").toLocaleLowerCase().startsWith("application/json")) {
    throw new UnsupportedMediaTypeError("Content-Type must be application/json.");
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_JSON_BODY_BYTES) throw new RangeError("Request body is too large.");
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new RangeError("Request body must be a JSON object.");
  }
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") throw new RangeError(`${key} must be a string.`);
  return value;
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new RangeError(`${key} must be a string.`);
  return value;
}

function bindingString(env: Env, name: string): string | undefined {
  const value = Reflect.get(env, name);
  return typeof value === "string" ? value : undefined;
}

function catalogEnv(env: Env): CatalogEnv {
  const shop = bindingString(env, "CATALOG_SHOP");
  const token = bindingString(env, "CATALOG_STOREFRONT_TOKEN");
  return {
    ...(shop ? { CATALOG_SHOP: shop } : {}),
    ...(token ? { CATALOG_STOREFRONT_TOKEN: token } : {}),
  };
}

function selectedOrigin(url: URL): Origin {
  return getOrigin(url.searchParams.get("originId"));
}

function bodyOrigin(url: URL, body: Record<string, unknown>): Origin {
  const queryId = url.searchParams.get("originId")?.trim().toLocaleLowerCase();
  const bodyValue = optionalString(body, "originId");
  const bodyId = bodyValue?.trim().toLocaleLowerCase();
  if (queryId && bodyId && queryId !== bodyId) {
    throw new RangeError("Request origin does not match the selected origin.");
  }
  return getOrigin(bodyId || queryId);
}

function cartInput(body: Record<string, unknown>, origin: Origin): CartInput {
  const variantId = optionalString(body, "variantId");
  const variantTitle = optionalString(body, "variantTitle");
  return {
    originId: optionalString(body, "originId") ?? origin.id,
    handle: stringField(body, "handle"),
    ...(variantId ? { variantId } : {}),
    ...(variantTitle ? { variantTitle } : {}),
    quantity: body.quantity,
  };
}

function decodedHandle(pathname: string): string {
  try {
    return validateHandle(decodeURIComponent(pathname.slice("/api/products/".length)));
  } catch {
    throw new RangeError("Product handle is invalid.");
  }
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runtimeCatalogEnv = catalogEnv(env);
  try {
    if (url.pathname === "/health") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      return jsonResponse({ status: "ok", service: "agentic-webmcp", webmcp: "imperative-api", defaultOriginId: DEFAULT_ORIGIN_ID });
    }

    if (url.pathname === "/api/origins") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      return jsonResponse({ defaultOriginId: DEFAULT_ORIGIN_ID, origins: ORIGINS.map(publicOrigin) }, 200, true);
    }

    if (url.pathname === "/api/origins/select") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
      const body = await readBoundedJson(request);
      const origin = getOrigin(stringField(body, "originId"));
      return jsonResponse({ selected: publicOrigin(origin), sessionless: true });
    }

    if (url.pathname === "/api/catalog") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const origin = selectedOrigin(url);
      const query = validateQuery(url.searchParams.get("query"));
      const limit = validateLimit(url.searchParams.get("limit"));
      return jsonResponse(await searchProducts(query, limit, origin, fetch, runtimeCatalogEnv), 200, true);
    }

    if (url.pathname.startsWith("/api/products/")) {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const origin = selectedOrigin(url);
      const result = await getProduct(decodedHandle(url.pathname), origin, fetch, runtimeCatalogEnv);
      return result.offers.length ? jsonResponse(result, 200, true) : jsonResponse({ error: "Product not found." }, 404);
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const origin = selectedOrigin(url);
      const handles = validateHandles(url.searchParams.get("handles"));
      return jsonResponse(await compareProducts(handles, origin, fetch, runtimeCatalogEnv), 200, true);
    }

    if (url.pathname === "/api/interpolate") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const origin = selectedOrigin(url);
      const path = url.searchParams.get("path");
      if (path === null) throw new RangeError("path must be supplied.");
      return jsonResponse(await interpolatePage(origin, path, fetch, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/brief") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
      const body = await readBoundedJson(request);
      const origin = bodyOrigin(url, body);
      const goal = stringField(body, "goal");
      const rawHandles = body.handles;
      if (!Array.isArray(rawHandles) || rawHandles.some((item) => typeof item !== "string")) {
        throw new RangeError("handles must be an array of product handles.");
      }
      const handles = rawHandles.map((item) => validateHandle(String(item)));
      if (handles.length < 1 || handles.length > 4 || new Set(handles).size !== handles.length) {
        throw new RangeError("Choose between 1 and 4 unique product handles.");
      }
      const catalog = handles.length === 1
        ? await getProduct(handles[0]!, origin, fetch, runtimeCatalogEnv)
        : await compareProducts(handles, origin, fetch, runtimeCatalogEnv);
      return jsonResponse({ ...catalog, brief: createCatalogBrief(goal, catalog.offers) });
    }

    if (url.pathname === "/api/cart/propose" || url.pathname === "/api/cart/commit") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
      const body = await readBoundedJson(request);
      const origin = bodyOrigin(url, body);
      const payload = cartInput(body, origin);
      if (url.pathname.endsWith("/propose")) {
        return jsonResponse(await proposeCartAdd(payload, origin, fetch, runtimeCatalogEnv));
      }
      if (request.headers.get("X-Agentic-Human-Confirm") !== "true") {
        throw new RangeError("Cart commit requires the human confirmation button.");
      }
      const quoteId = stringField(body, "quoteId");
      const expiresAt = stringField(body, "expiresAt");
      return jsonResponse(await commitCartAdd({ ...payload, quoteId, expiresAt }, origin, fetch, runtimeCatalogEnv));
    }

    if (url.pathname.startsWith("/api/")) return jsonResponse({ error: "Not found." }, 404);
    if (request.method !== "GET" && request.method !== "HEAD") return jsonResponse({ error: "Method not allowed." }, 405);

    const asset = await env.ASSETS.fetch(request);
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers: securityHeaders(new Headers(asset.headers)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
