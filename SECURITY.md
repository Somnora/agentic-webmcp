# Security policy

Agentic WebMCP is a public, stateless Challenge demo. It intentionally exposes only read-only catalog operations and contains no production merchant credentials or customer data.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to `support@somnora.app`. Include the affected URL, a concise reproduction, and the impact you observed. Do not include live secrets or personal information in the report.

Please do not open a public issue for an unpatched vulnerability. We will acknowledge a report as soon as practical and coordinate disclosure after a fix is available.

## Supported version

The deployed `main` branch at <https://agentic-webmcp.somnora.workers.dev/> is the supported Challenge build. Security controls and trust boundaries are documented in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
