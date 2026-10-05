---
name: OpenAPI mutation flags
description: Contract pattern for optional controls in generated mutation clients.
---

For optional POST controls such as forced re-analysis, prefer a named JSON request-body schema over query parameters when query-parameter generation causes duplicate Orval exports.

**Why:** An optional query-based re-analysis flag caused generated type collisions; modeling it as a request body removed the collision.

**How to apply:** After changing an optional mutation control, regenerate the client and Zod contracts and run their typechecks.
