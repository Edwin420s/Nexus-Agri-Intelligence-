import fs from "node:fs/promises";
import path from "node:path";
import type { InvestigationResult } from "./types.js";

function dataFile(): string {
  return path.resolve(process.env.NEXUS_DATA_DIR?.trim() || "./storage", "investigations.json");
}
async function readAll(): Promise<InvestigationResult[]> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as InvestigationResult[] : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function writeAll(items: InvestigationResult[]): Promise<void> {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}

// Single-process JSON persistence for a hackathon prototype; use a transactional DB for multi-instance production.
export async function saveInvestigation(item: InvestigationResult): Promise<void> {
  const items = await readAll();
  items.unshift(item);
  await writeAll(items.slice(0, 200));
}
export async function listInvestigations(): Promise<Array<Pick<InvestigationResult, "id" | "run_id" | "question" | "location" | "crop_or_activity" | "status" | "decision" | "created_at" | "source_count">>> {
  const items = await readAll();
  return items.map(({ id, run_id, question, location, crop_or_activity, status, decision, created_at, source_count }) => ({ id, run_id, question, location, crop_or_activity, status, decision, created_at, source_count }));
}
export async function getInvestigation(id: string): Promise<InvestigationResult | undefined> {
  return (await readAll()).find((item) => item.id === id || item.run_id === id);
}
