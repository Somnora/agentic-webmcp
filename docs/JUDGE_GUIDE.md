# Judge testing guide

## Access

- Live app: https://agentic-webmcp.somnora.workers.dev/
- Credentials: none
- Recommended browser: ChatGPT's WebMCP-enabled in-app browser
- Chrome alternative: enable `chrome://flags/#enable-webmcp-testing`, restart Chrome, then open the live app

The header should read `4 WebMCP tools registered`. If the browser does not expose WebMCP, the page accurately reports that state and keeps a complete manual preview available.

## Two-minute evaluation

1. Ask: `Find comfortable hoodies in this catalog.`
   - Expected tool: `search_products`
   - Expected visible change: product grid and activity timeline show the search.
2. Ask: `Inspect the available sizes and prices for slides.`
   - Expected tool: `get_product` with handle `slides`
   - Expected visible change: the workspace narrows to Slides and displays sampled variant facts.
3. Ask: `Compare slides and sweatpants using only catalog facts.`
   - Expected tool: `compare_products` with `slides` and `sweatpants`
   - Expected visible change: two comparison cards and compact source-grounded output.
4. Ask: `Create a concise brief for comfortable everyday apparel using slides and sweatpants.`
   - Expected tool: `create_catalog_brief`
   - Expected visible change: selected products remain visible and the activity rail shows the grounded brief call.

## Trust and reliability checks

- All tools are read-only and carry `readOnlyHint` plus `untrustedContentHint`.
- Product text is rendered with `textContent`, never injected as HTML.
- Source state says `Live Shopify Mock Shop` or clearly labels the bundled fallback.
- There are no accounts, cookies, demo credentials, payment actions, mutations, or production merchant data.
- Invalid result counts and malformed handles fail closed with HTTP 400.

## Reproduction

```bash
git clone https://github.com/Somnora/agentic-webmcp.git
cd agentic-webmcp
npm ci
npm run verify
```

No environment variables are required. The public GitHub Actions workflow runs the same verification gate.
