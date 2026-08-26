const baseUrl = (process.env.AGENTIC_WEBMCP_URL || "https://agentic-webmcp.somnora.workers.dev").replace(/\/$/, "");

const checks = [
  {
    name: "health",
    run: async () => {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "ok") throw new Error(`unexpected response ${response.status}`);
      if (response.headers.get("Origin-Agent-Cluster") !== "?1") throw new Error("missing origin isolation");
      if (!response.headers.get("Permissions-Policy")?.includes("tools=(self)")) throw new Error("missing tools policy");
    },
  },
  {
    name: "workspace",
    run: async () => {
      const response = await fetch(`${baseUrl}/`);
      const html = await response.text();
      if (response.status !== 200 || !html.includes("Commerce agents should call tools")) throw new Error("workspace unavailable");
    },
  },
  {
    name: "WebMCP registration client",
    run: async () => {
      const response = await fetch(`${baseUrl}/app.js`);
      const script = await response.text();
      for (const tool of ["search_products", "get_product", "compare_products", "create_catalog_brief"]) {
        if (!script.includes(`name: \"${tool}\"`)) throw new Error(`${tool} is not registered`);
      }
    },
  },
  {
    name: "catalog search",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/catalog?query=hoodie&limit=4`);
      const body = await response.json();
      if (response.status !== 200 || !Array.isArray(body.products) || body.products.length < 1) throw new Error("catalog returned no products");
    },
  },
  {
    name: "product details",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/products/slides`);
      const body = await response.json();
      if (response.status !== 200 || body.products?.[0]?.handle !== "slides") throw new Error("slides unavailable");
    },
  },
  {
    name: "input rejection",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/catalog?limit=99`);
      if (response.status !== 400) throw new Error(`expected 400, received ${response.status}`);
    },
  },
];

let failures = 0;
console.log(`Verifying ${baseUrl}`);
for (const check of checks) {
  const started = Date.now();
  try {
    await check.run();
    console.log(`[PASS] ${check.name} (${Date.now() - started}ms)`);
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}
if (failures) process.exitCode = 1;
else console.log(`All ${checks.length} live checks passed.`);
