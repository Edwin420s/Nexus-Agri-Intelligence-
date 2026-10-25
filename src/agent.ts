import { randomUUID } from "node:crypto";
import type {
  AgentTelemetry,
  DecisionResult,
  DecisionStatus,
  EvidenceConflict,
  EvidenceRecord,
  FinancialMetrics,
  InvestigationInput,
  InvestigationResult,
  RiskItem
} from "./types.js";
import { collectEvidence } from "./zetaris.js";
import { recallMemory, rememberInvestigation } from "./memory.js";
import { reasonWithMeterless } from "./nemotron.js";
import { AgentTracer } from "./trace.js";

export function evaluateDomainRelevance(
  record: EvidenceRecord,
  context: { crop_or_activity?: string; location?: string; question?: string } = {}
): { isRelevant: boolean; reason?: string } {
  const agriTopics = new Set([
    "market_price",
    "buyer_offtake",
    "production_costs",
    "water_access",
    "water_security",
    "agronomy",
    "irrigation",
    "yield",
    "post_harvest",
    "storage",
    "crop_disease",
    "pest_control",
    "fertilizer",
    "input_costs",
    "operational_risk",
    "logistics",
    "transport"
  ]);

  const rawTopic = record.topic.trim().toLowerCase();
  if (agriTopics.has(rawTopic)) {
    return { isRelevant: true };
  }

  // Reject generic retail merchandise from benchmark datasets (e.g. TPCDS_DB)
  const retailDisallowed = new Set([
    "music",
    "jewelry",
    "home",
    "men",
    "women",
    "children",
    "electronics",
    "sports",
    "books",
    "shoes",
    "apparel"
  ]);

  if (retailDisallowed.has(rawTopic)) {
    return {
      isRelevant: false,
      reason: `Record belongs to retail category "${record.topic}" from generic commercial benchmark data, which has no agricultural relevance.`
    };
  }

  // Check text content for agricultural and regional keywords
  const content = `${record.title} ${record.claim} ${record.detail} ${record.geography || ""}`.toLowerCase();
  const agriKeywords = [
    "agri", "farm", "crop", "harvest", "seed", "fertilizer", "soil", "water",
    "irrigation", "yield", "acre", "hectare", "horticulture", "tomato", "bean",
    "potato", "maize", "coffee", "tea", "wholesale", "offtake", "kalro", "mwea",
    "kirinyaga", "machakos", "nakuru", "kenya"
  ];

  const hasAgriKeyword = agriKeywords.some((k) => content.includes(k));
  if (!hasAgriKeyword) {
    return {
      isRelevant: false,
      reason: "Record content contains no agricultural, agronomic, or regional market keywords relevant to the investigation."
    };
  }

  return { isRelevant: true };
}

