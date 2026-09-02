import { describe, expect, it, vi } from "vitest";
import { inspectOrigin } from "../src/origins";
import { createDiagnosticSink, markAdapterAttemptFailure, OriginFailure } from "../src/reliability";
import { fetchOriginText, observedFetcher, type Fetcher } from "../src/upstream";

const origin = inspectOrigin("catalog-lab");

function instrument(fetcher: Fetcher) {
  const diagnostics = createDiagnosticSink("0d3ba7bf-e578-46a9-b715-94e0a96732fe");
  return { diagnostics, fetcher: observedFetcher(fetcher, diagnostics) };
}

describe("bounded origin reliability", () => {
  it("propagates the correlation id and records a successful adapter timing", async () => {
    let outboundCorrelation = "";
    const base = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      outboundCorrelation = new Headers(init?.headers).get("X-Agentic-Correlation-Id") ?? "";
      return new Response(JSON.stringify({ products: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as Fetcher;
    const observed = instrument(base);
    const response = await fetchOriginText(origin, "/products.json?limit=24", { method: "GET" }, 1024, observed.fetcher, 100);
    expect(response.responseBytes).toBeGreaterThan(0);
    expect(outboundCorrelation).toBe(observed.diagnostics.correlationId);
    expect(observed.diagnostics.attempts).toEqual([
      expect.objectContaining({
        adapter: "public-products-json",
        operation: "catalog",
        outcome: "success",
        httpStatus: 200,
        responseBytes: response.responseBytes,
      }),
    ]);
  });

  it("marks the exact adapter attempt when parsing fails after concurrent requests", async () => {
    const diagnostics = createDiagnosticSink("0d3ba7bf-e578-46a9-b715-94e0a96732fe");
    const first = {
      adapter: "public-products-json" as const,
      operation: "product" as const,
      outcome: "success" as const,
      durationMs: 3,
      httpStatus: 200,
      responseBytes: 1,
    };
    const second = {
      adapter: "public-products-json" as const,
      operation: "product" as const,
      outcome: "success" as const,
      durationMs: 4,
      httpStatus: 200,
      responseBytes: 120,
    };
    diagnostics.record(first);
    diagnostics.record(second);

    markAdapterAttemptFailure(first, new OriginFailure("invalid-response", "Upstream returned invalid JSON."));

    expect(diagnostics.attempts).toEqual([
      expect.objectContaining({ outcome: "failure", failureReason: "invalid-response", responseBytes: 1 }),
      expect.objectContaining({ outcome: "success", responseBytes: 120 }),
    ]);
  });

  it("times out a fetch that never settles and records a normalized failure", async () => {
    const base = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as Fetcher;
    const observed = instrument(base);
    await expect(fetchOriginText(origin, "/products.json", { method: "GET" }, 1024, observed.fetcher, 15))
      .rejects.toMatchObject({ reason: "timeout" });
    expect(observed.diagnostics.attempts).toEqual([
      expect.objectContaining({ outcome: "failure", failureReason: "timeout", httpStatus: null }),
    ]);
  });

  it("applies the timeout while consuming the response body", async () => {
    const base = (async () => new Response(new ReadableStream<Uint8Array>({
      pull() {
        return new Promise<void>(() => undefined);
      },
    }), { status: 200 })) as Fetcher;
    const observed = instrument(base);
    await expect(fetchOriginText(origin, "/products.json", { method: "GET" }, 1024, observed.fetcher, 15))
      .rejects.toBeInstanceOf(OriginFailure);
    expect(observed.diagnostics.attempts[0]).toMatchObject({ failureReason: "timeout" });
  });

  it.each([
    [302, { Location: "https://outside.example/products/item" }, "off-origin-redirect"],
    [503, {}, "http-error"],
    [200, { "Content-Length": "2048" }, "response-too-large"],
  ])("normalizes HTTP policy failures for status %s", async (status, headers, reason) => {
    const base = vi.fn(async () => new Response("x", { status, headers })) as unknown as Fetcher;
    const observed = instrument(base);
    await expect(fetchOriginText(origin, "/products/item.json", { method: "GET" }, 1024, observed.fetcher, 100))
      .rejects.toMatchObject({ reason });
    expect(observed.diagnostics.attempts[0]).toMatchObject({
      adapter: "public-products-json",
      operation: "product",
      outcome: "failure",
      failureReason: reason,
    });
  });

  it("classifies password protection without following the redirect", async () => {
    const base = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: `${origin.canonicalUrl}/password` },
    })) as unknown as Fetcher;
    const observed = instrument(base);
    await expect(fetchOriginText(origin, "/products/item.json", { method: "GET" }, 1024, observed.fetcher, 100))
      .rejects.toMatchObject({ reason: "password-protected" });
    expect(base).toHaveBeenCalledTimes(1);
    expect(observed.diagnostics.attempts[0]).toMatchObject({ failureReason: "password-protected" });
  });

  it("rejects a target outside the exact HTTPS origin before fetch", async () => {
    const base = vi.fn() as unknown as Fetcher;
    const observed = instrument(base);
    await expect(fetchOriginText(origin, "https://outside.example/products/item.json", { method: "GET" }, 1024, observed.fetcher, 100))
      .rejects.toThrow("allowlisted origin");
    expect(base).not.toHaveBeenCalled();
    expect(observed.diagnostics.attempts).toEqual([]);
  });
});
