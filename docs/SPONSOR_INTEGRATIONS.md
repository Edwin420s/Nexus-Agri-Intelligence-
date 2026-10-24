# Sponsor Technology Integration and Verification

**Open Agent Hackathon 2026** · **Team:** Nexus · **Track:** *The Agent That Can Explain Why*

---

## 1. Meterless Engine — H-MEM (Hierarchical Memory Engine)

### Requirement
Every submission must implement at least one Meterless Engine (H-MEM, Markovian, World Model, or Scout Intent) in a working feature and provide a passing test demonstrating that it works.

### Implementation in Nexus
Nexus implements the **Meterless H-MEM (Hierarchical Memory Engine)** in `src/engines/hmem.ts` and wires it directly into the agent workflow (`src/memory.ts` and `src/agent.ts`).

1. **Working Feature:** 
   - **Cross-session Intelligence Recall:** When an entrepreneur asks about tomato farming in Kirinyaga, the **MemoryAgent** queries H-MEM to retrieve prior investigation conclusions, baseline agronomic risk factors (e.g. bacterial wilt, late blight), and past price discoveries.
   - **Autonomous Memory Mining:** Upon completing an investigation, H-MEM's `mine()` engine extracts key facts, cost assumptions, and risk alerts from the unstructured dossier text and commits them to the persistent H-MEM ledger (`storage/hmem/hmem-ledger.json`).
   - **Provenance Preservation:** Retrieved memories are injected as contextual memory rather than cited as external data layer sources, preserving strict provenance integrity.

2. **Automated Verification Test:**
   - Test suite: `tests/hmem.test.ts`
   - Command: `npm run test:hmem`
   - Verified capabilities:
     1. Semantic/keyword relevance scoring.
     2. Automated fact and assumption mining from investigation text.
     3. Cross-restart disk persistence and state restoration.
     4. Top-N scoring and threshold-based relevance pruning.

---

## 2. Meterless Nightshift — Primary AI Provider

### Requirement
Every submission must use Meterless Nightshift as its primary AI provider.

### Implementation in Nexus
Nexus connects to **Meterless Nightshift** via `src/nemotron.ts` as an OpenAI-compatible runtime:
- **Base Endpoint:** Configured via `METERLESS_BASE_URL` (defaulting to `http://127.0.0.1:8088/v1` or hosted Nightshift).
- **Authentication:** Injected via `METERLESS_RUNTIME_TOKEN` or `METERLESS_API_KEY`.
- **Application Context:** Sends `meterless-app: nexus-agri-intelligence` and `meterless-scope: user` headers.
- **Resilience Standard:** Implements strict timeouts (`AbortSignal.timeout(25000)`) and graceful fallback to deterministic synthesis when running in offline `SAMPLE_MODE=true`, ensuring judges can evaluate the agent regardless of network connectivity.

---

## 3. Zetaris — Structured Data Layer

### Requirement
Every submission must use Zetaris as its data layer.

### Implementation in Nexus
Nexus integrates **Zetaris** as the primary data virtualization and query layer (`src/zetaris.ts`):
- **Federated Architecture:** Zetaris unifies disparate agricultural data sources (wholesale market price bulletins, research institute cost models, water authority abstraction quotas, and aggregator contract terms) without requiring manual ETL in application code.
- **Local Platform Deployment:** A full 7-container Docker Compose deployment is provided in `zetaris-platform/` (including driver on port 10000, metastore, REST API on port 8888, UI on port 3000, and pre-seeded sample schemas `NY_TAXI` and `TPCDS_DB`).
- **Data Normalization:** Raw query records are normalized into the typed `EvidenceRecord` schema, tracking unit conversions (`KES/kg`, `KES/acre`), observation timestamps, geographical tags, and quality flags.
- **Reproducible Dataset:** For standalone testing and offline judging, `data/agricultural-evidence.json` mirrors the federated Zetaris view across Kirinyaga, Machakos, and Nakuru counties.

---

## 4. NVIDIA — Nemotron Model Integration

### Requirement
Connect NVIDIA models through Meterless Nightshift.

### Implementation in Nexus
Nexus targets the flagship **`nvidia/nemotron-3-super-120b-a12b`** (or `METERLESS_MODEL`):
- **Role in Workflow:** Bounded synthesis and due-diligence report generation.
- **Strict Guardrail Prompting:** The prompt strictly forbids inventing external citations, statistics, or URLs. All factual statements must link to evidence IDs (e.g. `[zetaris-kiri-001]`).
- **Deterministic Separation:** The model's narrative output cannot alter or inflate the calculated decision status (`SUPPORTED` vs `INVESTIGATE FURTHER` vs `INSUFFICIENT EVIDENCE`). The verdict is determined exclusively by the evidence checklist.

---

## 5. Cursor AI IDE

### Requirement
Use Cursor as the AI development environment and record usage.

### Implementation in Nexus
Nexus was engineered and refactored using **Cursor**:
- Architecture design, TypeScript type contracts, and atomic persistence were developed in Cursor.
- Prompts, code modifications, and test verifications are documented in `docs/CURSOR_BUILD_LOG.md`.

---

## 6. What Was Unique About Our Sponsor Technology Integration

1. **Fail-Closed Truthfulness:** Rather than pretending that sponsor services are connected when credentials are unset, Nexus uses a transparent health check (`GET /api/health` and `POST /api/integrations/test`) and clear UI badges distinguishing `live`, `sample`, and `fallback` modes.
2. **Two-Way Memory Cycle:** H-MEM does not merely store static chat history; it functions as an autonomous research memory engine that mines facts from earlier opportunity assessments to enhance future due-diligence investigations.
3. **Traceable Multi-Agent Observability:** Every interaction between Planner, Researcher (Zetaris), MemoryAgent (H-MEM), Evaluator, and Writer (Nemotron via Nightshift) is logged to stdout and saved in structured JSONL format (`logs/trace-<run_id>.jsonl`) with automatic secret redaction.
