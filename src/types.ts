export type EvidenceRelation = "supports" | "contradicts" | "context";
export type ProvenanceStatus = "verified" | "partial" | "unverified" | "synthetic";
export type DecisionStatus = "SUPPORTED" | "INVESTIGATE FURTHER" | "INSUFFICIENT EVIDENCE";
export type RunStatus = "COMPLETED" | "PARTIAL" | "FAILED";

export interface EvidenceRecord {
  id: string;
  source_name: string;
  source_url?: string;
  title: string;
  claim: string;
  detail: string;
  topic: string;
  relation: EvidenceRelation;
  reliability?: number;
  observed_at?: string;
  published_at?: string;
  geography?: string;
  unit?: string;
  currency?: string;
  provenance_status: ProvenanceStatus;
  quality_flags: string[];
  synthetic: boolean;
  raw_value?: string | number;
  normalized_value?: string | number;
}

export interface EvidenceConflict {
  topic: string;
  evidence_ids: string[];
  explanation: string;
}

export interface DecisionResult {
  status: DecisionStatus;
  score: number;
  note: string;
  requirements: Array<{ id: string; label: string; satisfied: boolean; explanation: string }>;
}

export interface InvestigationResult {
  id: string;
  run_id: string;
  question: string;
  location: string;
  crop_or_activity: string;
  status: RunStatus;
  decision: DecisionResult;
  rationale: string;
  evidence: EvidenceRecord[];
  conflicts: EvidenceConflict[];
  missing_information: string[];
  next_actions: string[];
  memory_context: string;
  memory_source: string;
  model_mode: string;
  zetaris_mode: "live" | "sample" | "demo" | "error";
  warnings: string[];
  created_at: string;
  completed_at: string;
  source_count: number;
  report_version: number;
  trace_log_path?: string;
  duration_seconds?: number;
}

export interface InvestigationInput {
  question: string;
  run_id?: string;
  query?: string;
  location?: string;
  crop_or_activity?: string;
  context?: string;
}
