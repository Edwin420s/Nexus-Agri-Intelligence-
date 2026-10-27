import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreDecision,
  evaluateDomainRelevance,
  computeFinancialMetrics,
  computeRiskMatrix
} from "../src/agent.js";
import { buildZetarisQuery, normalizeCropKey } from "../src/zetaris.js";
import type { EvidenceRecord } from "../src/types.js";

const rec = (
  id: string,
  source: string,
  relation: "supports" | "contradicts" | "context" = "context",
  synthetic = false,
  topic = "market_price"
): EvidenceRecord => ({
  id,
  source_name: source,
  title: `Tomato farming data ${id}`,
  claim: `Tomato yield and price in Kirinyaga ${id}`,
  detail: `Field observation on tomato farming economics ${id}`,
  topic,
  relation,
  reliability: 0.85,
  provenance_status: synthetic ? "synthetic" : "partial",
  quality_flags: [],
  synthetic,
  observed_at: "2026-10-01"
});

test("synthetic fixtures cannot satisfy evidence requirements", () => {
  const d = scoreDecision([rec("1", "A", "context", true), rec("2", "B", "context", true), rec("3", "C", "context", true)], [], false);
  assert.equal(d.status, "INSUFFICIENT EVIDENCE");
  assert.ok(d.score <= 50);
});

test("fewer than three usable records is insufficient", () => {
  const d = scoreDecision([rec("1", "A"), rec("2", "B")], [], true);
  assert.equal(d.status, "INSUFFICIENT EVIDENCE");
});

test("conflicting evidence triggers investigate further", () => {
  const rows = [rec("1", "A", "supports", false, "market_price"), rec("2", "B", "contradicts", false, "market_price"), rec("3", "C", "context", false, "production_costs")];
  const d = scoreDecision(rows, [{ topic: "market_price", evidence_ids: ["1", "2"], explanation: "conflict" }], true);
  assert.equal(d.status, "INVESTIGATE FURTHER");
});

test("minimum diverse, dated non-synthetic records can satisfy prototype policy", () => {
  const d = scoreDecision([rec("1", "A"), rec("2", "B"), rec("3", "C")], [], true);
  assert.equal(d.status, "SUPPORTED");
  assert.equal(d.score, 100);
});

test("unverified provenance is not counted as usable", () => {
  const rows = [rec("1", "A"), rec("2", "B"), rec("3", "C")].map((r) => ({ ...r, provenance_status: "unverified" as const }));
  const d = scoreDecision(rows, [], true);
  assert.equal(d.status, "INSUFFICIENT EVIDENCE");
});

test("domain relevance rejects retail merchandise and yields INSUFFICIENT EVIDENCE", () => {
  const retailRows: EvidenceRecord[] = [
    {
      id: "1",
      source_name: "TPCDS_DB.item (Zetaris Federated Data Lake)",
      title: "ought",
      claim: "ought",
      detail: "Pop music CD release catalog record",
      topic: "Music",
      relation: "context",
      provenance_status: "unverified",
      quality_flags: ["Raw TPC-DS benchmark table row from Zetaris; no independent agricultural source URL."],
      synthetic: false
    },
    {
      id: "2",
      source_name: "TPCDS_DB.item (Zetaris Federated Data Lake)",
      title: "jewelry item",
      claim: "jewelry item",
      detail: "Gold plated ring inventory item",
      topic: "Jewelry",
      relation: "context",
      provenance_status: "unverified",
      quality_flags: ["Raw TPC-DS benchmark table row from Zetaris; no independent agricultural source URL."],
      synthetic: false
    },
    {
      id: "3",
      source_name: "TPCDS_DB.item (Zetaris Federated Data Lake)",
      title: "home goods",
      claim: "home goods",
      detail: "Kitchen appliance",
      topic: "Home",
      relation: "context",
      provenance_status: "unverified",
      quality_flags: ["Raw TPC-DS benchmark table row from Zetaris; no independent agricultural source URL."],
      synthetic: false
    }
  ];

  const relevance0 = evaluateDomainRelevance(retailRows[0]);
  assert.equal(relevance0.isRelevant, false);

  const d = scoreDecision(retailRows, [], true, { crop_or_activity: "Tomato farming", location: "Kirinyaga County" });
  assert.equal(d.status, "INSUFFICIENT EVIDENCE");
  assert.ok(d.note.includes("domain-irrelevant"));
  assert.equal(d.requirements.find((r) => r.id === "evidence")?.satisfied, false);
});

test("computeFinancialMetrics calculates deterministic unit economics for Kirinyaga tomatoes", () => {
  const records = [rec("1", "KALRO", "supports", false, "production_costs"), rec("2", "Market", "supports", false, "market_price")];
  const fin = computeFinancialMetrics("Tomato farming", "Kirinyaga County", records);
  assert.ok(fin !== undefined);
  assert.equal(fin?.currency, "KES");
  assert.equal(fin?.estimated_capex, 150000);
  assert.equal(fin?.estimated_opex_per_acre, 215000);
  assert.equal(fin?.breakeven_price_per_kg, 12.1);
  assert.equal(fin?.benchmark_wholesale_price, 85);
  assert.equal(fin?.gross_margin_percent, 85.7);
  assert.equal(fin?.payback_period_months, 4.5);
  assert.ok(fin?.sensitivity_notes.includes("85 KES/kg"));
});