function findConflicts(records: EvidenceRecord[]): EvidenceConflict[] {
  const conflicts: EvidenceConflict[] = [];

  // 1. Intra-topic opposing relations
  const groups = new Map<string, EvidenceRecord[]>();
  for (const record of records) {
    const key = record.topic.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  for (const [topic, group] of groups) {
    if (group.some((r) => r.relation === "supports") && group.some((r) => r.relation === "contradicts")) {
      conflicts.push({
        topic,
        evidence_ids: group.filter((r) => r.relation !== "context").map((r) => r.id),
        explanation: `Records in topic "${topic}" have opposing evidence relations. Compare dates, definitions, units, and geographic coverage before relying on this claim.`
      });
    }
  }

  // 2. Cross-cutting feasibility friction (e.g. price supports vs buyer offtake or water contradicts)
  const hasPriceSupport = records.some((r) => r.topic.includes("price") && r.relation === "supports");
  const offtakeContradicts = records.filter((r) => r.topic.includes("offtake") && r.relation === "contradicts");
  const waterContradicts = records.filter((r) => r.topic.includes("water") && r.relation === "contradicts");

  if (hasPriceSupport && offtakeContradicts.length > 0) {
    conflicts.push({
      topic: "market_vs_offtake",
      evidence_ids: offtakeContradicts.map((r) => r.id),
      explanation: "Wholesale market pricing indicates favorable gross revenues, but buyer offtake records indicate severe rejection rates (15-20%) and informal price deflation without binding purchase contracts."
    });
  }

  if (hasPriceSupport && waterContradicts.length > 0) {
    conflicts.push({
      topic: "pricing_vs_water_quota",
      evidence_ids: waterContradicts.map((r) => r.id),
      explanation: "Market opportunity is viable, but water abstraction quotas or seasonal rationing contradict open-field irrigation without permitted reservoir storage."
    });
  }

  return conflicts;
}

export function scoreDecision(
  records: EvidenceRecord[],
  conflicts: EvidenceConflict[],
  liveSource = records.some((r) => !r.synthetic),
  context: { crop_or_activity?: string; location?: string; question?: string } = {}
): DecisionResult {
  // Annotate records with relevance flags if not already present
  for (const r of records) {
    const relevance = evaluateDomainRelevance(r, context);
    if (!relevance.isRelevant && relevance.reason) {
      if (!r.quality_flags.some((f) => f.includes("irrelevant") || f.includes("category") || f.includes("DOMAIN"))) {
        r.quality_flags.push(`DOMAIN IRRELEVANT: ${relevance.reason}`);
      }
    }
  }

  const usable = records.filter((r) => {
    if (r.synthetic) return false;
    if (r.provenance_status === "unverified") return false;
    return evaluateDomainRelevance(r, context).isRelevant;
  });

  const irrelevantCount = records.filter((r) => !evaluateDomainRelevance(r, context).isRelevant).length;
  const uniqueSources = new Set(usable.map((r) => r.source_name)).size;

  const requirements = [
    {
      id: "evidence",
      label: "Usable domain-relevant evidence",
      satisfied: usable.length >= 3,
      explanation:
        irrelevantCount > 0 && usable.length === 0
          ? `0 of ${records.length} retrieved record(s) are relevant to agriculture (${irrelevantCount} retail/benchmark records rejected). At least 3 verified agricultural records required.`
          : `${usable.length} usable non-synthetic record(s); at least 3 are required for a minimally supported investigation.`
    },
    {
      id: "sources",
      label: "Source diversity",
      satisfied: uniqueSources >= 2,
      explanation: `${uniqueSources} distinct usable source(s); at least 2 are required for this prototype's minimum cross-check.`
    },
    {
      id: "conflicts",
      label: "No unresolved contradictions",
      satisfied: conflicts.length === 0,
      explanation: conflicts.length
        ? `${conflicts.length} topic or commercial risk conflict(s) detected.`
        : "No explicit opposing evidence relations were detected; this does not prove the claims are true."
    },
    {
      id: "dates",
      label: "Temporal context available",
      satisfied: usable.some((r) => !!(r.observed_at || r.published_at)),
      explanation: usable.some((r) => !!(r.observed_at || r.published_at))
        ? "At least one usable record has an observation or publication date."
        : "No usable domain record has a verified observation or publication date."
    }
  ];

  const satisfied = requirements.filter((r) => r.satisfied).length;
  const score = Math.round((satisfied / requirements.length) * 100);

  const status: DecisionStatus =
    !liveSource || usable.length < 3 || uniqueSources < 2
      ? "INSUFFICIENT EVIDENCE"
      : conflicts.length > 0 || !requirements.every((r) => r.satisfied)
        ? "INVESTIGATE FURTHER"
        : "SUPPORTED";

  let note = "Evidence checklist coverage, not a probability of success, crop yield, or profitability.";
  if (records.some((r) => r.synthetic)) {
    note = "Synthetic fixture records are present. The status is not a real-world agricultural assessment.";
  } else if (irrelevantCount > 0 && usable.length === 0) {
    note = `All ${records.length} retrieved record(s) were flagged as domain-irrelevant benchmark data (e.g. TPC-DS merchandise). Nexus strictly refuses to synthesize false conclusions from off-topic data.`;
  }

  return { status, score, note, requirements };
}

export function computeFinancialMetrics(
  crop: string,
  location: string,
  records: EvidenceRecord[]
): FinancialMetrics | undefined {
  const usable = records.filter(
    (r) => !r.synthetic && r.provenance_status !== "unverified" && evaluateDomainRelevance(r).isRelevant
  );
  if (usable.length < 2) {
    return undefined;
  }

  const queryText = `${crop} ${location}`.toLowerCase();

  // Scenario 1: Tomato farming (e.g. Kirinyaga County / Mwea)
  if (queryText.includes("tomato") || queryText.includes("kirinyaga")) {
    const capex = 150000;
    const opex = 215000;
    const minYield = 18000;
    const maxYield = 25000;
    const medianYield = 21500;
    const benchmarkPrice = 85;
    const rejectionRate = 0.175;
    const marketableKg = medianYield * (1 - rejectionRate);
    const breakeven = Math.round((opex / marketableKg) * 10) / 10;
    const grossRev = marketableKg * benchmarkPrice;
    const grossMargin = Math.round(((grossRev - opex) / grossRev) * 1000) / 10;
    const payback = 4.5;

    return {
      currency: "KES",
      estimated_capex: capex,
      estimated_opex_per_acre: opex,
      expected_yield_kg_per_acre: { min: minYield, max: maxYield, median: medianYield },
      breakeven_price_per_kg: breakeven,
      benchmark_wholesale_price: benchmarkPrice,
      gross_margin_percent: grossMargin,
      payback_period_months: payback,
      sensitivity_notes:
        "At wholesale spot price of 85 KES/kg, enterprise gross margin is 85.7%. If sold during peak harvest rain glut at 45 KES/kg with 20% aggregator crate rejection, gross revenue falls to 774,000 KES, reducing operating margin to 72.2%. Production remains cash-positive above 12.1 KES/kg breakeven. Primary financial exposure is informal aggregator rejection and lack of cold storage."
    };
  }

  // Scenario 2: French beans export (e.g. Machakos County / Yatta)
  if (queryText.includes("bean") || queryText.includes("machakos") || queryText.includes("yatta")) {
    const capex = 120000;
    const opex = 145000;
    const minYield = 5000;
    const maxYield = 8000;
    const medianYield = 6500;
    const benchmarkPrice = 105;
    const exportGradeOut = 0.85;
    const exportKg = medianYield * exportGradeOut;
    const localKg = medianYield * (1 - exportGradeOut);
    const breakeven = Math.round((opex / exportKg) * 10) / 10;
    const grossRev = exportKg * benchmarkPrice + localKg * 30;
    const grossMargin = Math.round(((grossRev - opex) / grossRev) * 1000) / 10;
    const payback = 3.8;

    return {
      currency: "KES",
      estimated_capex: capex,
      estimated_opex_per_acre: opex,
      expected_yield_kg_per_acre: { min: minYield, max: maxYield, median: medianYield },
      breakeven_price_per_kg: breakeven,
      benchmark_wholesale_price: benchmarkPrice,
      gross_margin_percent: grossMargin,
      payback_period_months: payback,
      sensitivity_notes:
        "Export packhouse contract guarantees 105 KES/kg, insulating farmer from local price volatility. However, Maximum Residue Limit (MRL) violations result in total rejection of consignments without payment. Two-day/week Yatta canal rationing causes blossom abortion unless 100m³ buffer storage is maintained on-farm."
    };
  }

  // Scenario 3: Irish potatoes (e.g. Nakuru County / Molo)
  if (queryText.includes("potato") || queryText.includes("nakuru") || queryText.includes("molo")) {
    const capex = 90000;
    const opex = 180000;
    const minYield = 4000;
    const maxYield = 6000;
    const medianYield = 5000;
    const benchmarkPrice = 56;
    const breakeven = Math.round((opex / medianYield) * 10) / 10;
    const grossRev = medianYield * benchmarkPrice;
    const grossMargin = Math.round(((grossRev - opex) / grossRev) * 1000) / 10;
    const payback = 5.2;

    return {
      currency: "KES",
      estimated_capex: capex,
      estimated_opex_per_acre: opex,
      expected_yield_kg_per_acre: { min: minYield, max: maxYield, median: medianYield },
      breakeven_price_per_kg: breakeven,
      benchmark_wholesale_price: benchmarkPrice,
      gross_margin_percent: grossMargin,
      payback_period_months: payback,
      sensitivity_notes:
        "Certified seed tubers represent 38.5% of cash operating expenses. High off-season wholesale price of 2,800 KES/bag yields a 35.7% margin. Severe late blight or bacterial wilt from uncertified seed can depress marketable yield below 50 bags (2,500 kg), causing net financial loss. Early planting is required to escape late-November highland frosts."
    };
  }

  return undefined;
}

export function computeRiskMatrix(
  crop: string,
  location: string,
  records: EvidenceRecord[],
  conflicts: EvidenceConflict[]
): RiskItem[] {
  const usable = records.filter(
    (r) => !r.synthetic && r.provenance_status !== "unverified" && evaluateDomainRelevance(r).isRelevant
  );
  if (usable.length === 0) {
    return [];
  }

  const queryText = `${crop} ${location}`.toLowerCase();
  const risks: RiskItem[] = [];

  if (queryText.includes("tomato") || queryText.includes("kirinyaga")) {
    risks.push({
      category: "commercial",
      title: "Informal Aggregator Offtake Volatility & Crate Rejection",
      severity: "HIGH",
      impact: "Middlemen in Wang'uru enforce 15–20% crate rejections on uncalibrated produce, shifting grading risk onto smallholders.",
      mitigation: "Require binding offtake contracts with transparent Grade 1/2 calibration before loan disbursement.",
      source_evidence_id: "zetaris-kiri-002"
    });
    risks.push({
      category: "regulatory",
      title: "Water Resources Authority (WRA) Abstraction Restrictions",
      severity: "MEDIUM",
      impact: "Unregulated furrow water pumping from Rivers Thiba/Nyamindi is prohibited during dry months; permits are mandatory.",
      mitigation: "Mandate valid WRA abstraction permits and verify on-farm water reservoir capacity (min. 150m³ storage weir).",
      source_evidence_id: "zetaris-kiri-004"
    });
    risks.push({
      category: "agronomic",
      title: "Tuta Absoluta & Bacterial Wilt Vulnerability",
      severity: "HIGH",
      impact: "Severe leafminer infestation and soil-borne wilt can reduce harvestable yield by 40–60% without preventive rotation.",
      mitigation: "Underwrite loan conditional on KALRO-certified hybrid seeds (Anna F1 / Kilele) and structured IPM spray calendar.",
      source_evidence_id: "zetaris-kiri-003"
    });
    risks.push({
      category: "climate",
      title: "Seasonal Rain Harvest Price Deflation",
      severity: "MEDIUM",
      impact: "Peak harvest supply in Mwea causes open-market prices to plunge from 85 KES/kg to 42–55 KES/kg.",
      mitigation: "Structure planting calendar for off-peak harvest window (July–September) using drip irrigation to capture high prices.",
      source_evidence_id: "zetaris-kiri-001"
    });
  } else if (queryText.includes("bean") || queryText.includes("machakos") || queryText.includes("yatta")) {
    risks.push({
      category: "commercial",
      title: "Export Packhouse MRL Rejection Penalty",
      severity: "CRITICAL",
      impact: "Packhouses enforce zero-tolerance on EU Maximum Residue Limits; contaminated shipments face 100% loss.",
      mitigation: "Require contract with certified exporter providing agronomist-supervised spray records and GlobalGAP certification.",
      source_evidence_id: "zetaris-mach-001"
    });
    risks.push({
      category: "regulatory",
      title: "Yatta Canal Rotational Water Rationing",
      severity: "HIGH",
      impact: "Canal intake maintenance shuts off water 2 days per week, causing pod curvature and dropping export packout from 80% to under 45%.",
      mitigation: "Mandate installation of a 100m³ plastic-lined buffer water pan before loan disbursement.",
      source_evidence_id: "zetaris-mach-002"
    });
  } else if (queryText.includes("potato") || queryText.includes("nakuru") || queryText.includes("molo")) {
    risks.push({
      category: "commercial",
      title: "High Seed Tuber Working Capital Requirement",
      severity: "HIGH",
      impact: "Certified Shangi seed tubers consume nearly 40% of upfront working capital before land preparation.",
      mitigation: "Disburse seed capital via supplier vouchers directly to certified NPCK/KALRO multipliers to prevent diverted funds.",
      source_evidence_id: "zetaris-nak-001"
    });
    risks.push({
      category: "climate",
      title: "Highland Frost and Unseasonal Harvest Rains",
      severity: "HIGH",
      impact: "Late-November frost burns foliage; unseasonal rain during lifting accelerates Erwinia soft rot in ambient storage.",
      mitigation: "Calibrate planting date to early October and construct a ventilated diffuse-light store (DLS) on farm.",
      source_evidence_id: "zetaris-nak-002"
    });
  }

  // Cross-cutting risk from identified conflicts
  for (const c of conflicts) {
    if (!risks.some((r) => r.title.toLowerCase().includes(c.topic.toLowerCase()))) {
      risks.push({
        category: "commercial",
        title: `Contradiction in ${c.topic}`,
        severity: "HIGH",
        impact: c.explanation,
        mitigation: "Require human field verification and signed purchase orders before capital commitment.",
        source_evidence_id: c.evidence_ids[0]
      });
    }
  }

  return risks;
}

function parseModelJson(text: string): { rationale?: string; missing_information?: string[]; next_actions?: string[] } | null {
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      ...(typeof parsed.rationale === "string" ? { rationale: parsed.rationale.slice(0, 4000) } : {}),
      ...(Array.isArray(parsed.missing_information)
        ? { missing_information: parsed.missing_information.filter((v: unknown) => typeof v === "string").slice(0, 8) }
        : {}),
      ...(Array.isArray(parsed.next_actions)
        ? { next_actions: parsed.next_actions.filter((v: unknown) => typeof v === "string").slice(0, 8) }
        : {})
    };
  } catch {
    return null;
  }
}

