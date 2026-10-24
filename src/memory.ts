import path from "node:path";
import { HMEM } from "./engines/hmem.js";

export interface MemoryResult {
  context: string;
  source: string;
  available: boolean;
  recalled_count: number;
}

let instance: HMEM | null = null;
let initPromise: Promise<HMEM> | null = null;

async function getHMEM(): Promise<HMEM> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dataDir = process.env.NEXUS_DATA_DIR?.trim() || "./storage";
    const persistDir = path.resolve(dataDir, "hmem");
    const hmem = new HMEM({
      actor: "nexus-agri-intelligence",
      persistDir
    });
    await hmem.load();

    // Pre-seed core baseline agronomic knowledge if the ledger is empty
    if (hmem.stats().count === 0) {
      hmem.add({
        id: "baseline-kirinyaga-01",
        content: "Kirinyaga County horticulture hubs (Mwea, Wang'uru) have high tomato production but face price volatility between dry harvest and rainy peaks.",
        type: "fact",
        source: "baseline:kalro_horticulture",
        topic: "production_geography"
      });
      hmem.add({
        id: "baseline-risk-01",
        content: "Tomato late blight (Phytophthora infestans) and bacterial wilt are primary yield threats in high-humidity seasons in central Kenya.",
        type: "fact",
        source: "baseline:agronomic_advisory",
        topic: "crop_disease"
      });
      hmem.add({
        id: "baseline-water-01",
        content: "Furrow irrigation carries higher runoff contamination risks; drip irrigation reduces water demand by 40% and fertilizer leaching.",
        type: "fact",
        source: "baseline:irrigation_standards",
        topic: "water_access"
      });
      await hmem.persist();
    }

    instance = hmem;
    return hmem;
  })();

  return initPromise;
}

export async function recallMemory(question: string): Promise<MemoryResult> {
  try {
    const hmem = await getHMEM();
    const result = hmem.query(question, { topN: 5, threshold: 0.08 });
    return {
      context: result.context,
      source: "Meterless H-MEM Engine (persistent)",
      available: true,
      recalled_count: result.memories.length
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Memory recall failed";
    return {
      context: "",
      source: `unavailable: ${msg}`,
      available: false,
      recalled_count: 0
    };
  }
}

export async function rememberInvestigation(
  question: string,
  summary: string,
  evidence: Array<{ id: string; claim: string }>
): Promise<void> {
  try {
    const hmem = await getHMEM();
    const compactEvidence = evidence
      .slice(0, 6)
      .map((e) => `[${e.id}] ${e.claim}`)
      .join("; ");
    const text = `Question: ${question}\nOutcome: ${summary}\nEvidence: ${compactEvidence}`;

    await hmem.mine("investigation", text);
    await hmem.persist();
  } catch (error) {
    console.error("H-MEM memory persistence error:", error);
  }
}

export async function memoryHealth(): Promise<{ available: boolean; source: string; stats?: Record<string, unknown> }> {
  try {
    const hmem = await getHMEM();
    const stats = hmem.stats();
    return {
      available: true,
      source: "Meterless H-MEM Engine (active)",
      stats: {
        memories_stored: stats.count,
        actor: stats.actor,
        storage_path: stats.persistDir
      }
    };
  } catch (error) {
    return {
      available: false,
      source: error instanceof Error ? error.message : "H-MEM unavailable"
    };
  }
}
