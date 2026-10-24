import test from "node:test";
import assert from "node:assert/strict";
import { scoreDecision, evaluateDomainRelevance } from "../src/agent.js";
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
