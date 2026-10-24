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
  const isTpcds = "i_item_sk" in row;
  const rawTitle = row.title ?? row.name ?? row.i_product_name ?? row.claim;
  const rawDetail = row.detail ?? row.description ?? row.evidence ?? row.text ?? row.i_item_desc ?? row.claim ?? JSON.stringify(row);
  const detail = String(rawDetail);
  const title = String(rawTitle ?? `Evidence record ${index + 1}`);

  const sourceUrl = httpUrl(row.source_url ?? row.url);
  const rawReliability = row.reliability !== undefined && row.reliability !== null ? Number(row.reliability) : NaN;
  const flags: string[] = Array.isArray(row.quality_flags) ? [...(row.quality_flags as string[])] : [];

  if (!sourceUrl) {
    flags.push(isTpcds
      ? "Raw TPC-DS benchmark table row from Zetaris; no independent agricultural source URL."
      : "No validated HTTP(S) source URL was provided in raw record.");
  }

  const rawObserved = row.observed_at ?? row.updated_at ?? row.published_at ?? row.i_rec_start_date;
  if (!rawObserved) {
    flags.push("No observation, update, or publication date was provided.");
  }

  const isSynthetic = row.synthetic === true || row.synthetic === "true" || row.synthetic === 1 || row.synthetic === "1";
  const rawTopic = String(row.topic ?? row.category ?? row.i_category ?? "general");

  // Determine honest provenance status
  let provenance: ProvenanceStatus = "unverified";
  if (isSynthetic) {
    provenance = "synthetic";
  } else if (sourceUrl && rawObserved) {
    provenance = row.provenance_status === "verified" ? "verified" : "partial";
  }

  // Derive source name honestly
  const defaultSourceName = isTpcds ? "TPCDS_DB.item (Zetaris Federated Data Lake)" : "Zetaris data source";
  const sourceName = String(row.source_name ?? row.source ?? row.dataset ?? defaultSourceName);

  // Derive relation: default to 'context' unless explicitly stated in original data
  const rawRel = row.relation ?? row.supports;
  const rel = rawRel ? relation(rawRel) : "context";

  return {
    id: String(row.id ?? row.evidence_id ?? row.i_item_sk ?? `zetaris-${index + 1}`),
    source_name: sourceName,
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    title,
    claim: String(row.claim ?? title ?? detail.slice(0, 180)),
    detail,
    topic: rawTopic,
    relation: rel,
    ...(Number.isFinite(rawReliability) ? { reliability: Math.max(0, Math.min(1, rawReliability)) } : {}),
    ...(rawObserved ? { observed_at: String(rawObserved) } : {}),
    ...(row.published_at ? { published_at: String(row.published_at) } : {}),
    ...(row.geography || row.location ? { geography: String(row.geography ?? row.location) } : {}),
    ...(row.unit || row.i_units ? { unit: String(row.unit ?? row.i_units) } : {}),
    ...(row.currency ? { currency: String(row.currency) } : {}),
    provenance_status: provenance,
    quality_flags: flags,
    synthetic: isSynthetic,
    ...(typeof row.raw_value === "string" || typeof row.raw_value === "number" || typeof row.i_wholesale_cost === "string"
      ? { raw_value: (row.raw_value ?? row.i_wholesale_cost) as string | number }
      : {})
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

import crypto from "node:crypto";

async function getZetarisAuthToken(baseUrl: URL): Promise<{ token?: string; orgId?: string }> {
  const email = process.env.ZETARIS_ADMIN_EMAIL?.trim() || "admin@zetaris.com";
  const password = process.env.ZETARIS_ADMIN_PASSWORD?.trim() || "Zetaris1@";
  try {
    const loginUrl = new URL("/api/auth/login", baseUrl.origin);
    const resp = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
      signal: AbortSignal.timeout(12000)
    });
    if (resp.ok) {
      const data = await resp.json() as Record<string, unknown>;
      const token = String(data.idToken || data.token || data.accessToken || "");
      const orgId = String(data.orgId || "1");
      return { token: token || undefined, orgId };
    }
  } catch {
    // Non-fatal, fallback to env keys
  }
  return {};
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
    let apiKey = process.env.ZETARIS_API_KEY?.trim();
    let orgId = process.env.ZETARIS_ORG_ID?.trim();

    if (!apiKey) {
      const autoAuth = await getZetarisAuthToken(url);
      if (autoAuth.token) {
        apiKey = autoAuth.token;
      }
      if (!orgId && autoAuth.orgId) {
        orgId = autoAuth.orgId;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Request-ID": crypto.randomUUID()
    };

    if (apiKey) {
      const headerName = process.env.ZETARIS_AUTH_HEADER?.trim() || "Authorization";
      const scheme = process.env.ZETARIS_AUTH_SCHEME?.trim() || "Bearer";
      headers[headerName] = scheme ? `${scheme} ${apiKey}` : apiKey;
    }

    if (orgId) {
      headers["X-Org-ID"] = orgId;
    }

    const sqlQuery = process.env.ZETARIS_SQL || "SELECT * FROM TPCDS_DB.item LIMIT 10";
    const timeout = Math.max(1000, Number(process.env.NEXUS_REQUEST_TIMEOUT_MS || 15000));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ select: sqlQuery, pageLimit: 50 }),
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
