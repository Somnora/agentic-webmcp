import { describe, expect, it, vi } from "vitest";
import { runOriginConformance } from "../src/conformance";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { inspectOrigin } from "../src/origins";
import type { Fetcher } from "../src/upstream";

const origin = inspectOrigin("catalog-lab");
const demoFetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
  const request = new Request(String(input), init);
  return handleDemoOriginRequest(request);
}) as Fetcher;

describe("origin conformance", () => {
  it("validates the controlled origin contract end to end", async () => {
    const report = await runOriginConformance(origin, demoFetcher, {}, new Date("2026-09-01T12:00:00.000Z"));
    expect(report.status).toBe("pass");
    expect(report.summary).toBe("10 passed, 0 need attention, 0 failed.");
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "hostname", status: "pass" }),
      expect.objectContaining({ id: "paths", status: "pass" }),
      expect.objectContaining({ id: "redirects", status: "pass" }),
      expect.objectContaining({ id: "response-limits", status: "pass" }),
      expect.objectContaining({ id: "adapters", status: "pass" }),
      expect.objectContaining({ id: "provenance", status: "pass", detail: expect.stringContaining("Verified across product JSON and page") }),
      expect.objectContaining({ id: "freshness", status: "pass" }),
      expect.objectContaining({ id: "fallback", status: "pass", detail: expect.stringContaining("fail closed") }),
    ]));
  });

  it("reports expired authorization without contacting the origin", async () => {
    const fetcher = vi.fn(demoFetcher);
    const report = await runOriginConformance(origin, fetcher, {}, new Date("2027-08-26T00:00:00.000Z"));
    expect(report.status).toBe("fail");
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "authorization", status: "fail" }),
      expect.objectContaining({ id: "adapters", status: "fail", detail: expect.stringContaining("skipped") }),
      expect.objectContaining({ id: "provenance", status: "fail", detail: expect.stringContaining("not read") }),
      expect.objectContaining({ id: "freshness", status: "fail", detail: expect.stringContaining("not read") }),
    ]));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not report fallback conformance when configuration fails internally", async () => {
    const merchant = inspectOrigin("review-shop");
    const report = await runOriginConformance(
      merchant,
      demoFetcher,
      { CATALOG_SHOP: "different-shop.myshopify.com" },
      new Date("2026-09-01T12:00:00.000Z"),
    );
    expect(report.status).toBe("fail");
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "fallback", status: "fail", detail: expect.stringContaining("could not be proven") }),
    ]));
  });
});
