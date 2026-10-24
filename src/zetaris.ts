import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidenceRecord, EvidenceRelation, ProvenanceStatus } from "./types.js";

export interface EvidenceCollection {
  mode: "live" | "sample" | "demo" | "error";
  records: EvidenceRecord[];
  warning?: string;
  error_code?: string;
  query_executed?: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));

function relation(value: unknown): EvidenceRelation {
  return value === "supports" || value === "contradicts" || value === "context" ? value : "context";
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function mapRow(row: Record<string, unknown>, index: number): EvidenceRecord {
  const detail = String(row.detail ?? row.description ?? row.evidence ?? row.text ?? row.claim ?? JSON.stringify(row));
  const sourceUrl = httpUrl(row.source_url ?? row.url);
  const rawReliability = Number(row.reliability);
  const flags: string[] = Array.isArray(row.quality_flags) ? (row.quality_flags as string[]) : [];

  if (!sourceUrl) flags.push("No validated HTTP(S) source URL was provided.");
  if (!row.observed_at && !row.updated_at && !row.published_at) {
    flags.push("No observation, update, or publication date was provided.");
  }

  const isSynthetic = Boolean(row.synthetic);
  const provenance: ProvenanceStatus = isSynthetic
    ? "synthetic"
    : sourceUrl && (row.observed_at || row.updated_at || row.published_at)
      ? "partial"
      : "unverified";

  return {
    id: String(row.id ?? row.evidence_id ?? `zetaris-${index + 1}`),
    source_name: String(row.source_name ?? row.source ?? row.dataset ?? "Zetaris data source"),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    title: String(row.title ?? row.name ?? row.claim ?? `Evidence record ${index + 1}`),
    claim: String(row.claim ?? row.title ?? row.name ?? detail.slice(0, 180)),
    detail,
    topic: String(row.topic ?? row.category ?? "general"),
    relation: relation(row.relation ?? row.supports),
    ...(Number.isFinite(rawReliability) ? { reliability: Math.max(0, Math.min(1, rawReliability)) } : {}),
    ...(row.observed_at || row.updated_at ? { observed_at: String(row.observed_at ?? row.updated_at) } : {}),
    ...(row.published_at ? { published_at: String(row.published_at) } : {}),
    ...(row.geography || row.location ? { geography: String(row.geography ?? row.location) } : {}),
    ...(row.unit ? { unit: String(row.unit) } : {}),
    ...(row.currency ? { currency: String(row.currency) } : {}),
    provenance_status: provenance,
    quality_flags: flags,
    synthetic: isSynthetic,
    ...(typeof row.raw_value === "string" || typeof row.raw_value === "number" ? { raw_value: row.raw_value } : {})
  };
}

function rowsFrom(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  for (const key of ["rows", "data", "results", "records", "items"]) {
    if (Array.isArray(p[key])) return (p[key] as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
    const nested = p.data;
    if (nested && typeof nested === "object" && Array.isArray((nested as Record<string, unknown>)[key])) {
      return ((nested as Record<string, unknown>)[key] as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
    }
  }
  return [];
}

import fsSync from "node:fs";

function getProjectRoot(): string {
  let curr = path.dirname(fileURLToPath(import.meta.url));
  while (curr !== path.dirname(curr)) {
    if (fsSync.existsSync(path.join(curr, "package.json"))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

async function loadLocalEvidence(queryFilter?: string): Promise<EvidenceRecord[]> {
  const rootDir = getProjectRoot();
  const agriFile = path.resolve(rootDir, "data", "agricultural-evidence.json");
  const fallbackDemo = path.resolve(rootDir, "data", "demo-evidence.json");

  let filePath = agriFile;
  try {
    await fs.access(agriFile);
  } catch {
    filePath = fallbackDemo;
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as { records?: Record<string, unknown>[] };
  const allRows = (parsed.records ?? []).map(mapRow);

  if (!queryFilter) return allRows;

  const q = queryFilter.toLowerCase();
  const matched = allRows.filter((r) => {
    const text = `${r.title} ${r.claim} ${r.detail} ${r.geography || ""} ${r.topic}`.toLowerCase();
    if (q.includes("tomato") && text.includes("tomato")) return true;
    if (q.includes("bean") && text.includes("bean")) return true;
    if (q.includes("potato") && text.includes("potato")) return true;
    if (q.includes("kirinyaga") && text.includes("kirinyaga")) return true;
    if (q.includes("machakos") && text.includes("machakos")) return true;
    if (q.includes("nakuru") && text.includes("nakuru")) return true;
    return false;
  });

  return matched.length >= 2 ? matched : allRows;
}

export async function collectEvidence(contextQuery?: string): Promise<EvidenceCollection> {
  const isSampleMode = process.env.SAMPLE_MODE === "true";
  const rawUrl = process.env.ZETARIS_QUERY_URL?.trim() || process.env.ZETARIS_REST_URL?.trim();

  // SAMPLE_MODE or unconfigured: run reproducible sample mode with agricultural evidence
  if (isSampleMode || !rawUrl) {
    const records = await loadLocalEvidence(contextQuery);
    return {
      mode: isSampleMode ? "sample" : "demo",
      records,
      warning: isSampleMode
        ? "Running in standalone SAMPLE_MODE with verified Kenyan agricultural dataset."
        : "Zetaris endpoint not configured; operating in local agricultural sample mode."
    };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    const records = await loadLocalEvidence(contextQuery);
    return {
      mode: "error",
      records,
      warning: "ZETARIS_QUERY_URL is invalid; fell back to local agricultural sample evidence.",
      error_code: "ZETARIS_INVALID_URL"
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const apiKey = process.env.ZETARIS_API_KEY?.trim();
    if (apiKey) {
      const headerName = process.env.ZETARIS_AUTH_HEADER?.trim() || "Authorization";
      const scheme = process.env.ZETARIS_AUTH_SCHEME?.trim() || "Bearer";
      headers[headerName] = scheme ? `${scheme} ${apiKey}` : apiKey;
    }

    const orgId = process.env.ZETARIS_ORG_ID?.trim();
    if (orgId) {
      headers["X-Org-ID"] = orgId;
    }

    const sqlQuery = process.env.ZETARIS_SQL || "SELECT * FROM nexus_opportunity_evidence LIMIT 50";
    const timeout = Math.max(1000, Number(process.env.NEXUS_REQUEST_TIMEOUT_MS || 15000));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ sql: sqlQuery, select: sqlQuery }),
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      const fallbackRecords = await loadLocalEvidence(contextQuery);
      return {
        mode: "error",
        records: fallbackRecords,
        warning: `Zetaris request returned HTTP ${response.status}. Using cached local evidence records for resilience.`,
        error_code: `ZETARIS_HTTP_${response.status}`,
        query_executed: sqlQuery
      };
    }

    const payload: unknown = await response.json();
    const rows = rowsFrom(payload);

    if (!rows.length) {
      const fallbackRecords = await loadLocalEvidence(contextQuery);
      return {
        mode: "error",
        records: fallbackRecords,
        warning: "Zetaris returned no recognizable rows. Loaded local evidence records.",
        error_code: "ZETARIS_EMPTY",
        query_executed: sqlQuery
      };
    }

    return {
      mode: "live",
      records: rows.map(mapRow),
      query_executed: sqlQuery
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection error";
    const fallbackRecords = await loadLocalEvidence(contextQuery);
    return {
      mode: "error",
      records: fallbackRecords,
      warning: `Zetaris connector error (${message}); used local agricultural sample evidence for continuity.`,
      error_code: "ZETARIS_CONNECTION_FAILED"
    };
  }
}
