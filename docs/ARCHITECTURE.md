# Nexus Architecture

## 1. Current logical architecture

```text
Browser (public/)
  └─ Express API (src/server.ts)
      ├─ Investigation orchestration (src/agent.ts)
      │   ├─ Zetaris adapter (src/zetaris.ts)
      │   ├─ Meterless Runtime adapter (src/nemotron.ts)
      │   ├─ Memory boundary (src/memory.ts; disabled until verified)
      │   ├─ Deterministic evidence policy
      │   └─ Evidence/claim dossier
      ├─ JSON persistence (src/store.ts; single-process prototype only)
      └─ health, integration smoke test, history/evidence/report routes
```

## 2. Request flow

1. Validate user input.
2. Retrieve records through the configured Zetaris adapter or explicitly synthetic fixtures.
3. Normalize records into `EvidenceRecord`.
4. Detect opposing encoded relations by topic.
5. Evaluate minimum evidence requirements deterministically.
6. Request bounded model assistance if Meterless Runtime is configured; otherwise use deterministic explanation.
7. Validate model JSON before accepting selected narrative fields. The model cannot set the decision status.
8. Persist the dossier and return it to the UI.

## 3. Decision engine

The current prototype checks non-synthetic evidence, at least three usable records, at least two distinct sources, date context, and explicit encoded conflicts. The status is `SUPPORTED`, `INVESTIGATE FURTHER`, or `INSUFFICIENT EVIDENCE`. This is an initial engineering policy, not an agricultural methodology validated by experts. The criteria must become investigation-type-specific and versioned before production.

## 4. Lifecycle

The full product lifecycle is intended to include `DRAFT`, `QUEUED`, `PLANNING`, `RETRIEVING`, `EVALUATING`, `REASONING`, `GENERATING_REPORT`, `COMPLETED`, `PARTIAL`, `FAILED`, and `CANCELLED`. The current implementation runs synchronously and returns `COMPLETED`, `PARTIAL`, or `FAILED` in the saved result; queueing, cancellation, and per-stage event history are not yet implemented.

## 5. Persistence

`src/store.ts` uses a local JSON file with atomic temporary-file rename. It is intentionally single-process and suitable only for local/hackathon use. A production version requires a transactional database, migrations, access controls, concurrent-write handling, retention policy, and immutable run/evidence snapshots.

## 6. API

- `GET /api/health`: app version and configured/unverified integrations.
- `POST /api/integrations/test`: attempts Zetaris retrieval and model inference if configured; H-MEM status remains explicit.
- `POST /api/investigations`: create/run/save.
- `POST /api/investigate`: backward-compatible alias.
- `GET /api/investigations`: recent history summary.
- `GET /api/investigations/:id`: saved dossier.
- `GET /api/investigations/:id/evidence`: evidence collection.
- `GET /api/investigations/:id/report`: report envelope.

## 7. Integration contracts

Zetaris adapter uses a generic JSON POST `{sql}` envelope only as a starting contract. Verify and adapt it to the actual official workspace. Meterless adapter uses an OpenAI-compatible chat-completions shape; actual runtime and model identity must be verified. H-MEM is not falsely enabled; its adapter stays unavailable until actual API and persistence semantics are confirmed.

## 8. Security boundaries

All provider secrets stay server-side. The app applies body size limits, basic request throttling, security headers, and safe URL validation for displayed links. It is not yet multi-user secure: there is no account authentication, record-level authorization, robust distributed rate limit, or production-grade audit logging. Do not expose it publicly with private data.
