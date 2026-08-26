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
import { classifyError, fixedError, type ErrorCode } from "./errors";
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

function errorResponse(error: unknown, pathname: string): Response {
  const classified = error instanceof UnsupportedMediaTypeError
    ? fixedError(error.message, "UNSUPPORTED_MEDIA_TYPE", 415)
    : classifyError(error);
  console.error(JSON.stringify({
    event: "request_error",
    path: pathname,
    code: classified.payload.code,
    retryable: classified.payload.retryable,
  }));
  return jsonResponse(classified.payload, classified.status);
}

function fixedErrorResponse(error: string, code: ErrorCode, status: number): Response {
  const classified = fixedError(error, code, status);
  return jsonResponse(classified.payload, classified.status);
}

async function cachedJson(
  request: Request,
  ctx: ExecutionContext | undefined,
  producer: () => Promise<unknown>,
): Promise<Response> {
  const cacheCandidate = typeof caches === "undefined" ? undefined : Reflect.get(caches, "default");
  const workerCache = cacheCandidate
    && typeof cacheCandidate === "object"
    && typeof Reflect.get(cacheCandidate, "match") === "function"
    && typeof Reflect.get(cacheCandidate, "put") === "function"
    ? cacheCandidate as Cache
    : undefined;
  const key = new Request(request.url, { method: "GET" });
  if (workerCache) {
    const cached = await workerCache.match(key);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Agentic-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }
  }
  const response = jsonResponse(await producer(), 200, true);
  response.headers.set("X-Agentic-Cache", "MISS");
  if (workerCache && ctx) ctx.waitUntil(workerCache.put(key, response.clone()));
  return response;
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

function deploymentMetadata(env: Env): WorkerVersionMetadata | undefined {
  const value = Reflect.get(env, "VERSION_METADATA");
  if (!value || typeof value !== "object") return undefined;
  const id = Reflect.get(value, "id");
  const tag = Reflect.get(value, "tag");
  const timestamp = Reflect.get(value, "timestamp");
  return typeof id === "string" && typeof tag === "string" && typeof timestamp === "string"
    ? { id, tag, timestamp }
    : undefined;
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

export async function handleRequest(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const runtimeCatalogEnv = catalogEnv(env);
  try {
    if (url.pathname === "/health") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const deployment = deploymentMetadata(env);
      return jsonResponse({
        status: "ok",
        service: "agentic-webmcp",
        webmcp: "imperative-api",
        defaultOriginId: DEFAULT_ORIGIN_ID,
        deployment: {
          commit: bindingString(env, "APP_COMMIT") ?? "unknown",
          versionId: deployment?.id ?? "local",
          deployedAt: deployment?.timestamp ?? null,
        },
      });
    }

    if (url.pathname === "/api/origins") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      return jsonResponse({ defaultOriginId: DEFAULT_ORIGIN_ID, origins: ORIGINS.map(publicOrigin) }, 200, true);
    }

    if (url.pathname === "/api/origins/health") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      return await cachedJson(request, ctx, async () => {
        const projection = await interpolatePage(origin, origin.healthPath, fetch, runtimeCatalogEnv);
        const status = projection.pageLive ? "live" : projection.live ? "catalog-live-page-unavailable" : "fallback";
        return {
          origin: projection.origin,
          status,
          checkedAt: new Date().toISOString(),
          catalog: { live: projection.live, adapter: projection.source },
          page: { live: projection.pageLive, path: origin.healthPath },
          warning: projection.warning,
          retryable: !projection.pageLive,
        };
      });
    }

    if (url.pathname === "/api/origins/select") {
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const body = await readBoundedJson(request);
      const origin = getOrigin(stringField(body, "originId"));
      return jsonResponse({ selected: publicOrigin(origin), sessionless: true });
    }

    if (url.pathname === "/api/catalog") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const query = validateQuery(url.searchParams.get("query"));
      const limit = validateLimit(url.searchParams.get("limit"));
      return await cachedJson(request, ctx, () => searchProducts(query, limit, origin, fetch, runtimeCatalogEnv));
    }

    if (url.pathname.startsWith("/api/products/")) {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      return await cachedJson(request, ctx, async () => {
        const result = await getProduct(decodedHandle(url.pathname), origin, fetch, runtimeCatalogEnv);
        if (!result.offers.length) throw new RangeError("Product not found.");
        return result;
      });
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const handles = validateHandles(url.searchParams.get("handles"));
      return await cachedJson(request, ctx, () => compareProducts(handles, origin, fetch, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/interpolate") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const path = url.searchParams.get("path");
      if (path === null) throw new RangeError("path must be supplied.");
      return await cachedJson(request, ctx, () => interpolatePage(origin, path, fetch, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/brief") {
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
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
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
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

    if (url.pathname.startsWith("/api/")) return fixedErrorResponse("Not found.", "ROUTE_NOT_FOUND", 404);
    if (request.method !== "GET" && request.method !== "HEAD") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

    const asset = await env.ASSETS.fetch(request);
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers: securityHeaders(new Headers(asset.headers)),
    });
  } catch (error) {
    return errorResponse(error, url.pathname);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
