# Architecture Decision Records

## ADR-001 — Evidence-first product rather than free-form chatbot
**Decision:** Material findings must be linked to evidence or labelled as assumptions/hypotheses.
**Reason:** User trust depends on traceability and honest uncertainty.
**Trade-off:** More schema and validation work; fewer unsupported fluent answers.

## ADR-002 — Deterministic decision status
**Decision:** Application code computes evidence status; model output cannot set it.
**Reason:** Reproducibility, testability, and resistance to model overconfidence.
**Trade-off:** Policy thresholds require explicit maintenance and domain validation.

## ADR-003 — Synthetic fixture mode is visibly separate
**Decision:** Fixtures are allowed for UI development but are marked synthetic and cannot satisfy live evidence requirements.
**Reason:** Enables development without misrepresenting access or data quality.
**Trade-off:** Demo mode cannot substantiate agricultural claims.

## ADR-004 — External integrations behind adapters
**Decision:** Keep Zetaris, model runtime, and memory behind separate interfaces/modules.
**Reason:** Sponsor API details and availability must be verified independently.
**Trade-off:** Generic adapters need adjustment to actual provider contracts.

## ADR-005 — Local JSON persistence for the prototype only
**Decision:** Use atomic local-file persistence to make history functional without adding a database dependency.
**Reason:** Fast local demo setup.
**Trade-off:** Not safe for concurrent multi-process production; replace with transactional storage before multi-user deployment.

## ADR-006 — H-MEM disabled until contract verification
**Decision:** Do not guess a sponsor memory API from an unverified reference.
**Reason:** Avoid false claims and runtime breakage.
**Trade-off:** Memory functionality is not complete; implement after confirming the required official interface.
