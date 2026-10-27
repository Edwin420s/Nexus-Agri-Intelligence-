import { spawn } from "node:child_process";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }
}

async function runFrontendTests() {
  console.log("==================================================");
  console.log("  NEXUS FRONTEND END-TO-END AUTOMATION SUITE");
  console.log("  Running in real Google Chrome (Headless)");
  console.log("==================================================");

  const chromeProc = spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=9222",
    "http://localhost:8000/"
  ]);

  let cdp;
  let ws;

  try {
    // Wait for Chrome remote debugging to be ready
    let targets = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch("http://127.0.0.1:9222/json");
        if (res.ok) {
          targets = await res.json();
          break;
        }
      } catch {}
      await sleep(500);
    }

    if (!targets || !targets.length) {
      throw new Error("Could not connect to Chrome debugging endpoint");
    }

    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    const WSClass = globalThis.WebSocket;
    if (!WSClass) throw new Error("globalThis.WebSocket not found in Node runtime");
    ws = new WSClass(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    cdp = new CDPClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // Wait for initial health check to complete in frontend
    console.log("\n[TEST 1] Initial Page Load & Health State Banner");
    let serviceState = "";
    for (let i = 0; i < 20; i++) {
      serviceState = await cdp.evaluate('document.getElementById("service-state")?.textContent');
      if (serviceState && !serviceState.includes("Checking")) break;
      await sleep(300);
    }
    console.log(`  ✓ Service banner rendered: "${serviceState}"`);
    if (!serviceState.includes("Zetaris")) throw new Error("Service state banner did not update properly");

    // TEST 2: Preset 1 - Kirinyaga Tomatoes
    console.log("\n[TEST 2] Scenario 1: Kirinyaga Tomatoes (Contradiction Detection)");
    await cdp.evaluate(`
      document.querySelector('.preset-btn[data-preset="tomato"]').click();
      document.getElementById('run-button').click();
    `);

    console.log("  ...Waiting for investigation execution through Zetaris data layer...");
    let rec = "";
    for (let i = 0; i < 40; i++) {
      rec = await cdp.evaluate('document.getElementById("recommendation")?.textContent');
      if (rec && rec !== "—") break;
      await sleep(500);
    }

    const score = await cdp.evaluate('document.getElementById("confidence")?.textContent');
    const sourceCount = await cdp.evaluate('document.getElementById("source-count")?.textContent');
    const sourceMode = await cdp.evaluate('document.getElementById("source-mode")?.textContent');
    const conflictCount = await cdp.evaluate('document.getElementById("conflict-count")?.textContent');
    const finMargin = await cdp.evaluate('document.getElementById("fin-margin")?.textContent');
    const finBreakeven = await cdp.evaluate('document.getElementById("fin-breakeven")?.textContent');
    const pipelineStepsCount = await cdp.evaluate('document.querySelectorAll(".pipeline-step-card").length');
    const riskRowsCount = await cdp.evaluate('document.querySelectorAll(".risk-table tbody tr").length');
    const evidenceCardsCount = await cdp.evaluate('document.querySelectorAll(".evidence-item").length');

    console.log(`  ✓ Recommendation:  ${rec}`);
    console.log(`  ✓ Checklist Score: ${score}`);
    console.log(`  ✓ Source Count:    ${sourceCount} sources (${sourceMode})`);
    console.log(`  ✓ Conflict Count:  ${conflictCount} conflicts flagged`);
    console.log(`  ✓ Unit Economics:  Gross Margin ${finMargin}, Breakeven ${finBreakeven}`);
    console.log(`  ✓ Telemetry:       ${pipelineStepsCount} multi-agent pipeline steps rendered`);
    console.log(`  ✓ Credit Risks:    ${riskRowsCount} risk mitigations tabulated`);
    console.log(`  ✓ Evidence Ledger: ${evidenceCardsCount} evidence cards displayed`);

    if (rec !== "INVESTIGATE FURTHER") throw new Error(`Expected INVESTIGATE FURTHER, got ${rec}`);
    if (sourceMode !== "Live Zetaris response") throw new Error(`Expected Live Zetaris response, got ${sourceMode}`);
    if (pipelineStepsCount !== 5) throw new Error(`Expected 5 pipeline steps, got ${pipelineStepsCount}`);
    if (riskRowsCount < 4) throw new Error(`Expected at least 4 risk rows, got ${riskRowsCount}`);

    // TEST 3: Interactive Sensitivity Slider Test
    console.log("\n[TEST 3] Interactive Financial Sensitivity Slider");
    await cdp.evaluate(`
      const slider = document.getElementById("price-slider");
      slider.value = 45; // Test glut price deflation
      slider.dispatchEvent(new Event("input"));
    `);
    const sliderResult = await cdp.evaluate('document.getElementById("slider-margin-display")?.textContent');
    console.log(`  ✓ Stress-tested farmgate price at 45 KES/kg: "${sliderResult}"`);
    if (!sliderResult.includes("Gross Margin")) throw new Error("Slider did not recalculate margin correctly");

    // TEST 4: Preset 2 - Machakos French Beans
    console.log("\n[TEST 4] Scenario 2: Machakos French Beans (Canal Rationing)");
    await cdp.evaluate(`
      document.querySelector('.preset-btn[data-preset="beans"]').click();
      document.getElementById('run-button').click();
    `);
    for (let i = 0; i < 40; i++) {
      const q = await cdp.evaluate('document.getElementById("result-question")?.textContent');
      if (q && q.includes("Machakos")) break;
      await sleep(500);
    }
    const recBeans = await cdp.evaluate('document.getElementById("recommendation")?.textContent');
    const conflictsBeans = await cdp.evaluate('document.getElementById("conflicts")?.textContent');
    console.log(`  ✓ Recommendation: ${recBeans}`);
    console.log(`  ✓ Conflict text:  "${conflictsBeans.trim().slice(0, 100)}..."`);
    if (recBeans !== "INSUFFICIENT EVIDENCE") throw new Error(`Expected INSUFFICIENT EVIDENCE, got ${recBeans}`);

    // TEST 5: Preset 4 - Retail Control Rejection
    console.log("\n[TEST 5] Scenario 3: Control TPC-DS Retail Rejection");
    await cdp.evaluate(`
      document.querySelector('.preset-btn[data-preset="retail"]').click();
      document.getElementById('run-button').click();
    `);
    for (let i = 0; i < 60; i++) {
      const q = await cdp.evaluate('document.getElementById("result-question")?.textContent');
      const isRunning = await cdp.evaluate('document.getElementById("run-button")?.disabled');
      if (q && q.includes("retail") && !isRunning) break;
      await sleep(500);
    }
    const recRetail = await cdp.evaluate('document.getElementById("recommendation")?.textContent');
    const rationaleRetail = await cdp.evaluate('document.getElementById("rationale")?.textContent');
    console.log(`  ✓ Recommendation: ${recRetail}`);
    console.log(`  ✓ Domain filter:  "${rationaleRetail.slice(0, 110)}..."`);
    if (recRetail !== "INSUFFICIENT EVIDENCE") throw new Error(`Expected INSUFFICIENT EVIDENCE, got ${recRetail}`);
    if (!rationaleRetail.includes("retail")) throw new Error("Retail rejection reasoning not displayed in rationale");

    // TEST 6: History & Dossier Reload
    console.log("\n[TEST 6] History Panel & Reloading Past Dossier");
    await cdp.evaluate('document.getElementById("refresh-history").click()');
    await sleep(600);
    const historyRows = await cdp.evaluate('document.querySelectorAll(".history-row").length');
    console.log(`  ✓ Historical investigations listed: ${historyRows} items`);
    if (historyRows === 0) throw new Error("No history rows rendered");

    // Click the first history item to verify dossier reloads
    await cdp.evaluate('document.querySelector(".history-row button")?.click()');
    await sleep(600);
    const reloadedQuestion = await cdp.evaluate('document.getElementById("result-question")?.textContent');
    console.log(`  ✓ Successfully reloaded dossier for: "${reloadedQuestion.slice(0, 60)}..."`);

    console.log("\n==================================================");
    console.log("  ALL FRONTEND E2E TEST SCENARIOS PASSED!");
    console.log("==================================================");
  } finally {
    if (ws) ws.close();
    chromeProc.kill("SIGKILL");
  }
}

runFrontendTests().catch((err) => {
  console.error("\n❌ FRONTEND TEST FAILURE:", err);
  process.exit(1);
});
