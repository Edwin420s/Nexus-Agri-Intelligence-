# Decision Policy — Prototype v1

## Purpose
Classify whether the current investigation has enough minimally usable evidence to support a scoped conclusion. This is an evidence sufficiency policy, not a profitability rating or probability of truth.

## Inputs
- Normalized evidence records.
- Explicit contradiction groups.
- Whether data retrieval completed in live Zetaris mode.
- Provenance metadata and date fields.

## Current checklist
1. At least three non-synthetic records whose provenance is not `unverified`.
2. At least two distinct source names among those usable records.
3. No explicit topic group contains both `supports` and `contradicts` relations.
4. At least one usable record contains an observation or publication date.
5. The collection must have come from live Zetaris mode; fixture mode cannot support a real-world outcome.

Each requirement contributes equally to the displayed coverage score. The score is a checklist percentage, not calibrated confidence.

## Status mapping
- If data is not live, fewer than three usable records exist, or fewer than two sources exist: `INSUFFICIENT EVIDENCE`.
- Otherwise, if an explicit conflict exists or any requirement fails: `INVESTIGATE FURTHER`.
- Otherwise: `SUPPORTED` within this prototype's narrow evidence scope.

## Known limitations
- Topic-level contradiction detection depends on source adapters assigning relations correctly.
- Two different source names may still derive from the same upstream source; true independence is not established.
- Date presence does not prove freshness.
- The current policy does not yet require every agricultural category (price, costs, water, logistics, buyer terms) to be present.
- The policy is not validated by agronomists or financial professionals.

## Before production
Version investigation-specific requirements; define source independence; implement domain-specific freshness and geographic relevance; require critical categories; add claim-level evidence validation; test with expert-reviewed cases; record the policy version with every report. Do not tune the thresholds to make the demo appear positive.
