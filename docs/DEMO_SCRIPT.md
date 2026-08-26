# Agentic WebMCP demo script

Target: under three minutes, public YouTube, 1280 x 720 or larger, spoken audio, no music.

Do not use the older four-tool screenshots or the older automated driver for the final take. They show the previous catalog flow. Record only after this branch is deployed and a fresh manual judge pass matches `docs/JUDGE_GUIDE.md`.

## 0:00 to 0:20: Problem and origin

Show the page header, eight-tool status, origin switcher, health line, source badge, search prompts, and interpolate control.

Narration: "A commerce agent should receive explicit capabilities and source labels, not guess through visual controls. Agentic is a structured agent view over one exact allowlisted merchant origin."

## 0:20 to 0:40: Tool discovery

Ask: `List the allowlisted origins and select review-shop.`

Show `list_origins` and `select_origin` in the activity rail. Keep the hostname and adapter visible. Do not show a framed third-party page.

Narration: "The top-level document registers eight WebMCP tools. Seven read origin and offer facts. One can only stage a cart proposal."

## 0:40 to 1:05: Search a stable handle

Ask: `Search the selected origin for wax and return the stable handles.`

Show `selling-plans-ski-wax`, the adapter badge, and the activity entry.

Narration: "The Worker tries a read-only Storefront API token, then public products JSON, then a clearly labeled bundled snapshot. The interface never presents fallback facts as live."

## 1:05 to 1:35: Interpolate a product page

Ask: `Interpolate /products/the-complete-snowboard into stripped Markdown and a structured Offer.`

Show the canonical URL as text, the live page status, stripped Markdown, structured Offer projection, and field provenance. If the page is password-protected, show and say that `pageLive` is false. Do not imply that blocked page HTML was fetched.

Narration: "Interpolation accepts only a path declared on the selected origin. Cloudflare HTMLRewriter removes navigation, footer, scripts, styles, frames, and forms. Structured adapters remain the authority for inventory."

## 1:35 to 1:55: Compare offers

Ask: `Compare the-complete-snowboard and selling-plans-ski-wax using only origin facts.`

Show two comparison cards and the compact result panel.

Narration: "Both projections use one Offer protocol, so comparison does not require a second catalog model."

## 1:55 to 2:25: Propose and confirm

Ask: `Propose adding quantity 1 of the Ice variant of the-complete-snowboard, then wait for me.`

Pause on the visible confirmation banner and empty cart. Click `Confirm add to cart` yourself. Show the `in_cart` receipt.

Narration: "The agent can stage a short-lived quote, but it cannot commit. Only this human button calls the commit route. The receipt is in-page state, not a merchant cart, checkout, or payment."

## 2:25 to 2:45: Trust boundary

Show the trust note and source label.

Narration: "Every upstream request is HTTPS, exact-host allowlisted, path checked, redirect restricted, and byte bounded. Origin content stays untrusted and visible to the human."

If time permits, click `Copy trace` and briefly show that the shared tool record is exportable.

## Recording checks

- Confirm the deployed header says `8 WebMCP tools registered`.
- Confirm the source badge is honest for the current adapter and fallback state.
- Confirm the footer commit matches the submitted repository commit.
- Keep the origin badge, suggested prompts, interpolate view, confirmation banner, and receipt legible at 1280 x 720.
- Do not show product images, external pages, third-party logos, account names, passwords, tokens, browser bookmarks, unrelated tabs, or copyrighted music.
- The default hostname contains a platform trademark. Confirm that its appearance is permitted for the final video or replace it with an owned, allowlisted hostname before recording.
- Do not claim conversion, sales impact, crawler adoption, or customer token savings.
- Upload publicly to YouTube and test the link while logged out.

## Remaining required artifact

The public YouTube URL is still required. No video was recorded or uploaded by this implementation task.
