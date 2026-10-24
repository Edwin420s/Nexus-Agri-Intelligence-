# Data Dictionary and Evidence Contract

## EvidenceRecord

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique source/evidence record identifier within the dossier |
| `source_name` | string | Human-readable source or dataset name |
| `source_url` | URL string, optional | Source link; only HTTP(S) is rendered |
| `title` | string | Short evidence title |
| `claim` | string | Claim or summary extracted from the record |
| `detail` | string | Relevant source detail / excerpt / normalized description |
| `topic` | string | Grouping key for contradiction analysis |
| `relation` | enum | `supports`, `contradicts`, or `context`; relation must not be inferred without a defensible mapping |
| `reliability` | number, optional | Heuristic metadata 0–1; never a probability of truth |
| `observed_at` | ISO date/time string, optional | When the underlying value was observed |
| `published_at` | ISO date/time string, optional | Publication timestamp |
| `geography` | string, optional | Geographic scope of the observation |
| `unit` | string, optional | Measurement unit |
| `currency` | string, optional | Currency for monetary values |
| `provenance_status` | enum | `verified`, `partial`, `unverified`, or `synthetic` |
| `quality_flags` | string[] | Explanations of missing metadata or quality concerns |
| `synthetic` | boolean | True for demo-only fixture data |
| `raw_value` | string/number, optional | Original value, if structured |
| `normalized_value` | string/number, optional | Safely converted value, with conversion metadata required in a future extension |

## InvestigationResult

Includes unique `id` and `run_id`, question, location, crop/activity, run status, deterministic decision object, rationale, evidence, conflicts, missing information, next actions, memory/model/Zetaris modes, warnings, timestamps, source count, and report version.

## Decision object

- `status`: `SUPPORTED`, `INVESTIGATE FURTHER`, or `INSUFFICIENT EVIDENCE`.
- `score`: percentage of the current prototype checklist requirements satisfied. It is not confidence, truth probability, or profitability likelihood.
- `note`: limitation explanation.
- `requirements`: each rule's ID, label, boolean result, and explanation.

## Provenance interpretation

- `verified`: reserve for a source path that was actually checked according to a documented verification procedure.
- `partial`: some provenance metadata exists but does not establish the complete chain.
- `unverified`: source identity/metadata cannot be adequately verified.
- `synthetic`: illustrative fixture only.

A provenance label is not a guarantee that the claim is true. Real source adapters should preserve source record IDs, retrieval timestamp, publication/observation timestamps, query/reference IDs, transformation metadata, licensing constraints, and hashes where appropriate and lawful.

## Claim lineage target

`Source response → normalized evidence → calculation/analysis → claim → report section`.

Every material conclusion should link to its evidence IDs or clearly state that it is an assumption, hypothesis, or limitation.
