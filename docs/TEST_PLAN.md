# Test Plan and Release Gates

## Automated commands

```bash
npm run build
npm test
npm run check
```

## Current unit coverage
- Synthetic-only evidence cannot satisfy the live evidence policy.
- Fewer than three usable records is insufficient.
- Explicit opposing relations trigger `INVESTIGATE FURTHER`.
- Diverse, dated, non-synthetic records can satisfy the current prototype checklist.
- Unverified provenance does not count as usable evidence.

## Required test matrix

| Scenario | Expected behavior | Type |
|---|---|---|
| Missing Zetaris configuration | Clearly labelled synthetic fixture mode or empty error mode when fixtures disabled | Integration |
| Zetaris 401/403 | Error mode, no claim that live data was used | Integration |
| Zetaris timeout | Clear warning and safe failure | Integration |
| Zetaris empty/unrecognized response | Error mode and diagnostic | Integration |
| Invalid URL protocol | Rejected | Unit/integration |
| Invalid source URL | Not rendered as a link | UI |
| Synthetic records | Cannot produce `SUPPORTED` | Unit |
| Too few records | `INSUFFICIENT EVIDENCE` | Unit |
| Multiple sources with date context | Checklist evaluated deterministically | Unit |
| Opposing evidence relations | `INVESTIGATE FURTHER` | Unit |
| Missing dates or source metadata | Quality gap visible | Unit/UI |
| Model missing credentials | Deterministic fallback with warning; no Nemotron claim | Integration |
| Model returns non-JSON | Ignore invalid structured fields and preserve deterministic status | Integration |
| Model returns unsupported evidence IDs | Future required claim-level validator must reject them | Gap / add before production |
| Memory disabled | Explicit unavailable status; investigation still works | Integration |
| Invalid JSON body | 400 response | API |
| Oversized body | Rejected | API |
| History reload | Saved result remains readable | API/E2E |
| Storage write failure | Clear server error; no false persistence success | API |
| Malicious instructions in evidence | No tool escalation or execution | Adversarial |

## End-to-end demo acceptance
1. Start from a clean install.
2. Open the workspace.
3. Submit the Kirinyaga tomato scenario.
4. Confirm UI labels fixtures or live data correctly.
5. Inspect the evidence records and quality flags.
6. Confirm decision status is deterministic and synthetic data is insufficient.
7. Open the saved dossier from history.
8. Run `/api/integrations/test` only after actual credentials are configured; save redacted evidence.
9. Verify actual sponsor/model identities separately.

## Release gate
Do not claim product or sponsor integration completion until build/tests pass, the end-to-end flow works, live operations are independently verified where claimed, and all known critical limitations are documented.
