import type { Adapter, Origin } from "./origins";
import {
  OriginFailure,
  normalizeFailureReason,
  type AdapterAttempt,
  type AdapterOperation,
  type DiagnosticSink,
} from "./reliability";

export type Fetcher = {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  diagnostics?: DiagnosticSink;
};

export type OriginTextResponse = {
  text: string;
  contentType: string;
  fetchedUrl: string;
  responseBytes: number;
  httpStatus: number;
  diagnosticAttempt?: AdapterAttempt;
};

export function observedFetcher(fetcher: Fetcher, diagnostics: DiagnosticSink): Fetcher {
  const observed = ((input: RequestInfo | URL, init?: RequestInit) => fetcher(input, init)) as Fetcher;
  observed.diagnostics = diagnostics;
  return observed;
}

function targetUrl(origin: Origin, path: string): URL {
  let url: URL;
  try {
    url = new URL(path, origin.canonicalUrl);
  } catch {
    throw new RangeError("Upstream path is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.hostname.toLocaleLowerCase() !== origin.hostname
    || url.port
    || url.username
    || url.password
  ) {
    throw new RangeError("Upstream target does not match the allowlisted origin.");
  }
  return url;
}

async function boundedText(response: Response, maxBytes: number): Promise<{ text: string; bytes: number }> {
  const declared = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new OriginFailure("response-too-large", "Upstream response exceeded the byte limit.", response.status);
  }
  if (!response.body) return { text: "", bytes: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new OriginFailure("response-too-large", "Upstream response exceeded the byte limit.", response.status);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), bytes: size };
}

function adapterFor(origin: Origin, url: URL): Adapter {
  if (url.pathname.endsWith("/graphql.json")) return "shopify-storefront";
  if (url.pathname === "/products.json" || /\/products\/[^/]+\.(?:js|json)$/.test(url.pathname)) {
    return origin.adapter === "public-products-json" ? "public-products-json" : "shopify-products-json";
  }
  if (url.pathname === "/services.json" || /\/services\/[^/]+\.json$/.test(url.pathname)) {
    return "public-services-json";
  }
  return "html-markdown";
}

function operationFor(url: URL, init: RequestInit): AdapterOperation {
  if (url.pathname.endsWith("/graphql.json")) {
    const body = typeof init.body === "string" ? init.body : "";
    return body.includes("\"handle\"") ? "product" : "catalog";
  }
  if (url.pathname === "/products.json") return "catalog";
  if (/\/products\/[^/]+\.(?:js|json)$/.test(url.pathname)) return "product";
  if (url.pathname === "/services.json") return "catalog";
  if (/\/services\/[^/]+\.json$/.test(url.pathname)) return "product";
  return "page";
}

async function performFetch(
  origin: Origin,
  url: URL,
  init: RequestInit,
  maxBytes: number,
  fetcher: Fetcher,
  controller: AbortController,
): Promise<OriginTextResponse> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    const correlationId = fetcher.diagnostics?.correlationId;
    if (correlationId) headers.set("X-Agentic-Correlation-Id", correlationId);
    response = await fetcher(url.toString(), { ...init, headers, redirect: "manual", signal: controller.signal });
  } catch (error) {
    if (error instanceof OriginFailure) throw error;
    throw new OriginFailure("network", "The allowlisted origin could not be reached.");
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location) {
      let redirect: URL;
      try {
        redirect = new URL(location, url);
      } catch {
        throw new OriginFailure("redirect-blocked", "Upstream returned an invalid redirect.", response.status);
      }
      if (redirect.protocol !== "https:" || redirect.hostname.toLocaleLowerCase() !== origin.hostname) {
        throw new OriginFailure("off-origin-redirect", "Upstream attempted an off-origin redirect.", response.status);
      }
      if (redirect.pathname === "/password") {
        throw new OriginFailure("password-protected", "Origin storefront is password protected.", response.status);
      }
    }
    throw new OriginFailure(
      "redirect-blocked",
      "Upstream redirect was not followed because the destination path is not allowlisted.",
      response.status,
    );
  }
  if (!response.ok) throw new OriginFailure("http-error", `Upstream returned HTTP ${response.status}.`, response.status);
  const bounded = await boundedText(response, maxBytes);
  return {
    text: bounded.text,
    contentType: response.headers.get("Content-Type") ?? "",
    fetchedUrl: url.toString(),
    responseBytes: bounded.bytes,
    httpStatus: response.status,
  };
}

export async function fetchOriginText(
  origin: Origin,
  path: string,
  init: RequestInit,
  maxBytes: number,
  fetcher: Fetcher = fetch,
  timeoutMs = origin.policy.upstreamTimeoutMs,
): Promise<OriginTextResponse> {
  const url = targetUrl(origin, path);
  const diagnostics = fetcher.diagnostics;
  const adapter = adapterFor(origin, url);
  const operation = operationFor(url, init);
  const startedAt = performance.now();
  const controller = new AbortController();
  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort("origin-timeout");
        reject(new OriginFailure("timeout", `Allowlisted origin request timed out after ${timeoutMs} ms.`));
      }, timeoutMs);
    });
    const response = await Promise.race([
      performFetch(origin, url, init, maxBytes, fetcher, controller),
      timeout,
    ]);
    const attempt: AdapterAttempt = {
      adapter,
      operation,
      outcome: "success",
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
    };
    diagnostics?.record(attempt);
    return diagnostics ? { ...response, diagnosticAttempt: attempt } : response;
  } catch (error) {
    const failure = timedOut
      ? new OriginFailure("timeout", `Allowlisted origin request timed out after ${timeoutMs} ms.`)
      : error;
    diagnostics?.record({
      adapter,
      operation,
      outcome: "failure",
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      httpStatus: failure instanceof OriginFailure ? failure.httpStatus ?? null : null,
      failureReason: normalizeFailureReason(failure),
    });
    throw failure;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
