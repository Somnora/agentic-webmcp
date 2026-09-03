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
import { runOriginConformance } from "./conformance";
import { classifyError, fixedError, type ErrorCode } from "./errors";
import { interpolatePage } from "./interpolate";
import { createActivityItinerary } from "./itinerary";
import { DEFAULT_ORIGIN_ID, ORIGIN_MANIFEST_VERSION, getOrigin, inspectOrigin, publicOrigin, runtimeOrigins, type Origin } from "./origins";
import { findBestOptions } from "./recommendations";
import { createDiagnosticSink, normalizeFailureReason, type DiagnosticSink } from "./reliability";
import { observedFetcher, type Fetcher } from "./upstream";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_JSON_BODY_BYTES = 4096;

class UnsupportedMediaTypeError extends Error {}

type RequestReliability = {
  correlationId: string;
  startedAt: number;
  originId?: string;
  diagnostics: DiagnosticSink;
};

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
  headers.set("Cache-Control", cache ? "public, max-age=30, stale-while-revalidate=30" : "no-store");
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(error: unknown, pathname: string, correlationId: string): Response {
  const classified = error instanceof UnsupportedMediaTypeError
    ? fixedError(error.message, "UNSUPPORTED_MEDIA_TYPE", 415, correlationId)
    : classifyError(error, correlationId);
  console.error(JSON.stringify({
    event: "request_error",
    correlationId,
    path: pathname,
    code: classified.payload.code,
    retryable: classified.payload.retryable,
    reason: classified.payload.reason,
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

function optionalScalar(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") throw new RangeError(`${key} must be a string or number.`);
  return String(value);
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

function fetcherForOrigin(env: Env, origin: Origin, reliability: RequestReliability): Fetcher {
  reliability.originId = origin.id;
  let originFetcher = fetch as Fetcher;
  if (origin.mode === "controlled-demo") {
    const binding = Reflect.get(env, "DEMO_ORIGIN");
    const boundFetch = binding && typeof binding === "object" ? Reflect.get(binding, "fetch") : undefined;
    if (typeof boundFetch === "function") {
      originFetcher = ((input, init) => Reflect.apply(boundFetch, binding, [input, init]) as Promise<Response>) as Fetcher;
    }
  }
  return observedFetcher(originFetcher, reliability.diagnostics);
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

function decodedHandle(pathname: string, prefix = "/api/products/"): string {
  try {
    return validateHandle(decodeURIComponent(pathname.slice(prefix.length)));
  } catch {
    throw new RangeError("Product handle is invalid.");
  }
}

async function routeRequest(
  request: Request,
  env: Env,
  reliability: RequestReliability,
  ctx?: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const runtimeCatalogEnv = catalogEnv(env);
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
      return jsonResponse({ manifestVersion: ORIGIN_MANIFEST_VERSION, defaultOriginId: DEFAULT_ORIGIN_ID, origins: runtimeOrigins().map(publicOrigin) });
    }

    if (url.pathname === "/api/origins/health") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      return await cachedJson(request, ctx, async () => {
        const projection = await interpolatePage(origin, origin.healthPath, originFetcher, runtimeCatalogEnv);
        const status = projection.live && projection.pageLive
          ? "live"
          : projection.live
            ? "catalog-live-page-unavailable"
            : projection.pageLive ? "page-live-offer-fallback" : "fallback";
        return {
          origin: projection.origin,
          status,
          checkedAt: new Date().toISOString(),
          catalog: { live: projection.live, adapter: projection.source },
          page: { live: projection.pageLive, path: origin.healthPath },
          handoff: projection.offer.handoff,
          warning: projection.warning,
          retryable: status !== "live",
        };
      });
    }

    if (url.pathname === "/api/origins/diagnostics") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const checkedAt = new Date().toISOString();
      try {
        const projection = await interpolatePage(origin, origin.healthPath, originFetcher, runtimeCatalogEnv);
        const hasFailure = Boolean(projection.pageFailureReason || projection.catalogFailureReason);
        const status = projection.live && projection.pageLive && !hasFailure
          ? "live"
          : projection.live || projection.pageLive ? "degraded" : "fallback";
        return jsonResponse({
          correlationId: reliability.correlationId,
          origin: {
            id: origin.id,
            displayName: origin.displayName,
            hostname: origin.hostname,
            mode: origin.mode,
            configuredAdapter: origin.adapter,
          },
          checkedAt,
          status,
          activeAdapter: projection.source,
          catalogLive: projection.live,
          pageLive: projection.pageLive,
          handoff: projection.offer.handoff,
          verification: projection.offer.provenance.verification,
          failureReason: projection.pageFailureReason ?? projection.catalogFailureReason ?? null,
          policy: {
            timeoutMs: origin.policy.upstreamTimeoutMs,
            maxCatalogBytes: origin.policy.maxCatalogResponseBytes,
            maxPageBytes: origin.policy.maxPageResponseBytes,
          },
          attempts: reliability.diagnostics.attempts,
        });
      } catch (error) {
        return jsonResponse({
          correlationId: reliability.correlationId,
          origin: {
            id: origin.id,
            displayName: origin.displayName,
            hostname: origin.hostname,
            mode: origin.mode,
            configuredAdapter: origin.adapter,
          },
          checkedAt,
          status: "failed",
          activeAdapter: null,
          catalogLive: false,
          pageLive: false,
          handoff: null,
          verification: null,
          failureReason: normalizeFailureReason(error),
          policy: {
            timeoutMs: origin.policy.upstreamTimeoutMs,
            maxCatalogBytes: origin.policy.maxCatalogResponseBytes,
            maxPageBytes: origin.policy.maxPageResponseBytes,
          },
          attempts: reliability.diagnostics.attempts,
        });
      }
    }

    if (url.pathname === "/api/origins/conformance") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = inspectOrigin(url.searchParams.get("originId"));
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      return jsonResponse(await runOriginConformance(origin, originFetcher, runtimeCatalogEnv));
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
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const query = validateQuery(url.searchParams.get("query"));
      const limit = validateLimit(url.searchParams.get("limit"));
      return await cachedJson(request, ctx, () => searchProducts(query, limit, origin, originFetcher, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/recommendations") {
      if (request.method === "GET") {
        const origin = selectedOrigin(url);
        if (origin.vertical !== "marketplace") throw new RangeError("Evidence ranking is currently available for marketplace Offers only.");
        const originFetcher = fetcherForOrigin(env, origin, reliability);
        const query = url.searchParams.get("query") ?? "";
        const limit = url.searchParams.get("limit");
        const maxDeliveredPrice = url.searchParams.get("maxDeliveredPrice");
        return await cachedJson(
          request,
          ctx,
          () => findBestOptions(query, limit, maxDeliveredPrice, origin, originFetcher, runtimeCatalogEnv),
        );
      }
      if (request.method === "POST") {
        const body = await readBoundedJson(request);
        const origin = bodyOrigin(url, body);
        if (origin.vertical !== "marketplace") throw new RangeError("Evidence ranking is currently available for marketplace Offers only.");
        const originFetcher = fetcherForOrigin(env, origin, reliability);
        return jsonResponse(await findBestOptions(
          stringField(body, "query"),
          optionalScalar(body, "maxResults"),
          optionalScalar(body, "maxDeliveredPrice"),
          origin,
          originFetcher,
          runtimeCatalogEnv,
          body,
        ));
      }
      return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
    }

    if (url.pathname.startsWith("/api/products/")) {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      return await cachedJson(request, ctx, async () => {
        const result = await getProduct(decodedHandle(url.pathname), origin, originFetcher, runtimeCatalogEnv);
        if (!result.offers.length) throw new RangeError("Product not found.");
        return result;
      });
    }

    if (url.pathname.startsWith("/api/offers/")) {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      return await cachedJson(request, ctx, async () => {
        const result = await getProduct(decodedHandle(url.pathname, "/api/offers/"), origin, originFetcher, runtimeCatalogEnv);
        if (!result.offers.length) throw new RangeError("Offer not found.");
        return result;
      });
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const handles = validateHandles(url.searchParams.get("handles"));
      return await cachedJson(request, ctx, () => compareProducts(handles, origin, originFetcher, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/interpolate") {
      if (request.method !== "GET") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const origin = selectedOrigin(url);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const path = url.searchParams.get("path");
      if (path === null) throw new RangeError("path must be supplied.");
      return await cachedJson(request, ctx, () => interpolatePage(origin, path, originFetcher, runtimeCatalogEnv));
    }

    if (url.pathname === "/api/brief") {
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const body = await readBoundedJson(request);
      const origin = bodyOrigin(url, body);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
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
        ? await getProduct(handles[0]!, origin, originFetcher, runtimeCatalogEnv)
        : await compareProducts(handles, origin, originFetcher, runtimeCatalogEnv);
      return jsonResponse({ ...catalog, brief: createCatalogBrief(goal, catalog.offers) });
    }

    if (url.pathname === "/api/itinerary") {
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const body = await readBoundedJson(request);
      const origin = bodyOrigin(url, body);
      if (origin.vertical !== "services") throw new RangeError("Activity itineraries require a services origin.");
      const rawHandles = body.handles;
      if (!Array.isArray(rawHandles) || rawHandles.some((item) => typeof item !== "string")) {
        throw new RangeError("handles must be an array of service handles.");
      }
      const handles = rawHandles.map((item) => validateHandle(String(item)));
      if (handles.length < 1 || handles.length > 4 || new Set(handles).size !== handles.length) {
        throw new RangeError("Choose between 1 and 4 unique service handles.");
      }
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const projections = await Promise.all(handles.map((handle) => (
        interpolatePage(origin, `${origin.offerPathPrefix}/${handle}`, originFetcher, runtimeCatalogEnv)
      )));
      const offers = projections.map((projection) => projection.offer);
      const itinerary = createActivityItinerary({
        goal: stringField(body, "goal"),
        date: optionalString(body, "date"),
        days: body.days,
        partySize: body.partySize,
        budget: body.budget,
        pace: optionalString(body, "pace"),
        earliestStart: optionalString(body, "earliestStart"),
        latestEnd: optionalString(body, "latestEnd"),
      }, offers);
      const warnings = projections.flatMap((projection) => projection.warning ? [projection.warning] : []);
      return jsonResponse({
        origin: publicOrigin(origin),
        source: projections[0]?.source ?? origin.adapter,
        live: projections.every((projection) => projection.live),
        offers,
        ...(warnings.length ? { warning: warnings.join(" ").slice(0, 500) } : {}),
        itinerary,
      });
    }

    if (url.pathname === "/api/cart/propose" || url.pathname === "/api/cart/commit") {
      if (request.method !== "POST") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);
      const body = await readBoundedJson(request);
      const origin = bodyOrigin(url, body);
      const originFetcher = fetcherForOrigin(env, origin, reliability);
      const payload = cartInput(body, origin);
      if (url.pathname.endsWith("/propose")) {
        return jsonResponse(await proposeCartAdd(payload, origin, originFetcher, runtimeCatalogEnv));
      }
      if (request.headers.get("X-Agentic-Human-Confirm") !== "true") {
        throw new RangeError("Cart commit requires the human confirmation button.");
      }
      return jsonResponse(await commitCartAdd({ ...payload, reviewedQuote: body.quote }, origin, originFetcher, runtimeCatalogEnv));
    }

    if (url.pathname.startsWith("/api/")) return fixedErrorResponse("Not found.", "ROUTE_NOT_FOUND", 404);
    if (request.method !== "GET" && request.method !== "HEAD") return fixedErrorResponse("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

    const asset = await env.ASSETS.fetch(request);
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers: securityHeaders(new Headers(asset.headers)),
    });
}

function finalizeResponse(response: Response, request: Request, reliability: RequestReliability): Response {
  const totalMs = Math.round((performance.now() - reliability.startedAt) * 10) / 10;
  response.headers.set("X-Agentic-Correlation-Id", reliability.correlationId);
  const timings = [
    `app;dur=${totalMs}`,
    ...reliability.diagnostics.attempts.slice(0, 4).map((attempt, index) => (
      `origin${index};dur=${attempt.durationMs};desc="${attempt.adapter}"`
    )),
  ];
  response.headers.set("Server-Timing", timings.join(", "));
  console.log(JSON.stringify({
    event: "request_complete",
    correlationId: reliability.correlationId,
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    totalMs,
    originId: reliability.originId,
    adapterAttempts: reliability.diagnostics.attempts,
  }));
  return response;
}

export async function handleRequest(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const reliability: RequestReliability = {
    correlationId,
    startedAt: performance.now(),
    diagnostics: createDiagnosticSink(correlationId),
  };
  let response: Response;
  try {
    response = await routeRequest(request, env, reliability, ctx);
  } catch (error) {
    response = errorResponse(error, new URL(request.url).pathname, correlationId);
  }
  return finalizeResponse(response, request, reliability);
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
