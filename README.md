# Nexus — Agribusiness Intelligence & Credit Underwriting Workspace

[![Tests](https://img.shields.io/badge/tests-14%20passed-brightgreen)](#automated-testing)
[![Meterless H-MEM](https://img.shields.io/badge/meterless--engine-H--MEM%20active-blue)](#meterless-engine-integration-h-mem)
[![Zetaris](https://img.shields.io/badge/data--layer-Zetaris-orange)](#zetaris-data-layer)
[![NVIDIA Nemotron](https://img.shields.io/badge/model-NVIDIA%20Nemotron-76b900)](#meterless-nightshift--nvidia-nemotron)
[![Track](https://img.shields.io/badge/hackathon--track-The%20Agent%20That%20Can%20Explain%20Why-purple)](#track-the-agent-that-can-explain-why)
[![Investor Memo](https://img.shields.io/badge/investor--memo-available-gold)](docs/INVESTOR_MEMO.md)

**Open Agent Hackathon 2026** · **Team:** Nexus · **Track:** *The Agent That Can Explain Why*  
**Initial Use Case:** Smallholder tomato farming due diligence in Kirinyaga County, Kenya (with extended benchmarks for French beans in Machakos and Irish potatoes in Nakuru).

---

## Executive Summary

Nexus is an evidence-first, multi-agent credit intelligence workspace built for agricultural lenders, SACCOs, MFIs, and agribusiness entrepreneurs in emerging markets. When evaluating commercial agricultural opportunities or underwriting smallholder working capital loans, financial institutions face a **15%–22% sector Non-Performing Loan (NPL) rate** caused by severe information asymmetry: volatile farmgate spot prices, informal crate rejection penalties, and unpermitted water abstraction.

Generic LLMs fail here because they hallucinate agronomic figures, quote off-topic retail prices, and lack verifiable provenance.

Nexus solves this by transforming agricultural due diligence into an explainable, deterministic dossier:
1. **Multi-Agent Orchestration:** Decomposes queries through dedicated **Planner**, **Researcher**, **MemoryAgent (Meterless H-MEM)**, **Evaluator**, and **Writer/Synthesizer** roles with real-time pipeline telemetry.
2. **Deterministic Decision Engine:** Derives an objective evidence sufficiency checklist (`SUPPORTED`, `INVESTIGATE FURTHER`, or `INSUFFICIENT EVIDENCE`). The LLM cannot override or upgrade the computed verdict.
3. **Enterprise Unit Economics & Sensitivity Modeling:** Mathematical calculations of CapEx, OpEx, Breakeven farmgate price, Gross Operating Margin %, and Capital Payback Horizon with interactive price stress-testing.
4. **Structured Credit Risk Matrix:** Identifies commercial, regulatory, agronomic, and climate risks with conditions precedent for credit committees.
5. **Sponsor Technology Integration:** Combines **Zetaris** as the unified federated enterprise data fabric, **Meterless H-MEM** for persistent investigation memory, and **Meterless Nightshift** routing to **NVIDIA Nemotron** models.
6. **One-Click Due Diligence Export:** Generates regulatory-grade Markdown and JSON briefings for credit approval workflows.

---

## Quick Start (Clean Machine)

### Prerequisites
- Node.js 20 or newer
- Docker (optional, for containerized execution or local Zetaris stack)
- No local GPU required — model calls route via Meterless Nightshift to hosted NVIDIA endpoints.

### 1. Installation
```bash
git clone <your-repo-url>
cd Nexus-Open-Agent-Hackathon2
cp .env.example .env
npm install
npm run build
npm test
```

### 2. Run the Web Workspace
```bash
npm run dev
# Server binds to http://0.0.0.0:8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## Programmatic Entry Points (For Judges)

As required by Section 2 of the Technical Execution Guide, judges can test Nexus directly without clicking browser controls.

### Option A: CLI Runner
Run the agent directly from the terminal with sample scenarios:
```bash
# Example 1: Kirinyaga Tomato Opportunity Assessment & Contradiction Detection
npm run run -- input_examples/example_1.json

# Example 2: Machakos French Beans Export Feasibility & Canal Water Risk
npm run run -- input_examples/example_2.json

# Example 3: Nakuru Irish Potato Commercial Production & Frost Outlook
npm run run -- input_examples/example_3.json

# Python wrapper:
python3 run.py input_examples/example_1.json
```

### Option B: HTTP API (`POST /run` & Export)
Start the server:
```bash
npm start
```
Call the programmatic runner:
```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```
Export an executive due diligence report in Markdown:
```bash
# Replace :id with investigation ID returned from run
curl http://localhost:8000/api/investigations/:id/export?format=markdown
```

### Option C: Reproducible Docker Build
```bash
docker build -t oah-submission .
docker run --rm -p 8000:8000 --env-file .env oah-submission
```
Then verify via curl:
```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

---

## Standalone Sample Mode (`SAMPLE_MODE=true`)

Judges without external Zetaris credentials or Nightshift tokens can run the entire agent with 100% functionality and zero network failure risk:
```bash
SAMPLE_MODE=true npm run run -- input_examples/example_1.json
```
In `SAMPLE_MODE=true`, Nexus:
- Loads verified Kenyan agricultural evidence from `data/agricultural-evidence.json`.
- Executes active H-MEM memory recall and persistent mining.
- Flags contradictory evidence and scores the decision checklist deterministically.
- Calculates complete unit economics, risk matrix, and multi-agent telemetry.
- Generates structured JSON output and writes full trace logs to `logs/trace-<run_id>.jsonl`.

---

## Live Demonstration Paths (Zetaris Connected)

Nexus cleanly separates database retrieval from domain evidence validation:

### Path A: Live TPC-DS Refusal Test (Explainable Domain Rejection)
```bash
SAMPLE_MODE=false node run.js
```
- **Zetaris Execution:** Retrieves 10 live rows from `TPCDS_DB.item` via the local Docker stack.
- **Evaluator Validation:** Evaluator detects retail merchandise (`Music`, `Jewelry`, `Home`, etc.).
- **Outcome:** All 10 records rejected as domain-irrelevant. Usable agricultural evidence count is 0.
- **Verdict:** **`INSUFFICIENT EVIDENCE (Score: 25/100)`** with explicit explainable refusal.

### Path B: Live Agricultural Intelligence & Risk Conflict Detection
```bash
SAMPLE_MODE=false npm run run -- input_examples/example_1.json
```
- **Zetaris Execution:** Retrieves 4 live records from official Kenyan agricultural authorities (Wang'uru Market Bulletin, Kirinyaga Aggregators Association, KALRO, and WRA).
- **Evaluator Validation:** Confirms agricultural domain relevance and evaluates market viability.
- **Conflict Detection:** Identifies commercial friction (`market_vs_offtake`): wholesale spot prices indicate attractive margins (85 KES/kg median), but informal aggregator offtake records indicate severe rejection rates (15–20% on uncalibrated crates) without contract price protection.
- **Verdict:** **`INVESTIGATE FURTHER (Score: 75/100)`**, instructing the underwriter to require binding offtake terms before loan disbursement.

---

## Score Semantics (Evidence Checklist Coverage)

The Nexus Score (e.g., `25/100` or `75/100`) is an **Evidence Checklist Coverage Score**, **NOT** a probability of commercial success, crop yield, or profitability:
- **`25/100`:** Minimum temporal or structural context exists, but usable domain-relevant evidence or source diversity failed. Verdict: `INSUFFICIENT EVIDENCE`.
- **`75/100`:** Verified domain evidence and source diversity requirements are satisfied, but an unresolved commercial risk or policy contradiction was detected. Verdict: `INVESTIGATE FURTHER`.
- **`100/100`:** All four criteria (domain evidence, diversity, conflict resolution, dates) are satisfied. Verdict: `SUPPORTED`.

Missing evidence or commercial risks can never accidentally produce a favorable decision.

---

## Multi-Agent Architecture & Observability

```text
                           User / Judge
               (Browser UI, CLI run.js, POST /run)
                                │
                                ▼
                       ┌─────────────────┐
                       │  Planner Agent  │ (Decomposes research goals)
                       └────────┬────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Researcher Agent │  │   Memory Agent   │  │ Evaluator Agent  │
│ (Zetaris Layer)  │  │ (Meterless H-MEM)│  │ (Conflict Check) │
└─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │  Writer Agent    │ (Meterless Nightshift /
                      │  (Synthesizer)   │  NVIDIA Nemotron)
                      └─────────┬────────┘
                                │
                                ▼
                     Investigation Dossier
             + Structured Trace (logs/trace-*.jsonl)
             + Financial Metrics & Risk Matrix
```

### Trace Logging Standard
Every run streams human-readable logs to `stdout` and appends JSONL traces to `logs/trace-<run_id>.jsonl` with masked secrets:
```text
[INFO] run_id=demo-001 Planner Starting run
[INFO] run_id=demo-001 Planner Planner delegated retrieval to Researcher
[INFO] run_id=demo-001 Researcher Researcher queried Zetaris and returned 4 candidate records
[INFO] run_id=demo-001 MemoryAgent H-MEM recalled 5 facts from an earlier session
[INFO] run_id=demo-001 Evaluator Evaluator flagged a conflict in market_vs_offtake
[INFO] run_id=demo-001 Writer Writer produced final reconciliation (model: nvidia/nemotron-3-super-120b-a12b)
[INFO] run_id=demo-001 Planner Completed in 0.3 seconds
```

---

## Comprehensive Environment Variables Guide (`.env`)

Every environment variable is documented below with its source, purpose, and local default:

| Variable | Purpose | Local / Default Value | Source / How to Obtain |
|---|---|---|---|
| `PORT` | API & UI HTTP bind port | `8000` | Optional configuration. |
| `HOST` | Network interface to bind | `0.0.0.0` | Default binds to all network interfaces. |
| `SAMPLE_MODE` | Standalone reproducible offline mode | `true` | Set `true` for offline judging; `false` for live networks. |
| `LOG_LEVEL` | Application logging verbosity | `INFO` | Options: `DEBUG`, `INFO`, `WARN`, `ERROR`. |
| `NEXUS_DATA_DIR`| Filesystem directory for atomic storage | `./storage` | Created automatically. |
| `NEXUS_REQUEST_TIMEOUT_MS` | Network timeout for connectors | `60000` | Recommended 60000ms for remote parquet fetches. |
| `ZETARIS_QUERY_URL` | Zetaris UI SQL proxy endpoint | `http://localhost:3000/api/proxy/query/sql/start` | Zetaris local Docker stack (`zetaris-platform/`). |
| `ZETARIS_REST_URL` | Zetaris direct REST endpoint | `http://localhost:8888/api/v1.0` | Zetaris local Docker API service. |
| `ZETARIS_ORG_ID` | Zetaris tenant organization ID | `1` | Default admin tenant in Zetaris. |
| `ZETARIS_ADMIN_EMAIL` | Admin login email for auto-auth | `admin@zetaris.com` | Default Zetaris platform credential. |
| `ZETARIS_ADMIN_PASSWORD` | Admin login password | `Zetaris1@` | Default Zetaris platform credential. |
| `ZETARIS_SQL` | SQL executed against Zetaris | Raw `SELECT` query | Default: `SELECT ... FROM TPCDS_DB.item LIMIT 10`. |
| `METERLESS_BASE_URL` | Nightshift OpenAI-compatible endpoint | `http://127.0.0.1:8088/v1` | Local or cloud Nightshift runtime. |
| `METERLESS_RUNTIME_TOKEN` | Nightshift runtime Bearer token | Empty in sample mode | Meterless Nightshift Console (Tokens tab). |
| `METERLESS_MODEL` | Target hosted LLM model | `nvidia/nemotron-3-super-120b-a12b` | Hosted NVIDIA model endpoint via Nightshift. |
| `NEXUS_HMEM_ENABLED` | Active hierarchical memory engine | `true` | Internal in-process engine (`src/engines/hmem.ts`). |

---

## Sponsor Technology Integrations

| Sponsor | Technology | Role in Nexus | Verification Proof & Test |
|---|---|---|---|
| **Meterless** | **H-MEM Engine** | Hierarchical investigation memory; recalls prior market facts across sessions and mines new evidence. | Fully implemented in `src/engines/hmem.ts`. Tested in `tests/hmem.test.ts` (4 passing tests). |
| **Meterless** | **Nightshift** | Primary AI provider routing OpenAI-compatible `/chat/completions` requests to hosted endpoints. | Implemented in `src/nemotron.ts` with resilient offline fallback. |
| **Zetaris** | **Data Layer** | Unified data federation layer querying structured agricultural market records. | Integrated in `src/zetaris.ts` with local platform in `zetaris-platform/` and verified dataset in `data/agricultural-evidence.json`. |
| **NVIDIA** | **Nemotron Models** | Grounded synthesis model (`nvidia/nemotron-3-super-120b-a12b`) constrained to evidence records. | Bound via Nightshift provider with strict schema validation. |
| **Cursor** | **Cursor AI IDE** | Development tool used for agent architecture, typing, and refactoring. | Documented in `docs/CURSOR_BUILD_LOG.md`. |

---

## Automated Testing

Run the complete test suite:
```bash
npm test
```
Outputs 14 passing tests across decision policy, financial unit economics, credit risk matrix, and H-MEM memory:
```text
✔ synthetic fixtures cannot satisfy evidence requirements (1.73ms)
✔ fewer than three usable records is insufficient (0.34ms)
✔ conflicting evidence triggers investigate further (0.27ms)
✔ minimum diverse, dated non-synthetic records can satisfy prototype policy (0.27ms)
✔ unverified provenance is not counted as usable (0.28ms)
✔ domain relevance rejects retail merchandise and yields INSUFFICIENT EVIDENCE (0.45ms)
✔ computeFinancialMetrics calculates deterministic unit economics for Kirinyaga tomatoes (0.77ms)
✔ computeFinancialMetrics calculates unit economics for Machakos French beans (0.34ms)
✔ computeFinancialMetrics blocks calculations when evidence is insufficient or retail-only (0.46ms)
✔ computeRiskMatrix generates categorized credit risks with mitigations and source IDs (1.02ms)
✔ HMEM engine stores and recalls memories by semantic/keyword relevance (1.90ms)
✔ HMEM mines facts from investigation output text (0.54ms)
✔ HMEM persists memories to disk and reloads on startup (8.13ms)
✔ HMEM filters by threshold and honors topN limits (0.86ms)

Tests: 14 passed, 0 failed, 14 total (280ms duration)
```

---

## Investor Due-Diligence & Business Development

For technical venture capitalists, agricultural lenders, and enterprise credit partners, consult our dedicated institutional memo:
- **[Investor Memorandum & Commercial Strategy](docs/INVESTOR_MEMO.md)**: Market sizing ($4.2B SAM), B2B SaaS pricing model, bank NPL reduction benchmarks, defensible moats, 5-year financial projections, and Seed round use of funds.

---

## Repository Contents

- `src/`: TypeScript source code (API, agent engine, Zetaris connector, Nemotron adapter, H-MEM memory, atomic store, tracing).
- `input_examples/`: 3 structured JSON inputs (`example_1.json`, `example_2.json`, `example_3.json`).
- `output_examples/`: 3 matching structured output dossiers generated by the agent.
- `logs/`: Directory holding JSONL agent execution traces.
- `data/`: High-fidelity agricultural evidence and demo fixtures.
- `public/`: Responsive browser interface with scenario selector, telemetry visualizer, sensitivity slider, risk matrix, and export controls.
- `tests/`: Automated unit and integration tests (14 passing tests).
- `docs/`: Exhaustive 19-part product, architectural, financial, and security documentation suite.
- `Dockerfile`: Multi-stage container definition.
- `run.js` & `run.py`: Direct command-line entry points.
