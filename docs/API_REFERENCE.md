# API Reference

Base URL for local development: `http://localhost:3000`.

## `GET /api/health`
Returns application version and integration configuration states. A `configured_unverified` state means only that environment values exist; it is not a successful connectivity check.

Example response shape:
```json
{
  "ok": true,
  "app": "Nexus",
  "version": "1.0.0",
  "integrations": {
    "zetaris": { "configured": false, "status": "not_configured" },
    "meterless_runtime": { "configured": false, "status": "not_configured" },
    "hmem": { "available": false, "source": "disabled: H-MEM integration not verified/configured" },
    "nemotron": { "status": "unverified" }
  }
}
```

## `POST /api/integrations/test`
Performs a source retrieval attempt and a minimal model inference if configured. This can incur provider usage/cost. Do not expose this endpoint publicly without authentication and rate limits.

## `POST /api/investigations`
Creates, runs, and saves an investigation synchronously.

Request:
```json
{
  "question": "Assess whether small-scale tomato farming is worth investigating.",
  "location": "Kirinyaga County, Kenya",
  "crop_or_activity": "Tomato farming",
  "context": "Optional user-provided assumptions"
}
```

`question` must be 8–2,000 characters. Location, crop/activity, and context are optional; the initial demo defaults to Kirinyaga County and tomato farming.

Response: an `InvestigationResult` object. HTTP 201 indicates the investigation result was generated and saved; its internal `status` may still be `PARTIAL` or `FAILED` depending on available evidence/integrations.

## `POST /api/investigate`
Backward-compatible alias with the same request/response behavior.

## `GET /api/investigations`
Returns `{ "investigations": [...] }` containing summary fields for recent saved results. Prototype store retains up to 200 results.

## `GET /api/investigations/:id`
Returns the saved dossier matching its investigation ID or run ID. Returns 404 if not found.

## `GET /api/investigations/:id/evidence`
Returns `{ "investigation_id": "...", "evidence": [...] }`.

## `GET /api/investigations/:id/report`
Returns `{ "investigation_id": "...", "report_version": 1, "report": { ... } }`.

## Error behavior
- 400: invalid input or malformed JSON.
- 404: unknown investigation.
- 429: prototype per-IP throttle exceeded.
- 500: unexpected server/storage failure, with details intentionally withheld from the client.

## Limitations
There is no authentication or record-level authorization yet. The API is a single-user local prototype and must not be exposed with confidential data. Synchronous execution, no cancellation/idempotency key, and local JSON persistence are known limitations.
