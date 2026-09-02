# Origin onboarding contract

Agentic reads only merchant origins that are declared in `src/origins.ts`. Adding a record is a code-reviewed authorization step, not an open URL submission feature.

## Eligibility

An origin can be added when its operator controls the website or has explicit permission to use and display its catalog data. The record must state the authorization evidence, data rights, allowed uses, attestation date, and review date. Do not add a marketplace, retailer, or brand merely because its pages are public.

## Required manifest fields

Each record declares:

- One exact lowercase HTTPS hostname and canonical root URL
- Anchored, restrictive product and interpolation path patterns. Catch-all and nested product patterns fail validation.
- One primary adapter and an ordered fallback chain
- Catalog, interpolation, handoff, checkout, and payment capabilities
- Maximum Offer age, upstream timeout, and bounded response sizes
- A public health path and known test handles
- Authorization status, evidence, data rights, scopes, and review date

The runtime validates the complete registry at startup. It rejects duplicate hostnames, insecure roots, overbroad paths, inactive authorization, unsupported handoff policy, checkout or payment capabilities, timeouts outside 250 to 10000 milliseconds, and response limits outside the accepted bounds.

## Adapter acceptance

Before a record is accepted, automated tests must prove that its adapter normalizes catalog and product responses into the shared Offer protocol. Every returned Offer is checked against the selected manifest for origin id, exact canonical hostname, product path, vertical, adapter chain, currency, field provenance, freshness window, and handoff eligibility projection.

Run the conformance command while the app is available locally:

```bash
npm run check:origin -- origin-id
```

For production, pass the deployed app as the second argument. The command uses the Worker contract as its single source of truth. It validates the hostname and path policy, proves off-origin redirects and oversized responses are rejected, exercises the configured adapter, checks field provenance and freshness, and confirms that upstream failure becomes a labeled fallback or fails closed.

The adapter sequence may fall back for research. A bundled snapshot is always `live: false`, is clearly labeled, and cannot enter a merchant handoff.

After onboarding, open the origin diagnostics drawer or request `/api/origins/diagnostics?originId=origin-id`. A conforming origin reports the active adapter, request timings, response bounds, evidence verification, handoff state, and a normalized failure reason when an adapter cannot complete.

When both structured product data and JSON-LD are available, the Worker reconciles price, availability, condition, shipping, and returns inside the same Offer provenance. Conflicts remain visible and make the reconciled Offer ineligible for handoff.

## Production handoff boundary

The Challenge build supports only `live-fresh-offer-only`. A proposal is rejected unless the selected Offer is live, within the manifest freshness window, and available. Human approval creates an in-page decision record. Checkout and payment remain on the merchant website and are disabled in the manifest.

## Revocation

To revoke an origin, mark its authorization inactive or remove the record, run the full verification suite, and deploy the Worker. The registry validation fails closed if an inactive origin remains enabled. Runtime requests also fail closed at the exact `reviewAfter` timestamp. The expired origin is removed from discovery, API access returns `ORIGIN_AUTHORIZATION_INACTIVE`, and conformance reports the expired authorization without contacting the origin. Authorization must be renewed and deployed before use continues.

## Secrets

Origin manifests contain no Storefront tokens, passwords, cookies, Admin API credentials, or commercial application bindings. Optional read-only Storefront credentials remain Worker secrets and never appear in the repository or browser.
