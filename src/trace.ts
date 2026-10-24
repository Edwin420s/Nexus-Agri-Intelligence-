import fs from "node:fs/promises";
import path from "node:path";

export interface TraceEvent {
  timestamp: string;
  run_id: string;
  agent_name: string;
  action: string;
  input_summary: string;
  output_summary: string;
  target_agent?: string;
  model?: string;
  confidence?: number;
  retry_count?: number;
  status: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
}

export class AgentTracer {
  private runId: string;
  private logDir: string;
  private logFile: string;
  private events: TraceEvent[] = [];
  private startTime: number;

  constructor(runId: string, logDir = "./logs") {
    this.runId = runId;
    this.logDir = path.resolve(logDir);
    this.logFile = path.join(this.logDir, `trace-${runId}.jsonl`);
    this.startTime = Date.now();
  }

  public getTraceFilePath(): string {
    return this.logFile;
  }

  public logEvent(event: Omit<TraceEvent, "timestamp" | "run_id">): void {
    const fullEvent: TraceEvent = {
      timestamp: new Date().toISOString(),
      run_id: this.runId,
      ...event
    };
    this.events.push(fullEvent);

    // Readable stdout formatting per technical execution requirements
    const modelTag = fullEvent.model ? ` (model: ${fullEvent.model})` : "";
    console.log(`[INFO] run_id=${this.runId} ${fullEvent.agent_name} ${fullEvent.output_summary}${modelTag}`);
  }

  public async flush(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const lines = this.events
        .map((e) => this.redactSecrets(JSON.stringify(e)))
        .join("\n") + "\n";
      await fs.appendFile(this.logFile, lines, "utf8");
    } catch (err) {
      console.error(`Failed to write trace log for run ${this.runId}:`, err);
    }
  }

  public getDurationSeconds(): number {
    return Math.round(((Date.now() - this.startTime) / 1000) * 10) / 10;
  }

  private redactSecrets(str: string): string {
    return str
      .replace(/(?:api[-_]?key|token|password|secret)=([^&\s"]+)/gi, "$1=...redacted")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ...redacted");
  }
}
