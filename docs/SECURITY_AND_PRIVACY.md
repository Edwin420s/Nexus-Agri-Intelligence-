# Security, Privacy and Responsible AI

## Data handled
Potential investigation inputs may include business plans, budgets, farm details, supplier quotations, buyer terms, and other commercially sensitive information. Collect only what is needed for the investigation.

## Threats and controls

| Threat | Current/required control | Status |
|---|---|---|
| API key committed to Git | `.env` ignored; use `.env.example` only | Implemented as repository convention; audit before publish |
| Secret leakage in logs/UI | Do not return provider headers/tokens; redact diagnostics | Basic; production redaction review required |
| Oversized request | Express JSON body limit | Implemented (32 KB) |
| Request abuse | Basic in-process 30 req/min/IP throttle | Prototype only; not distributed or production grade |
| Cross-site framing/content sniffing | Security response headers | Basic headers implemented |
| XSS through evidence | Escape displayed text; safe HTTP(S) links | Implemented in current UI; retest any future UI additions |
| Prompt injection in source content | Treat source records as untrusted data; restrict tools; no arbitrary execution | Prompt instruction present; adversarial tests required |
| Model fabricates citations | Validate evidence IDs in future claim-level validator; deterministic policy is model-independent | Partial; claim-level citation validator remains a gap |
| Cross-user data access | Authentication, authorization, tenant isolation | Not implemented; do not deploy with private multi-user data |
| Data loss/corruption | Transactional persistence and backups | Local JSON store only; not production safe |
| Data retained beyond permission | Source licensing and retention registry | Policy/documentation required per source |
| Unsupported agricultural advice | Limitations, missing evidence, human verification | Product guardrail; expert validation remains required |
| Untrusted URL/SSRF | Provider endpoints are operator-configured; source URLs are not fetched by UI | Endpoint allowlisting and deployment egress policy still required |

## Privacy requirements before production
- Define retention, deletion, export, and backup behavior.
- Add authentication and record-level authorization.
- Encrypt traffic and protect storage according to the deployment context.
- Avoid collecting personal data unless necessary.
- Do not send sensitive user details to model providers unless authorized and disclosed.
- Document data processing, provider terms, licensing, and permitted retention.
- Keep a redacted operational audit trail for material investigation events.

## AI safeguards
- The model is an assistant for synthesis, not a source of truth.
- Retrieved text is data, never an instruction that overrides policy.
- Deterministic code controls schema validation, evidence status, persistence, and numeric calculations.
- A model's stated confidence is not used as the decision status.
- Synthetic fixtures are not presented as actual agricultural data.
- Users are advised to verify current local conditions, buyer terms, costs, and professional guidance before acting.
