---
name: Saved-analysis provider errors
description: Diagnostic and error-handling rules for AI-backed saved YouTube research.
---

When diagnosing saved-session analysis failures, separate provider initialization, provider HTTP failures, JSON parsing, and schema validation. Provider quota or billing failures are availability problems, not evidence that the output schema is too strict. Preserve the provider abstraction and validation requirements; log only sanitized provider metadata and return a safe, actionable service error.

**Why:** A generic 502 can hide an upstream quota failure and tempt changes to prompts or validation that do not address the actual cause.

**How to apply:** Inspect sanitized status/code/type for failures at the provider call. Map recognized quota exhaustion to an actionable 503, and do not expose credentials, request bodies, or research content.
