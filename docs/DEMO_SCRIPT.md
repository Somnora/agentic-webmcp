# Agentic WebMCP demo script

Target: 2 minutes 28 seconds, public YouTube, 1280 x 720, spoken audio, no music.

Do not use the older four-tool screenshots or the older automated driver for the final take. They show the previous catalog flow. Record only after this branch is deployed and a fresh manual judge pass matches `docs/JUDGE_GUIDE.md`.

## Recording setup

1. Open the production URL in a WebMCP-capable browser at 1280 by 720.
2. Close unrelated tabs and hide bookmarks, account details, and browser extensions from the capture.
3. Click `Presenter mode`. The same result is available with `?present=1`.
4. Use `Start 2:28 rehearsal` until the narration fits comfortably. Pause and Next are rehearsal controls only.
5. For the final take, reload presenter mode and invoke the real WebMCP tools from the agent. The overlay reacts to those real calls.
6. Park the physical pointer in an empty area. Presenter mode replaces the operating system pointer with the high-contrast SVG pointer. Physical movement labels it `HUMAN`; tool-directed movement labels it `AGENT`.

The focus frame is one fixed overlay. It transitions its position, dimensions, and corner radius instead of destroying and recreating selection boxes. The overlay changes sides when a right-rail action is selected so it does not cover the confirmation banner or receipt.

## 0:00 to 0:12: The converter idea

Focus: registered-tool status.

Narration: "Most websites make agents reverse engineer a visual interface. Agentic adds an explicit capability layer while keeping the human on the same page."

Under the hood: the top-level document registers eight bounded tools. Seven are read-only, and one can only stage a proposal.

## 0:12 to 0:22: Discover origins

Ask: `List the allowlisted origins and show which adapter each one uses.`

Narration: "The agent begins by discovering the exact public origins and adapters this page permits."

Under the hood: the Worker reads origin records from one static allowlist. No tool can supply an arbitrary hostname.

## 0:22 to 0:30: Select the origin

Ask: `Select catalog-lab for the rest of this task.`

Narration: "It selects the controlled public catalog. The source mode and live adapter remain visible to the human."

Under the hood: selection changes page-local state, and every later read carries a validated origin id.

## 0:30 to 0:48: Search a stable handle

Ask: `Search the selected origin for notebook and return the stable handles.`

Narration: "A natural language goal becomes a typed search call. Stable handles and source-grounded facts appear in the shared workspace."

Under the hood: bounded product JSON is fetched over HTTPS and normalized into the shared Offer protocol.

## 0:48 to 1:18: Convert one page

Ask: `Interpolate /products/field-notebook into stripped Markdown and a structured Offer.`

Narration: "This is the converter: one real HTTPS page becomes compact Markdown plus a structured Offer, with its canonical URL and provenance intact."

Under the hood: exact host and path validation runs before Cloudflare HTMLRewriter removes navigation, footer, scripts, styles, frames, and forms. Structured adapters remain authoritative for inventory.

## 1:18 to 1:38: Compare normalized offers

Ask: `Compare field-notebook and modular-desk-tray using only origin facts.`

Narration: "Because every adapter produces the same Offer shape, the agent can compare products without learning a second catalog model."

Under the hood: comparison consumes the same normalized Offer graph and retains field-level provenance.

## 1:38 to 2:00: Propose and stop

Ask: `Propose adding quantity 1 of the Sand variant of field-notebook, then wait for me.`

Narration: "The agent stages one available variant, then stops. The empty cart and the confirmation boundary are both visible."

Under the hood: the proposal creates a short-lived quote with `awaiting_human_confirmation` status and leaves the cart unchanged.

## 2:00 to 2:20: Human control

Move the pointer to `Confirm add to cart` and click it yourself. Show the `in_cart` receipt.

Narration: "The human confirms. Only that button commits the page-local receipt, and the activity rail records the boundary."

Under the hood: there is no WebMCP commit tool, checkout, payment, or merchant cart.

## 2:20 to 2:28: Trust boundary

Show the trust note and source label.

Narration: "Agents get a useful open-web interface, while people retain source visibility and final control over writes."

Under the hood: every upstream request is HTTPS, exact-host allowlisted, path checked, off-host redirects rejected, and response-byte bounded.

## Recording checks

- Confirm the deployed header says `8 WebMCP tools registered`.
- Confirm the source badge is honest for the current adapter and fallback state.
- Confirm the footer commit matches the submitted repository commit.
- Confirm the presenter cursor stays fully inside the capture and changes to `HUMAN` when the physical pointer moves.
- Confirm the focus frame does not overlap the tool overlay on search, interpolation, comparison, confirmation, or receipt steps.
- Keep the origin badge, interpolate view, confirmation banner, and receipt legible at 1280 x 720.
- Do not show product images, external pages, third-party logos, account names, passwords, tokens, browser bookmarks, unrelated tabs, or copyrighted music.
- Keep the `controlled demo` label visible and never describe the fixture catalog as current merchant inventory.
- Do not claim conversion, sales impact, crawler adoption, or customer token savings.
- Upload publicly to YouTube and test the link while logged out.

## Remaining required artifact

The public YouTube URL is still required. No video was recorded or uploaded by this implementation task.
