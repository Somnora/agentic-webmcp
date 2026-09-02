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
    additionalProperty: [
      { "@type": "PropertyValue", name: "condition", value: product.condition },
      { "@type": "PropertyValue", name: "condition_description", value: product.condition_description },
      { "@type": "PropertyValue", name: "seller_feedback_percent", value: product.seller.positive_feedback_percent },
      { "@type": "PropertyValue", name: "seller_feedback_count", value: product.seller.feedback_count },
      { "@type": "PropertyValue", name: "shipping_price", value: product.shipping.price },
      { "@type": "PropertyValue", name: "shipping_method", value: product.shipping.method },
      { "@type": "PropertyValue", name: "shipping_estimated_days_min", value: product.shipping.estimated_days_min },
      { "@type": "PropertyValue", name: "shipping_estimated_days_max", value: product.shipping.estimated_days_max },
      { "@type": "PropertyValue", name: "returns_accepted", value: product.returns.accepted },
      { "@type": "PropertyValue", name: "returns_window_days", value: product.returns.window_days },
      { "@type": "PropertyValue", name: "returns_paid_by", value: product.returns.paid_by },
    ],
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      name: variant.title,
      sku: variant.id,
      price: variant.price,
      priceCurrency: "USD",
      availability: variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: `https://schema.org/${product.condition === "new" ? "NewCondition" : "UsedCondition"}`,
      seller: { "@type": "Organization", name: product.seller.display_name },
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
  <title>${escapeHtml(product.title)} | Independent Gear Exchange</title>
  <style>body{max-width:760px;margin:60px auto;padding:0 24px;font:16px/1.6 system-ui;color:#17202a}nav,footer{color:#52606d}main{border:1px solid #d9e2ec;border-radius:18px;padding:30px}code{background:#f0f4f8;padding:2px 6px}</style>
  <script type="application/ld+json">${jsonLd(product, canonicalUrl)}</script>
</head>
<body>
  <nav>Independent Gear Exchange | Controlled WebMCP demonstration origin</nav>
  <main>
    <p>INDEPENDENT GEAR EXCHANGE</p>
    <h1>${escapeHtml(product.title)}</h1>
    ${product.body_html}
    <h2>Listing evidence</h2>
    <ul>
      <li>Condition: ${escapeHtml(product.condition.replaceAll("-", " "))}</li>
      <li>Condition notes: ${escapeHtml(product.condition_description)}</li>
      <li>Seller: ${escapeHtml(product.seller.display_name)}, ${product.seller.positive_feedback_percent.toFixed(1)}% positive across ${product.seller.feedback_count} reviews</li>
      <li>Shipping: ${escapeHtml(product.shipping.price)} USD by ${escapeHtml(product.shipping.method)}, estimated ${product.shipping.estimated_days_min} to ${product.shipping.estimated_days_max} days</li>
      <li>Returns: ${product.returns.accepted ? `${product.returns.window_days} days` : "not accepted"}</li>
    </ul>
    <h2>Variants</h2>
    <ul>${variants}</ul>
    <p>Canonical handle: <code>${escapeHtml(product.handle)}</code></p>
    <p>This controlled origin provides live HTTPS responses from original demonstration listings. It has no checkout, payment, accounts, or analytics.</p>
  </main>
  <footer>Independent Gear Exchange. Demonstration data only.</footer>
</body>
</html>`;
  return new Response(html, { headers: headers(HTML_HEADERS) });
}

function routeDemoOriginRequest(request: Request): Response {
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
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Independent Gear Exchange</title></head><body><main><h1>Independent Gear Exchange</h1><p>Controlled public guitar marketplace for WebMCP evaluation.</p><ul>${links}</ul></main></body></html>`, { headers: headers(HTML_HEADERS) });
  }
  return json({ error: "Not found." }, 404);
}

export function handleDemoOriginRequest(request: Request): Response {
  const startedAt = performance.now();
  const incoming = request.headers.get("X-Agentic-Correlation-Id") ?? "";
  const correlationId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incoming)
    ? incoming
    : crypto.randomUUID();
  const response = routeDemoOriginRequest(request);
  response.headers.set("X-Agentic-Correlation-Id", correlationId);
  console.log(JSON.stringify({
    event: "origin_request_complete",
    correlationId,
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    totalMs: Math.round((performance.now() - startedAt) * 10) / 10,
  }));
  return response;
}

export default { fetch: handleDemoOriginRequest } satisfies ExportedHandler;
