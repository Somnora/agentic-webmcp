import { DEMO_PRODUCTS, demoProduct, type DemoProduct } from "./demo-origin-catalog";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" };
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

function headers(contentType: Record<string, string>): Headers {
  const result = new Headers(contentType);
  result.set("Cache-Control", "public, max-age=300");
  result.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'");
  result.set("Referrer-Policy", "no-referrer");
  result.set("X-Content-Type-Options", "nosniff");
  result.set("X-Frame-Options", "DENY");
  return result;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: headers(JSON_HEADERS) });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonLd(product: DemoProduct, canonicalUrl: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.body_html.replace(/<[^>]+>/g, ""),
    sku: product.id,
    brand: { "@type": "Brand", name: product.vendor },
    url: `${canonicalUrl}/products/${product.handle}`,
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      name: variant.title,
      sku: variant.id,
      price: variant.price,
      priceCurrency: "USD",
      availability: variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  }).replaceAll("<", "\\u003c");
}

function productPage(product: DemoProduct, canonicalUrl: string): Response {
  const variants = product.variants.map((variant) => `
    <li>${escapeHtml(variant.title)}: ${escapeHtml(variant.price)} USD, ${variant.available ? "available" : "unavailable"}</li>`).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.title)} | Agentic Catalog Lab</title>
  <style>body{max-width:760px;margin:60px auto;padding:0 24px;font:16px/1.6 system-ui;color:#17202a}nav,footer{color:#52606d}main{border:1px solid #d9e2ec;border-radius:18px;padding:30px}code{background:#f0f4f8;padding:2px 6px}</style>
  <script type="application/ld+json">${jsonLd(product, canonicalUrl)}</script>
</head>
<body>
  <nav>Agentic Catalog Lab | Controlled WebMCP demonstration origin</nav>
  <main>
    <p>CONTROLLED PUBLIC DEMO CATALOG</p>
    <h1>${escapeHtml(product.title)}</h1>
    ${product.body_html}
    <h2>Variants</h2>
    <ul>${variants}</ul>
    <p>Canonical handle: <code>${escapeHtml(product.handle)}</code></p>
    <p>This origin provides live HTTPS responses from original fixture content. It has no checkout, payment, accounts, or analytics.</p>
  </main>
  <footer>Agentic Catalog Lab. Demonstration data only.</footer>
</body>
</html>`;
  return new Response(html, { headers: headers(HTML_HEADERS) });
}

export function handleDemoOriginRequest(request: Request): Response {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
  if (url.pathname === "/health") return json({ status: "ok", service: "agentic-webmcp-origin", products: DEMO_PRODUCTS.length });
  if (url.pathname === "/products.json") return json({ products: DEMO_PRODUCTS });
  const jsonMatch = /^\/products\/([^/]+)\.json$/.exec(url.pathname);
  if (jsonMatch?.[1] && HANDLE_PATTERN.test(jsonMatch[1])) {
    const product = demoProduct(jsonMatch[1]);
    return product ? json(product) : json({ error: "Product not found." }, 404);
  }
  const pageMatch = /^\/products\/([^/]+)\/?$/.exec(url.pathname);
  if (pageMatch?.[1] && HANDLE_PATTERN.test(pageMatch[1])) {
    const product = demoProduct(pageMatch[1]);
    return product ? productPage(product, url.origin) : json({ error: "Product not found." }, 404);
  }
  if (url.pathname === "/") {
    const links = DEMO_PRODUCTS.map((product) => `<li><a href="/products/${product.handle}">${escapeHtml(product.title)}</a></li>`).join("");
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Agentic Catalog Lab</title></head><body><main><h1>Agentic Catalog Lab</h1><p>Controlled public demonstration catalog for WebMCP evaluation.</p><ul>${links}</ul></main></body></html>`, { headers: headers(HTML_HEADERS) });
  }
  return json({ error: "Not found." }, 404);
}

export default { fetch: handleDemoOriginRequest } satisfies ExportedHandler;