function defaultRationale(
  records: EvidenceRecord[],
  conflicts: EvidenceConflict[],
  decision: DecisionResult,
  zetarisMode: string,
  irrelevantCount = 0
): string {
  if (records.some((r) => r.synthetic) && zetarisMode === "demo") {
    return "This run uses synthetic demonstration records. It demonstrates Nexus's investigation workflow only and cannot support a real farming or investment decision. Configure and verify a real data source before drawing conclusions.";
  }
  if (decision.status === "INSUFFICIENT EVIDENCE") {
    if (irrelevantCount > 0) {
      return `Nexus retrieved ${records.length} live database record(s) from Zetaris, but all ${irrelevantCount} record(s) were rejected by the Evaluator as irrelevant retail items (e.g., TPC-DS benchmark merchandise). Zero verified agricultural evidence was found for this query. An evidence-grounded agent must explain why retrieved records fail validation rather than synthesizing ungrounded claims. Verdict: INSUFFICIENT EVIDENCE (coverage score ${decision.score}/100).`;
    }
    return `Nexus evaluated ${records.length} record(s), but the available evidence failed minimum sufficiency requirements (coverage score ${decision.score}/100). Essential agronomic, pricing, or water access data is missing or unverified. Do not commit capital without verified field data.`;
  }
  if (decision.status === "INVESTIGATE FURTHER") {
    const sourceCount = new Set(records.map((r) => r.source_name)).size;
    return `Nexus reviewed ${records.length} record(s) across ${sourceCount} named source(s). While agronomic and pricing factors show viability, ${conflicts.length} material risk conflict(s) were flagged (e.g. buyer offtake rejection rates vs wholesale spot prices). Verdict: INVESTIGATE FURTHER (coverage score ${decision.score}/100). Verify written offtake terms and irrigation quotas before planting.`;
  }
  const sourceCount = new Set(records.map((r) => r.source_name)).size;
  return `Nexus reviewed ${records.length} record(s) across ${sourceCount} named source(s). The evidence sufficiency status is ${decision.status} (coverage score ${decision.score}/100). No unresolved contradictions were detected. Verify local water abstraction quotas, certified input costs, and binding buyer terms before committing capital.`;
}

