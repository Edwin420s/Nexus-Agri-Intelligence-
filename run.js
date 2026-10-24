#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPath = fsSync.existsSync(path.join(here, "dist", "src", "agent.js"))
  ? path.join(here, "dist", "src", "agent.js")
  : path.join(here, "src", "agent.js");
const storePath = fsSync.existsSync(path.join(here, "dist", "src", "store.js"))
  ? path.join(here, "dist", "src", "store.js")
  : path.join(here, "src", "store.js");

const { runInvestigation } = await import(pathToFileURL(agentPath).href);
const { saveInvestigation } = await import(pathToFileURL(storePath).href);

async function main() {
  const args = process.argv.slice(2);
  let input = {
    question: "Assess whether small-scale tomato farming in Kirinyaga County is worth investigating, considering market prices, production costs, water and seasonal risks, transport, and buyer access.",
    location: "Kirinyaga County, Kenya",
    crop_or_activity: "Tomato farming"
  };

  if (args.length > 0) {
    let targetArg = args[0];
    const inputFlagIdx = args.findIndex(a => a === "--input" || a === "-i");
    if (inputFlagIdx !== -1 && args[inputFlagIdx + 1]) {
      targetArg = args[inputFlagIdx + 1];
    } else if (targetArg.startsWith("--")) {
      targetArg = args.find(a => !a.startsWith("--")) || targetArg;
    }

    const filePath = path.resolve(targetArg);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(content);
      input = {
        question: parsed.question || parsed.input?.query || parsed.input?.question || parsed.query || input.question,
        location: parsed.location || parsed.input?.location || input.location,
        crop_or_activity: parsed.crop_or_activity || parsed.crop || parsed.input?.crop || input.crop_or_activity,
        run_id: parsed.run_id || parsed.runId
      };
    } catch (err) {
      console.error(`Failed to read input file ${filePath}:`, (err).message);
      process.exit(1);
    }
  }

  console.log(`[INFO] Executing Nexus agent for: "${input.question}"`);
  try {
    const result = await runInvestigation(input);
    await saveInvestigation(result);
    console.log("\n==================== INVESTIGATION DOSSIER ====================");
    console.log(`Run ID:         ${result.run_id}`);
    console.log(`Decision:       ${result.decision.status} (Score: ${result.decision.score}/100)`);
    console.log(`Rationale:      ${result.rationale}`);
    console.log(`Sources:        ${result.source_count} named sources reviewed`);
    console.log(`Conflicts:      ${result.conflicts.length} topic conflict(s) flagged`);
    console.log(`Zetaris Mode:   ${result.zetaris_mode}`);
    console.log(`Model Mode:     ${result.model_mode}`);
    console.log(`Trace Saved To: ${result.trace_log_path}`);
    console.log("===============================================================\n");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Execution failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
