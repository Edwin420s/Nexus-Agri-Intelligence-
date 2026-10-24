import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface MemoryEntry {
  id: string;
  content: string;
  type: "fact" | "observation" | "assumption" | "investigation" | "general";
  source: string;
  actor: string;
  topic?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  tokens: string[];
}

export interface MemoryQueryOptions {
  topN?: number;
  threshold?: number;
  topic?: string;
  type?: string;
}

export interface MemoryQueryResult {
  context: string;
  memories: Array<{
    memory: Omit<MemoryEntry, "tokens">;
    score: number;
  }>;
}

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was",
  "were", "have", "has", "had", "what", "when", "where", "which",
  "who", "whom", "how", "why", "can", "could", "should", "would"
]);

export class HMEM {
  private actor: string;
  private persistDir?: string;
  private store: Map<string, MemoryEntry> = new Map();
  private loaded = false;

  constructor(opts: { actor?: string; persistDir?: string } = {}) {
    this.actor = opts.actor || "nexus-investigation-agent";
    this.persistDir = opts.persistDir;
  }

  private storageFile(): string | null {
    if (!this.persistDir) return null;
    return path.join(this.persistDir, "hmem-ledger.json");
  }

  public async load(): Promise<void> {
    const file = this.storageFile();
    if (!file) return;
    try {
      const data = await fs.readFile(file, "utf8");
      const items = JSON.parse(data) as MemoryEntry[];
      this.store.clear();
      for (const item of items) {
        if (item && item.id && item.content) {
          this.store.set(item.id, {
            ...item,
            tokens: tokenize(item.content)
          });
        }
      }
      this.loaded = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.loaded = true;
        return;
      }
      throw err;
    }
  }

  public async persist(): Promise<void> {
    const file = this.storageFile();
    if (!file) return;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const array = Array.from(this.store.values()).map(({ tokens, ...rest }) => rest);
    const tempFile = `${file}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(array, null, 2), "utf8");
    await fs.rename(tempFile, file);
  }

  public add(entry: {
    content: string;
    type?: MemoryEntry["type"];
    source?: string;
    topic?: string;
    metadata?: Record<string, unknown>;
    id?: string;
  }): { id: string; content: string; timestamp: string } {
    const id = entry.id || randomUUID();
    const timestamp = new Date().toISOString();
    const mem: MemoryEntry = {
      id,
      content: entry.content.trim(),
      type: entry.type || "general",
      source: entry.source || "nexus:internal",
      actor: this.actor,
      topic: entry.topic,
      metadata: entry.metadata,
      timestamp,
      tokens: tokenize(entry.content)
    };
    this.store.set(id, mem);
    return { id, content: mem.content, timestamp };
  }

  public async mine(
    sourceType: string,
    text: string
  ): Promise<Array<{ id: string; content: string; type: string }>> {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 15);
    const mined: Array<{ id: string; content: string; type: string }> = [];

    for (const line of lines) {
      let type: MemoryEntry["type"] = "general";
      if (line.toLowerCase().includes("price") || line.toLowerCase().includes("cost")) {
        type = "fact";
      } else if (line.toLowerCase().includes("risk") || line.toLowerCase().includes("unknown")) {
        type = "assumption";
      } else if (line.toLowerCase().includes("investigation") || line.toLowerCase().includes("outcome")) {
        type = "investigation";
      }
      const added = this.add({
        content: line,
        type,
        source: `mined:${sourceType}`
      });
      mined.push({ id: added.id, content: added.content, type });
    }
    return mined;
  }

  public query(queryText: string, options: MemoryQueryOptions = {}): MemoryQueryResult {
    const topN = options.topN || 5;
    const threshold = options.threshold ?? 0.05;
    const queryTokens = new Set(tokenize(queryText));

    if (queryTokens.size === 0) {
      return { context: "", memories: [] };
    }

    const scored: Array<{ memory: Omit<MemoryEntry, "tokens">; score: number }> = [];

    for (const entry of this.store.values()) {
      if (options.topic && entry.topic !== options.topic) continue;
      if (options.type && entry.type !== options.type) continue;

      let matchCount = 0;
      for (const token of entry.tokens) {
        if (queryTokens.has(token)) matchCount++;
      }

      if (matchCount > 0) {
        const score = matchCount / Math.max(queryTokens.size, Math.sqrt(entry.tokens.length));
        if (score >= threshold) {
          const { tokens, ...rest } = entry;
          scored.push({ memory: rest, score: Math.round(score * 100) / 100 });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, topN);

    const context = selected
      .map(
        (m, i) =>
          `[Memory-${i + 1}] (${m.memory.type.toUpperCase()} from ${m.memory.source}): ${m.memory.content}`
      )
      .join("\n");

    return { context, memories: selected };
  }

  public clear(): void {
    this.store.clear();
  }

  public stats(): { count: number; actor: string; persistDir?: string } {
    return {
      count: this.store.size,
      actor: this.actor,
      persistDir: this.persistDir
    };
  }
}