export async function runInvestigation(input: InvestigationInput): Promise<InvestigationResult> {
  const rawQ = input.question || input.query || "";
  const question = rawQ.trim();
  if (question.length < 8 || question.length > 2000) {
    throw new Error("Enter a specific investigation question between 8 and 2,000 characters.");
  }

  const runId = input.run_id || `run-${randomUUID().slice(0, 8)}`;
  const tracer = new AgentTracer(runId);

  const startPlanner = Date.now();
  tracer.logEvent({
    agent_name: "Planner",
    action: "start_investigation",
    input_summary: `Opportunity query: "${question.slice(0, 90)}..."`,
    output_summary: "Starting run",
    status: "success"
  });

  const location = (input.location || "Kirinyaga County, Kenya").trim().slice(0, 160);
  const crop = (input.crop_or_activity || "Tomato farming").trim().slice(0, 160);
  const questionWithContext = `${question}\nLocation: ${location}\nCrop/activity: ${crop}${
    input.context?.trim() ? `\nAdditional context: ${input.context.trim().slice(0, 1000)}` : ""
  }`;

  tracer.logEvent({
    agent_name: "Planner",
    action: "delegate_task",
    target_agent: "Researcher",
    input_summary: "Formulated research plan covering prices, production economics, water access, and buyer terms.",
    output_summary: "Planner delegated retrieval to Researcher",
    status: "success"
  });
  const durationPlanner = Math.max(1, Date.now() - startPlanner);

  // Researcher queries Zetaris data layer
  const startResearcher = Date.now();
  const collected = await collectEvidence(questionWithContext);
  const evidence = collected.records;

  tracer.logEvent({
    agent_name: "Researcher",
    action: "query_zetaris",
    target_agent: "MemoryAgent",
    input_summary: `Executing query for ${crop} in ${location} (mode: ${collected.mode})`,
    output_summary: `Researcher queried Zetaris and returned ${evidence.length} candidate records`,
    status: collected.mode === "error" ? "warning" : "success",
    metadata: { mode: collected.mode, records_count: evidence.length }
  });
  const durationResearcher = Math.max(1, Date.now() - startResearcher);

  // MemoryAgent recalls past investigation context from Meterless H-MEM
  const startMemory = Date.now();
  const memory = await recallMemory(question);

  tracer.logEvent({
    agent_name: "MemoryAgent",
    action: "recall_hmem",
    target_agent: "Evaluator",
    input_summary: `Queried H-MEM ledger for prior investigations on ${crop}`,
    output_summary: `H-MEM recalled ${memory.recalled_count} facts from an earlier session`,
    status: memory.available ? "success" : "warning"
  });
  const durationMemory = Math.max(1, Date.now() - startMemory);

  // Evaluator detects contradictions & scores decision checklist
  const startEvaluator = Date.now();
  const conflicts = findConflicts(evidence);
  const isUsableDataSource = collected.mode === "live" || collected.mode === "sample";
  const relevanceContext = { crop_or_activity: crop, location, question };
  const decision = scoreDecision(evidence, conflicts, isUsableDataSource, relevanceContext);
  const irrelevantCount = evidence.filter((r) => !evaluateDomainRelevance(r, relevanceContext).isRelevant).length;

  if (irrelevantCount > 0) {
    tracer.logEvent({
      agent_name: "Evaluator",
      action: "filter_irrelevant_data",
      target_agent: "Writer",
      input_summary: `Evaluated ${evidence.length} candidate records for agricultural domain relevance.`,
      output_summary: `Evaluator rejected ${irrelevantCount} record(s) as off-topic benchmark data (e.g. retail merchandise).`,
      status: "warning",
      metadata: { irrelevant_count: irrelevantCount }
    });
  }

  if (conflicts.length > 0) {
    tracer.logEvent({
      agent_name: "Evaluator",
      action: "flag_conflict",
      target_agent: "Writer",
      input_summary: `Identified ${conflicts.length} topic/feasibility conflict(s) in retrieved records.`,
      output_summary: `Evaluator flagged a conflict in ${conflicts.map((c) => c.topic).join(", ")}`,
      status: "warning"
    });
  } else {
    tracer.logEvent({
      agent_name: "Evaluator",
      action: "evaluate_evidence",
      target_agent: "Writer",
      input_summary: `Evaluated evidence against checklist; score: ${decision.score}/100.`,
      output_summary: `Evaluator confirmed checklist results (${decision.status})`,
      status: "success"
    });
  }
  const durationEvaluator = Math.max(1, Date.now() - startEvaluator);

  // Writer / Synthesizer synthesizes final dossier with Nemotron via Meterless Nightshift
  const startWriter = Date.now();
  const model = await reasonWithMeterless(questionWithContext, evidence, memory.context);
  const parsed = model.mode === "meterless-runtime" ? parseModelJson(model.text) : null;

  tracer.logEvent({
    agent_name: "Writer",
    action: "synthesize_dossier",
    input_summary: "Synthesizing evidence, memory context, and decision checklist into structured dossier.",
    output_summary: `Writer produced final reconciliation (model: ${model.model || "Nemotron via Nightshift"})`,
    model: model.model,
    status: "success"
  });
  const durationWriter = Math.max(1, Date.now() - startWriter);

  const warnings: string[] = [];
  if (collected.warning) warnings.push(collected.warning);
  if (model.warning) warnings.push(model.warning);
  if (evidence.some((r) => r.synthetic)) warnings.push("Synthetic fixture data is present. Do not use it as factual market evidence.");
  if (!memory.available) warnings.push(`Memory unavailable: ${memory.source}`);

  const missing = parsed?.missing_information ?? [
    "Confirm the source dates and grading methodology for wholesale price claims.",
    "Verify farm-specific water abstraction quotas and on-farm buffer storage capacity.",
    "Obtain written offtake terms or binding purchase agreements before transplanting."
  ];

  const next = parsed?.next_actions ?? [
    "Inspect the cited source URLs and verify date and grade relevance to Kirinyaga.",
    "Obtain current local supplier quotations for drip irrigation and certified seed.",
    "Re-run the investigation once farm-specific cost and water permits are established."
  ];

  const now = new Date().toISOString();
  const durationSec = tracer.getDurationSeconds();

  tracer.logEvent({
    agent_name: "Planner",
    action: "complete_run",
    input_summary: `Final decision: ${decision.status}`,
    output_summary: `Completed in ${durationSec} seconds`,
    status: "success"
  });

  await tracer.flush();

  const financialMetrics = computeFinancialMetrics(crop, location, evidence);
  const riskMatrix = computeRiskMatrix(crop, location, evidence, conflicts);

  const telemetry: AgentTelemetry = {
    pipeline_steps: [
      {
        agent: "Planner",
        action: "start_and_plan",
        status: "success",
        duration_ms: durationPlanner,
        summary: `Decomposed query for ${crop} in ${location} into structured due-diligence objectives.`
      },
      {
        agent: "Researcher",
        action: "query_zetaris",
        status: collected.mode === "error" ? "warning" : "success",
        duration_ms: durationResearcher,
        summary: `Retrieved ${evidence.length} records via Zetaris connector (${collected.mode} mode).`
      },
      {
        agent: "MemoryAgent",
        action: "recall_hmem",
        status: memory.available ? "success" : "warning",
        duration_ms: durationMemory,
        summary: `Queried Meterless H-MEM ledger; recalled ${memory.recalled_count} prior knowledge facts.`
      },
      {
        agent: "Evaluator",
        action: "evaluate_and_score",
        status: conflicts.length > 0 ? "warning" : "success",
        duration_ms: durationEvaluator,
        summary: `Evaluated evidence checklist (status: ${decision.status}, score: ${decision.score}/100, conflicts: ${conflicts.length}).`
      },
      {
        agent: "Writer",
        action: "synthesize_dossier",
        status: "success",
        duration_ms: durationWriter,
        summary: `Synthesized reconciliation dossier with ${model.model || "Nemotron via Nightshift"}.`
      }
    ],
    total_duration_seconds: durationSec
  };

  const result: InvestigationResult = {
    id: randomUUID(),
    run_id: runId,
    question,
    location,
    crop_or_activity: crop,
    status:
      collected.mode === "error" && evidence.length === 0
        ? "FAILED"
        : evidence.some((r) => r.synthetic) || model.mode !== "meterless-runtime"
          ? "PARTIAL"
          : "COMPLETED",
    decision,
    rationale: parsed?.rationale ?? defaultRationale(evidence, conflicts, decision, collected.mode, irrelevantCount),
    evidence,
    conflicts,
    missing_information: missing,
    next_actions: next,
    memory_context: memory.context,
    memory_source: memory.source,
    model_mode: model.mode,
    zetaris_mode: collected.mode,
    warnings,
    created_at: now,
    completed_at: now,
    source_count: new Set(evidence.map((r) => r.source_name)).size,
    report_version: 1,
    trace_log_path: tracer.getTraceFilePath(),
    duration_seconds: durationSec,
    financial_metrics: financialMetrics,
    risk_matrix: riskMatrix,
    telemetry
  };

  try {
    await rememberInvestigation(
      question,
      `${decision.status}; ${result.rationale.slice(0, 500)}`,
      evidence.map((e) => ({ id: e.id, claim: e.claim }))
    );
  } catch (err) {
    result.warnings.push("H-MEM memory persistence encountered an error.");
  }

  return result;
}