test("computeFinancialMetrics calculates unit economics for Machakos French beans", () => {
  const records = [rec("1", "HCD", "supports", false, "market_price"), rec("2", "Yatta", "context", false, "water_access")];
  const fin = computeFinancialMetrics("French beans export", "Machakos County", records);
  assert.ok(fin !== undefined);
  assert.equal(fin?.estimated_capex, 120000);
  assert.equal(fin?.estimated_opex_per_acre, 145000);
  assert.equal(fin?.breakeven_price_per_kg, 26.2);
  assert.equal(fin?.benchmark_wholesale_price, 105);
  assert.equal(fin?.gross_margin_percent, 76.2);
});

test("computeFinancialMetrics blocks calculations when evidence is insufficient or retail-only", () => {
  const retailRows = [rec("1", "TPCDS", "context", false, "Music")];
  const fin = computeFinancialMetrics("Tomato farming", "Kirinyaga County", retailRows);
  assert.equal(fin, undefined);
});

test("computeFinancialMetrics calculates unit economics for Murang'a Hass avocado", () => {
  const records = [rec("1", "Murang'a Avocado Cooperative", "supports", false, "market_price"), rec("2", "Kandara", "context", false, "yield")];
  const fin = computeFinancialMetrics("Hass avocado orchard", "Murang'a County", records);
  assert.ok(fin !== undefined);
  assert.equal(fin?.estimated_capex, 180000);
  assert.equal(fin?.estimated_opex_per_acre, 82000);
  assert.equal(fin?.benchmark_wholesale_price, 58);
  assert.equal(fin?.breakeven_price_per_kg, 10.8);
  assert.ok(fin?.sensitivity_notes.includes("Export packhouse contract"));
});

test("computeFinancialMetrics calculates unit economics for Uasin Gishu grain maize", () => {
  const records = [rec("1", "Eldoret Grain Hub", "supports", false, "market_price"), rec("2", "Moiben", "context", false, "yield")];
  const fin = computeFinancialMetrics("Hybrid maize farming", "Uasin Gishu County", records);
  assert.ok(fin !== undefined);
  assert.equal(fin?.estimated_capex, 45000);
  assert.equal(fin?.estimated_opex_per_acre, 68000);
  assert.equal(fin?.benchmark_wholesale_price, 43);
  assert.equal(fin?.breakeven_price_per_kg, 25.2);
});

test("computeFinancialMetrics calculates unit economics for Mwea Basmati rice in Kirinyaga", () => {
  const records = [rec("1", "Mwea Rice Growers", "supports", false, "market_price"), rec("2", "KALRO Mwea", "context", false, "yield")];
  const fin = computeFinancialMetrics("ricee", "Kirinyaga County, Kenya", records);
  assert.ok(fin !== undefined);
  assert.equal(fin?.estimated_capex, 80000);
  assert.equal(fin?.estimated_opex_per_acre, 95000);
  assert.equal(fin?.benchmark_wholesale_price, 78);
  assert.equal(fin?.breakeven_price_per_kg, 28.7);
  assert.ok(fin?.sensitivity_notes.includes("Basmati 370 paddy"));
});

test("computeRiskMatrix generates rice-specific credit risks with NIA canal and miller docking mitigations", () => {
  const records = [rec("zetaris-rice-001", "Wanguru Millers", "supports", false, "market_price"), rec("zetaris-rice-002", "Wanguru Millers", "contradicts", false, "buyer_offtake")];
  const risks = computeRiskMatrix("ricee", "Kirinyaga County, Kenya", records, []);
  assert.ok(risks.some((r) => r.title.includes("Paddy Moisture Content")));
  assert.ok(risks.some((r) => r.source_evidence_id === "zetaris-rice-002"));
  assert.ok(risks.some((r) => r.title.includes("National Irrigation Authority")));
});

test("buildZetarisQuery prioritizes explicit crop over location keywords and legacy question text", () => {
  const query = buildZetarisQuery({
    crop: "ricee",
    location: "Kirinyaga County, Kenya",
    question: "Assess whether small-scale tomato farming in Kirinyaga County is worth investigating..."
  });
  assert.ok(query.includes("zetaris-rice-001"), "Must execute rice SQL rather than tomato SQL");
  assert.ok(query.includes("Basmati 370"), "Must cite Basmati 370");
  assert.ok(!query.includes("zetaris-kiri-001"), "Must NOT execute tomato query");
});

test("computeRiskMatrix generates categorized credit risks with mitigations and source IDs", () => {
  const records = [
    rec("zetaris-kiri-001", "Wanguru", "supports", false, "market_price"),
    rec("zetaris-kiri-002", "Aggregators", "contradicts", false, "buyer_offtake")
  ];
  const risks = computeRiskMatrix("Tomato farming", "Kirinyaga County", records, []);
  assert.ok(risks.length >= 4);
  assert.ok(risks.some((r) => r.category === "commercial" && r.severity === "HIGH"));
  assert.ok(risks.some((r) => r.category === "regulatory" && r.source_evidence_id === "zetaris-kiri-004"));
  assert.ok(risks.some((r) => r.mitigation.includes("WRA") || r.mitigation.includes("offtake")));
});

