import { compareProducts, createCatalogBrief, getProduct, searchProducts, validateHandle, validateHandles, validateLimit, validateQuery } from "./catalog";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_JSON_BODY_BYTES = 4096;

function securityHeaders(headers: Headers): Headers {
  headers.set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src https: data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
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
  const known = error instanceof RangeError;
  return jsonResponse({ error: known ? error.message : "The catalog request could not be completed." }, known ? 400 : 502);
}

async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
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
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
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

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/health") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      return jsonResponse({ status: "ok", service: "agentic-webmcp", webmcp: "imperative-api" });
    }

    if (url.pathname === "/api/catalog") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const query = validateQuery(url.searchParams.get("query"));
      const limit = validateLimit(url.searchParams.get("limit"));
      return jsonResponse(await searchProducts(query, limit), 200, true);
    }

    if (url.pathname.startsWith("/api/products/")) {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const encoded = url.pathname.slice("/api/products/".length);
      const handle = validateHandle(decodeURIComponent(encoded));
      const result = await getProduct(handle);
      return result.products.length ? jsonResponse(result, 200, true) : jsonResponse({ error: "Product not found." }, 404);
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      const handles = validateHandles(url.searchParams.get("handles"));
      return jsonResponse(await compareProducts(handles), 200, true);
    }

    if (url.pathname === "/api/brief") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
      if (!(request.headers.get("Content-Type") ?? "").toLocaleLowerCase().startsWith("application/json")) {
        return jsonResponse({ error: "Content-Type must be application/json." }, 415);
      }
      const body = await readBoundedJson(request);
      const goal = stringField(body, "goal");
      const rawHandles = body.handles;
      if (!Array.isArray(rawHandles) || rawHandles.some((item) => typeof item !== "string")) {
        throw new RangeError("handles must be an array of product handles.");
      }
      const handles = rawHandles.map((item) => validateHandle(item as string));
      if (handles.length < 1 || handles.length > 4 || new Set(handles).size !== handles.length) {
        throw new RangeError("Choose between 1 and 4 unique product handles.");
      }
      const catalog = handles.length === 1 ? await getProduct(handles[0]!) : await compareProducts(handles);
      return jsonResponse({ ...catalog, brief: createCatalogBrief(goal, catalog.products) });
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
