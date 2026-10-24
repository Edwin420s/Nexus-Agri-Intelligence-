# Product Requirements and Acceptance Criteria

## 1. Investigation management
- **FR-001 Create:** accept a question (8–2,000 chars), location, crop/activity, optional context.
- **FR-002 Validate:** reject malformed or oversized input with a clear message.
- **FR-003 Persist:** assign identifiers and persist each completed result.
- **FR-004 Track:** expose status, timestamps, and connector/model modes.
- **FR-005 Idempotency:** production API should add request idempotency to prevent duplicate runs; current prototype does not yet implement a client idempotency key.
- **FR-006 Partial completion:** identify missing connectors and affected evidence.
- **FR-007 History:** list and reopen saved investigations.
- **FR-008 Cancellation:** future requirement for queued/long-running orchestration; not implemented in current synchronous prototype.

## 2. Research planning and retrieval
- **FR-009** Convert the question into explicit research objectives (current UI scenario is predefined; a structured planner remains a gap).
- **FR-010** Define required evidence by investigation type (initial deterministic checklist implemented at prototype level).
- **FR-011** Show unsupported objectives and unavailable sources.
- **FR-012** Bound network timeouts and response sizes.
- **FR-013** Validate all model-generated structured output.
- **FR-014** Retrieve only through configured, authorized connectors.
- **FR-015** Distinguish success, empty result, authentication failure, timeout, and malformed response.
- **FR-016** Normalize into a common evidence schema.
- **FR-017** preserve source identity and available retrieval/publication/observation dates.
- **FR-018** Flag missing/stale date information; domain-specific freshness thresholds remain to be defined.
- **FR-019** detect duplicate observations in a future iteration; not yet implemented.
- **FR-020** never compare incompatible units without a documented conversion.
- **FR-021** surface connector failures.
- **FR-022** respect source licensing and retention restrictions.

## 3. Evidence reasoning
- **FR-023** record explicit quality flags.
- **FR-024** link material claims to evidence IDs.
- **FR-025** detect opposing encoded evidence relations by topic.
- **FR-026** distinguish observations, user inputs, assumptions, calculations, and model hypotheses.
- **FR-027** explain evidence limitations.
- **FR-028** constrain model to supplied evidence for factual claims.
- **FR-029** compute evidence status in application code, not from model confidence.
- **FR-030** validate generated outputs against a schema.

## 4. Economics and reporting
- **FR-031** support transparent cost calculations when valid inputs exist; full economic model remains a future requirement.
- **FR-032** label sourced values, user inputs, and assumptions separately.
- **FR-033** state unit of analysis and production cycle.
- **FR-034** block unsupported numeric profitability claims when critical inputs are missing.
- **FR-035** provide sensitivity analysis when inputs support it; not yet implemented.
- **FR-036** never label illustrative scenarios as calibrated forecasts.
- **FR-037** generate structured dossiers.
- **FR-038** show evidence references where available.
- **FR-039** explain status and unmet requirements.
- **FR-040** show investigation and evidence dates.
- **FR-041** preserve each run as a separate record/version.
- **FR-042** report export (PDF/HTML) remains a planned enhancement.

## 5. Integration and operations
- **FR-043** distinguish configured from verified integrations.
- **FR-044** allow non-destructive integration smoke tests.
- **FR-045** bound timeouts; retry/backoff policy requires additional work before production.
- **FR-046** keep secrets server-side and out of Git.
- **FR-047** provide redacted diagnostics.
- **FR-048** label live, synthetic, cached, and mocked data distinctly.

## 6. Non-functional requirements
- Correctness: calculations and decision policy deterministic for fixed inputs/rule version.
- Reliability: one connector failure must not masquerade as a successful live result.
- Security: input validation, body limits, safe link protocols, secret hygiene; authentication/authorization still required before multi-user deployment.
- Performance: measure end-to-end duration and provider latency before setting targets.
- Accessibility: plain language, keyboard-friendly controls, responsive layout, status not communicated by color alone.
- Maintainability: typed contracts, isolated adapters, repeatable tests, updated docs.
- Reproducibility: setup and demo behavior documented, external credentials and dataset limits explicit.

## 7. Acceptance criteria for first credible demo
1. User submits the Kirinyaga tomato investigation.
2. The UI displays real backend state and clear live/demo mode.
3. A live Zetaris query is demonstrated if claiming Zetaris integration.
4. The required Meterless operation is demonstrated if claiming Meterless integration.
5. A real Nemotron inference is demonstrated and model identity independently verified if claiming Nemotron.
6. Evidence records preserve available source details and quality flags.
7. Synthetic fixtures cannot yield a supported real-world decision.
8. Decision policy output is reproducible.
9. The dossier identifies gaps and next actions.
10. User can reopen a saved investigation.
11. Build and tests pass in a clean install.
12. README clearly identifies all remaining limitations.
