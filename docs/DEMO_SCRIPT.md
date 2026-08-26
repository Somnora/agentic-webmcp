# Agentic WebMCP demo script

Target: under 3 minutes, public YouTube, 1920 x 1080, spoken audio. The
interactive driver below targets 1 minute 55 seconds; the longer narration
outline remains available for a manually edited cut.

## Interactive recording driver

The repository includes a deterministic visible-browser driver with a smooth cursor,
click rings, element spotlights, scene captions, and confirmed-result callouts. It
operates the live deployed interface and stops if the recording Chrome instance does
not expose the WebMCP API.

One-time setup:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-demo.txt
```

Record the production demo:

```bash
cd /Users/jamesmcshane/APP_PROJECTS/Agentic/agentic-webmcp
.venv/bin/python scripts/drive_demo.py
```

Start a 1500 × 950 or larger QuickTime screen recording when prompted. For a fast
automated QA pass with retained screenshots:

```bash
AGENTIC_DEMO_QA_DIR=docs/demo-qa .venv/bin/python scripts/drive_demo.py --fast
```

Chrome 149+ must have `chrome://flags/#enable-webmcp-testing` enabled for the final
take. The driver also requests the corresponding Blink testing feature on launch.

## 0:00–0:20 — Problem

Show the Agentic WebMCP workspace.

Narration: “Commerce sites contain structured facts, but browser agents often have to infer intent from visual controls. Agentic gives the page an explicit WebMCP tool layer while keeping the human and agent in the same visible workspace.”

## 0:20–0:40 — Tool discovery

Show WebMCP status and the four registered tool names. Briefly show source or inspector evidence if it is clean and readable.

Narration: “The page registers four focused, read-only tools: search, product inspection, comparison, and a grounded catalog brief. Each tool has a strict schema and compact result contract.”

## 0:40–1:05 — Search

Ask the agent: “Find comfortable hoodies in this catalog.” Show `search_products` executing and the product grid/activity timeline updating.

Narration: “The agent calls a catalog function instead of clicking through cards or scraping layout. The same result appears for the human, including source and live-status information.”

## 1:05–1:30 — Inspect and compare

Ask the agent to inspect slides, then compare slides and sweatpants. Show the shared UI state.

Narration: “Tool completion changes the human interface. Product facts are normalized, bounded, and returned from Shopify's public Mock Shop GraphQL demo. Externally sourced text is explicitly labeled untrusted.”

## 1:30–1:55 — Grounded brief

Ask for a concise brief using two selected products. Show `create_catalog_brief` and its source products.

Narration: “The brief is deterministic and grounded only in selected catalog facts. Agentic does not invent reviews, ratings, or outcome claims.”

## 1:55–2:20 — Reliability and impact

Show the read-only trust note and source indicator.

Narration: “The Worker enforces the same limits as the schemas, applies origin isolation and a self-only tools policy, and provides a visibly labeled fallback if the public demo catalog is unavailable. This is the open web with a reliable tool surface: explicit for agents, transparent for humans.”

## Recording checks

- No account names, passwords, tokens, browser bookmarks, unrelated tabs, or copyrighted music.
- Avoid prominent third-party logos or marks.
- Keep the video under three minutes.
- Confirm tool names, spoken claims, and deployed behavior match.
- Upload publicly to YouTube and test the link logged out.

## Ready-to-use media

- `docs/assets/agentic-webmcp-hero.jpg` — 1280 × 720 opening/title frame.
- `docs/assets/agentic-webmcp-comparison.jpg` — 1280 × 720 comparison and shared activity frame.
- `docs/assets/agentic-webmcp-enabled.jpg` — definitive WebMCP-enabled opening frame showing four registered tools.
- `docs/assets/agentic-webmcp-enabled-flow.jpg` — completed four-path activity and grounded brief.

Both captures come from the deployed Worker and contain no account details, tokens, bookmarks, or unrelated tabs.
