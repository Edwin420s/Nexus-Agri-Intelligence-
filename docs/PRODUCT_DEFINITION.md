# Nexus Product Definition

**Version:** 2.0 · **Date:** 23 October 2026 · **Status:** product baseline; implementation and user validation are separate gates.

## 1. Executive summary

Nexus is an AI-powered agricultural market intelligence workspace intended to help Kenyan agribusiness entrepreneurs investigate opportunities using structured research, traceable evidence, explicit uncertainty, and transparent decision criteria. The initial demonstration assesses whether a small-scale tomato farming opportunity in Kirinyaga County is sufficiently understood to justify further due diligence. Nexus does not guarantee profit, forecast a certain harvest, replace an agronomist, or make an investment decision for the user.

## 2. Problem hypothesis

Agricultural decisions can require market prices, production/input costs, water and seasonal conditions, pest/disease information, transport, storage, post-harvest handling, and buyer terms. These facts may be fragmented, differently dated, geographically mismatched, or difficult to compare. A fluent answer is not the same as an evidence-backed assessment. Nexus aims to connect research, evidence quality, contradictions, assumptions, calculations, and actionable gaps into one dossier.

This is a product hypothesis. Its prevalence, severity, willingness to pay, and best customer segment have not yet been validated by user research.

## 3. Vision and mission

**Vision:** Make reliable, evidence-based agricultural decision support more accessible to Kenyan agribusiness entrepreneurs.

**Mission:** Turn fragmented agricultural and market information into transparent investigations that help users understand opportunities, risks, uncertainty, and the evidence needed to make informed decisions.

## 4. Target users

**Primary:** Kenyan agribusiness entrepreneurs evaluating a farming or market opportunity before committing meaningful resources.

**Potential later segments:** smallholder farmers changing crops or production systems; produce traders and aggregators; agricultural input suppliers; consultants; cooperatives; development organizations. These are not first-release requirements.

**Job to be done:** “When I consider an agricultural business opportunity, help me bring together relevant evidence, understand material economic and operational risks, and identify what I must verify before committing resources.”

## 5. Initial user and use case

Illustrative user: an early-stage entrepreneur considering tomato farming in Kirinyaga County with limited capital, incomplete market knowledge, and uncertain production costs. The user needs relevant price observations, a transparent cost model, water/seasonal risk context, and a plan to validate buyers and logistics.

Initial question: “Assess whether small-scale tomato farming in Kirinyaga County is worth investigating, considering market prices, production costs, water and seasonal risks, transport, and buyer access.”

This persona is illustrative, not an interviewed real person.

## 6. Core product promise

Every material conclusion should be traceable to evidence, an explicit calculation, or a clearly identified assumption. If evidence is unavailable, conflicting, stale, or weak, Nexus says so rather than inventing facts or citations.

## 7. Differentiation

Nexus is not just an agricultural chatbot. It structures an investigation, retrieves actual configured data, normalizes records, evaluates provenance/freshness/relevance/units, identifies contradictions and missing inputs, applies deterministic evidence rules, and generates an inspectable dossier. A finding should expose its supporting records, assumptions, calculation inputs, contradictions, and scope.

## 8. User journey

1. Open the workspace and start an investigation.
2. Enter the question, crop/activity, target location, and optional scale, budget, timeframe, or notes.
3. Review research objectives and evidence requirements.
4. Retrieve data through configured, authorized sources.
5. Normalize records and assess source quality, dates, units, geography, duplication, and contradictions.
6. Analyze evidence with deterministic calculations and bounded model reasoning.
7. Assign the overall evidence status using a deterministic policy.
8. Inspect the dossier and open supporting records.
9. Follow specific verification actions and rerun after new evidence is available.

## 9. Decision outcomes

- **SUPPORTED:** predefined evidence requirements are met within the documented scope. This does not guarantee business success.
- **INVESTIGATE FURTHER:** useful evidence exists but material conflicts, assumptions, risks, or unknowns remain.
- **INSUFFICIENT EVIDENCE:** the minimum evidence requirements cannot be met.

Evidence sufficiency, estimated business outcome, and actual future performance are separate concepts. Strong evidence can show that an opportunity is unattractive; an attractive estimate can still be poorly supported.

## 10. First-release scope

Included: investigation creation; explicit research plan; source retrieval through verified connectors; evidence normalization and provenance; quality flags; contradiction/gap detection; deterministic evidence policy; transparent cost calculations when inputs permit; structured dossier; evidence inspection; investigation history; integration status; bounded AI report assistance; failure/partial-run handling.

Excluded: guaranteed profit/yield; automated investment or purchase execution; guaranteed buyer matching; nationwide multi-crop coverage; full farm-management suite; production-grade forecasting; automatic pest identification; mandatory IoT integration; comprehensive voice/language support; unsupported proprietary-data access.

## 11. Product principles

1. Evidence before conclusions.
2. Uncertainty is visible, not hidden.
3. Claims are traceable.
4. Model output is bounded and validated.
5. The actual Kenyan operating context informs requirements, but assumptions must be validated.
6. Integrations must perform real supported operations.
7. Prefer one complete credible investigation over many shallow features.

## 12. Market validation

Interview potential users about their current process, information sources, time-consuming steps, price/cost comparisons, trust criteria, missing information, report usefulness, and willingness to pay. Do not claim product-market fit or user demand until actual research supports it.

## 13. Product success signals

A test user can explain the main findings, trace a claim to evidence, distinguish fact from assumption, understand the evidence status, and identify useful next steps. Technical measures include traceable material claims, reproducible calculations, correctly surfaced gaps/conflicts, connector reliability, and reproducible investigation runs. Report metrics only with a defined test set and denominator.

## 14. Product risks

Key risks: inaccessible sponsor endpoints; unsuitable agricultural datasets; model hallucinations; stale or incomparable prices; missing cost inputs; unreliable user trust; over-scoping; integration instability during demo; unclear data rights; credential leakage; pre-existing-code disclosure errors. Mitigations and test gates are documented in the architecture, security, integration, and test-plan documents.

## 15. Open questions

- What exact Zetaris service, endpoint, and datasets are available to the team?
- What Meterless component/runtime and memory interface is actually required and runnable?
- Which Nemotron model and inference route can be accessed?
- Which real agricultural sources can provide usable records with dates, units, and geography?
- Which inputs are mandatory before a meaningful tomato production-cycle calculation can be made?
- What freshness rules are suitable for each evidence category?
- What did actual user interviews reveal?

Do not fill these gaps with assumptions presented as facts.
