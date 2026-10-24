# Nexus — Agricultural Market Intelligence Workspace

[![Tests](https://img.shields.io/badge/tests-9%20passed-brightgreen)](#automated-testing)
[![Meterless H-MEM](https://img.shields.io/badge/meterless--engine-H--MEM%20active-blue)](#meterless-engine-integration-h-mem)
[![Zetaris](https://img.shields.io/badge/data--layer-Zetaris-orange)](#zetaris-data-layer)
[![NVIDIA Nemotron](https://img.shields.io/badge/model-NVIDIA%20Nemotron-76b900)](#meterless-nightshift--nvidia-nemotron)
[![Track](https://img.shields.io/badge/hackathon--track-The%20Agent%20That%20Can%20Explain%20Why-purple)](#track-the-agent-that-can-explain-why)

**Open Agent Hackathon 2026** · **Team:** Nexus · **Track:** *The Agent That Can Explain Why*  
**Initial Use Case:** Small-scale tomato farming opportunity assessment in Kirinyaga County, Kenya (with extended benchmarks for French beans in Machakos and Irish potatoes in Nakuru).

---

## Executive Summary

Nexus is an evidence-first multi-agent intelligence workspace designed for Kenyan agribusiness entrepreneurs. When evaluating a commercial farming opportunity, entrepreneurs are often forced to rely on fragmented WhatsApp prices, unverified cost claims, and informal broker advice. Generic LLM chatbots frequently answer with unfounded confidence, hallucinated prices, and no provenance.

Nexus solves this by turning opportunity assessment into a structured, traceable, inspectable due-diligence dossier:
1. **Multi-Agent Orchestration:** Decomposes queries through dedicated **Planner**, **Researcher**, **MemoryAgent (Meterless H-MEM)**, **Evaluator**, and **Writer/Synthesizer** roles.
2. **Explainable Decision Engine:** Computes an objective evidence sufficiency checklist (`SUPPORTED`, `INVESTIGATE FURTHER`, or `INSUFFICIENT EVIDENCE`). The LLM cannot override or upgrade the computed verdict.
3. **Traceable Lineage & Contradiction Detection:** Surfaces opposing evidence relations (e.g. high open-market prices vs. severe aggregator rejection rates) and links every claim to evidence IDs.
4. **Sponsor Technology Integration:** Combines **Zetaris** as the unified structured data layer, **Meterless H-MEM** for persistent investigation memory, and **Meterless Nightshift** routing to **NVIDIA Nemotron** models.

---

## Quick Start (Clean Machine)

### Prerequisites
- Node.js 20 or newer
- Docker (optional, for containerized run or local Zetaris stack)
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

As required by Section 2 of the Technical Execution Guide, judges can test Nexus without clicking a browser button.

### Option A: CLI Runner
Run the agent directly from terminal using the sample inputs:
```bash
# Example 1: Kirinyaga Tomato Opportunity Assessment
npm run run -- input_examples/example_1.json

# Example 2: Machakos French Beans Export Feasibility
npm run run -- input_examples/example_2.json

# Example 3: Nakuru Irish Potato Commercial Production
npm run run -- input_examples/example_3.json

# Python wrapper also supported:
python3 run.py input_examples/example_1.json
```

### Option B: HTTP API (`POST /run`)
Start the server:
```bash
npm start
```
In another terminal, call the programmatic endpoint:
```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
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
- Loads the verified Kenyan agricultural dataset (`data/agricultural-evidence.json`).
- Executes active H-MEM memory recall and persistent mining.
- Flags contradictory evidence and scores the decision checklist deterministically.
- Generates structured JSON output and writes full trace logs to `logs/trace-<run_id>.jsonl`.

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
```

### Trace Logging Standard
Every run streams human-readable logs to `stdout` and appends JSONL traces to `logs/trace-<run_id>.jsonl` with masked secrets:
```text
[INFO] run_id=demo-001 Starting run
[INFO] run_id=demo-001 Planner delegated retrieval to Researcher
[INFO] run_id=demo-001 Researcher queried Zetaris and returned 4 candidate records
[INFO] run_id=demo-001 H-MEM recalled 2 facts from an earlier session
[INFO] run_id=demo-001 Evaluator confirmed consistent evidence (SUPPORTED)
[INFO] run_id=demo-001 Writer produced final reconciliation (model: nvidia/nemotron-3-super-120b-a12b)
[INFO] run_id=demo-001 Completed in 0.4 seconds
```

---

## Sponsor Technology Integrations

| Sponsor | Technology | Role in Nexus | Verification Proof & Test |
|---|---|---|---|
| **Meterless** | **H-MEM Engine** | Hierarchical investigation memory; recalls prior market facts across sessions and mines new evidence. | Fully implemented in `src/engines/hmem.ts`. Automated test suite: `npm run test:hmem` (4 passing tests). |
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
Outputs 9 passing tests across decision policy and H-MEM memory:
```text
✔ synthetic fixtures cannot satisfy evidence requirements (1.06ms)
✔ fewer than three usable records is insufficient (0.20ms)
✔ conflicting evidence triggers investigate further (0.18ms)
✔ minimum diverse, dated non-synthetic records can satisfy prototype policy (0.22ms)
✔ unverified provenance is not counted as usable (0.19ms)
✔ HMEM engine stores and recalls memories by semantic/keyword relevance (1.59ms)
✔ HMEM mines facts from investigation output text (0.45ms)
✔ HMEM persists memories to disk and reloads on startup (7.85ms)
✔ HMEM filters by threshold and honors topN limits (0.84ms)

Tests: 9 passed, 0 failed, 9 total (295ms duration)
```

---

## Repository Contents

- `src/`: TypeScript source code (API, agent engine, Zetaris adapter, Nemotron adapter, H-MEM engine, atomic persistence).
- `input_examples/`: 3 structured JSON inputs (`example_1.json`, `example_2.json`, `example_3.json`).
- `output_examples/`: 3 matching structured output dossiers generated by the agent.
- `logs/`: Directory holding JSONL agent execution traces.
- `data/`: High-fidelity agricultural evidence and demo fixtures.
- `public/`: Responsive browser interface with investigation history panel.
- `tests/`: Automated unit and integration tests.
- `docs/`: Exhaustive 18-part product, architectural, and security documentation suite.
- `Dockerfile`: Multi-stage container definition.
- `run.js` & `run.py`: Direct command-line entry points.
