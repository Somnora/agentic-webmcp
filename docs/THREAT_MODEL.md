# Threat model

## Protected assets

- Integrity of the visible human-agent workspace.
- Availability of the public demo.
- Correct attribution of live versus fallback catalog results.
- No leakage of commercial Agentic credentials or private merchant data.

## Trust boundaries

1. Product text from Shopify Mock Shop is external and untrusted.
2. Tool arguments are model-controlled and untrusted.
3. Manual form input is user-controlled and untrusted.
4. The Worker API is internet-accessible and must enforce limits independently of browser JSON Schema.
5. Static page assets and APIs share one origin; no cross-origin tool exposure is configured.

## Controls

- All tools are read-only and annotated with `readOnlyHint` and `untrustedContentHint`.
- Tool outputs are compact and bounded to approximately 1.5K characters.
- Query length, result count, handles, comparison size, brief goals, and request bodies are bounded in Worker code.
- Product handles must match a strict lowercase alphanumeric/hyphen pattern.
- Externally sourced strings are normalized and truncated before returning to the browser.
- The UI creates DOM nodes and assigns `textContent`; it does not inject catalog strings as HTML.
- The CSP permits scripts, styles, and connections only from the application origin, with HTTPS images allowed.
- `tools` permission is self-only. Framing is denied and no `exposedTo` origins are declared.
- The document opts into an origin agent cluster.
- No production secrets, Admin API tokens, customer data, checkout, cart, account, billing, or mutation routes exist.
- Upstream failure activates a labeled fallback instead of silently presenting stale data as live.

## Considered attacks

| Attack | Expected result |
| --- | --- |
| Prompt injection embedded in product description | Treated as untrusted content; shown as text and never executed |
| Path traversal through product handle | Rejected with HTTP 400 |
| Excessive result count | Rejected with HTTP 400 |
| Duplicate or excessive comparison handles | Rejected with HTTP 400 |
| Oversized or malformed brief request | Rejected before catalog work |
| Cross-origin iframe attempting tool access | Blocked by framing and no cross-origin exposure |
| Upstream outage | Labeled fallback with bounded snapshot |
| Unsupported API route or method | 404 or 405; no implicit proxy behavior |

## Intentionally absent

- No user accounts or authentication.
- No persistent storage.
- No cookies.
- No analytics identifiers.
- No product, cart, checkout, order, customer, or payment mutations.

Any future write-capable tool requires a separate consent design, authentication boundary, CSRF controls, and action-time confirmation model.
