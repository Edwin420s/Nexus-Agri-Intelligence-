import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { HMEM } from "../src/engines/hmem.js";

test("HMEM engine stores and recalls memories by semantic/keyword relevance", () => {
  const hmem = new HMEM({ actor: "nexus-test" });

  hmem.add({
    content: "Kirinyaga County tomato wholesale market price was 85 KES per kg in October 2026.",
    type: "fact",
    source: "zetaris:kirinyaga_market",
    topic: "tomato_price"
  });

  hmem.add({
    content: "Drip irrigation kits for 1 acre cost approximately 120,000 KES in Kenya.",
    type: "fact",
    source: "zetaris:input_costs",
    topic: "irrigation"
  });

  hmem.add({
    content: "Bacterial wilt is a major soil-borne risk for Solanaceae crops in wet seasons.",
    type: "assumption",
    source: "agronomic:field_guide",
    topic: "crop_disease"
  });

  const queryResult = hmem.query("What are tomato prices in Kirinyaga?");
  assert.ok(queryResult.memories.length > 0);
  assert.equal(queryResult.memories[0].memory.topic, "tomato_price");
  assert.ok(queryResult.context.includes("85 KES"));
});

test("HMEM mines facts from investigation output text", async () => {
  const hmem = new HMEM({ actor: "nexus-miner" });
  const text = `
Investigation question: Should I farm tomatoes in Kirinyaga?
Cost assumption: Seedling nursery cost is 4 KES per seedling.
Risk alert: River water abstraction permits require county authorization.
Outcome: INVESTIGATE FURTHER due to unconfirmed water flow.
  `;

  const mined = await hmem.mine("opportunity_assessment", text);
  assert.ok(mined.length >= 3);
  assert.ok(mined.some((m) => m.type === "fact" && m.content.includes("Seedling")));
  assert.ok(mined.some((m) => m.type === "assumption" && m.content.includes("water")));
});

test("HMEM persists memories to disk and reloads on startup", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hmem-test-"));
  try {
    const hmem1 = new HMEM({ actor: "nexus-persister", persistDir: tempDir });
    hmem1.add({
      id: "mem-001",
      content: "Contract farming agreement offered by local cannery with 60 KES minimum price guarantee.",
      type: "fact",
      source: "buyer:contract"
    });
    await hmem1.persist();

    // Recreate fresh instance pointing to same storage
    const hmem2 = new HMEM({ actor: "nexus-persister", persistDir: tempDir });
    await hmem2.load();

    const query = hmem2.query("cannery contract minimum price guarantee");
    assert.equal(query.memories.length, 1);
    assert.equal(query.memories[0].memory.id, "mem-001");
    assert.ok(query.context.includes("60 KES"));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("HMEM filters by threshold and honors topN limits", () => {
  const hmem = new HMEM();
  for (let i = 1; i <= 10; i++) {
    hmem.add({
      content: `Agricultural record observation number ${i} regarding potato yields in Nakuru County.`,
      type: "fact"
    });
  }

  const res = hmem.query("potato yields in Nakuru", { topN: 3 });
  assert.equal(res.memories.length, 3);
  assert.ok(res.memories[0].score > 0);
});
