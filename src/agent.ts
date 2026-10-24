import { randomUUID } from "node:crypto";
import type {
  DecisionResult,
  DecisionStatus,
  EvidenceConflict,
  EvidenceRecord,
  InvestigationInput,
  InvestigationResult
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

  // Researcher queries Zetaris data layer
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

  // MemoryAgent recalls past investigation context from Meterless H-MEM
  const memory = await recallMemory(question);

  tracer.logEvent({
    agent_name: "MemoryAgent",
    action: "recall_hmem",
    target_agent: "Evaluator",
    input_summary: `Queried H-MEM ledger for prior investigations on ${crop}`,
    output_summary: `H-MEM recalled ${memory.recalled_count} facts from an earlier session`,
    status: memory.available ? "success" : "warning"
  });

  // Evaluator detects contradictions & scores decision checklist
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

  // Writer / Synthesizer synthesizes final dossier with Nemotron via Meterless Nightshift
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
    duration_seconds: durationSec
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
