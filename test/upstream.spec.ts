import { describe, expect, it, vi } from "vitest";
import { getOrigin } from "../src/origins";
import { fetchOriginText } from "../src/upstream";

const origin = getOrigin("review-shop");

describe("bounded allowlisted upstream fetches", () => {
  it("rejects off-origin redirects without following them", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: "https://evil.example/products/x" },
    })) as typeof fetch;
    await expect(fetchOriginText(origin, "/products/the-complete-snowboard", {}, 1024, fetcher))
      .rejects.toThrow("off-origin redirect");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("labels password protection and refuses the redirect", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: `${origin.canonicalUrl}/password` },
    })) as typeof fetch;
    await expect(fetchOriginText(origin, "/products/the-complete-snowboard", {}, 1024, fetcher))
      .rejects.toThrow("password protected");
  });

  it("stops reading when the byte limit is exceeded", async () => {
    const fetcher = vi.fn(async () => new Response("x".repeat(2048), {
      headers: { "Content-Type": "text/plain" },
    })) as typeof fetch;
    await expect(fetchOriginText(origin, "/products/the-complete-snowboard", {}, 128, fetcher))
      .rejects.toThrow("byte limit");
  });

  it("rejects target URLs outside the exact HTTPS origin", async () => {
    const fetcher = vi.fn() as typeof fetch;
    await expect(fetchOriginText(origin, "https://evil.example/products/x", {}, 128, fetcher))
      .rejects.toThrow("allowlisted origin");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
