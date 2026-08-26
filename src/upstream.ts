import type { Origin } from "./origins";

export type Fetcher = typeof fetch;

export type OriginTextResponse = {
  text: string;
  contentType: string;
  fetchedUrl: string;
};

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

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Upstream response exceeded the byte limit.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Upstream response exceeded the byte limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchOriginText(
  origin: Origin,
  path: string,
  init: RequestInit,
  maxBytes: number,
  fetcher: Fetcher = fetch,
): Promise<OriginTextResponse> {
  const url = targetUrl(origin, path);
  const response = await fetcher(url.toString(), { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location) {
      const redirect = new URL(location, url);
      if (redirect.protocol !== "https:" || redirect.hostname.toLocaleLowerCase() !== origin.hostname) {
        throw new Error("Upstream attempted an off-origin redirect.");
      }
    }
    throw new Error("Upstream redirect was not followed because the destination path is not allowlisted.");
  }
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
  return {
    text: await boundedText(response, maxBytes),
    contentType: response.headers.get("Content-Type") ?? "",
    fetchedUrl: url.toString(),
  };
}
