const $ = (id) => document.getElementById(id);
const button = $("run-button");
const question = $("question");
const notice = $("notice");
const results = $("results");

let currentInvestigationData = null;

const PRESETS = {
  tomato: {
    question: "Assess whether small-scale tomato farming in Kirinyaga County is worth investigating, considering wholesale market prices in Wang'uru and Wakulima, certified seed and drip irrigation production costs, river water abstraction quotas, and aggregator offtake terms.",
    location: "Kirinyaga County, Kenya",
    crop: "Tomato farming"
  },
  rice: {
    question: "Assess commercial Basmati paddy rice production feasibility in Kirinyaga County (Mwea Irrigation Scheme), evaluating NIA farmgate wholesale prices, certified seed and rotavator puddling costs, rotational canal water quotas, and commercial miller moisture deductions.",
    location: "Kirinyaga County (Mwea), Kenya",
    crop: "Basmati paddy rice"
  },
  beans: {
    question: "Investigate export-grade French beans contract farming feasibility in Machakos County (Yatta), focusing on packhouse contract prices, canal rotational rationing risks, and GlobalGAP compliance requirements.",
    location: "Machakos County (Yatta), Kenya",
    crop: "French beans export"
  },
  potato: {
    question: "Evaluate commercial Irish potato production in Nakuru County (Molo highland area), examining wholesale 50kg bag prices, certified Shangi seed tuber costs, and rainfall cessation frost risks.",
    location: "Nakuru County (Molo), Kenya",
    crop: "Irish potato farming"
  },
  maize: {
    question: "Assess commercial white maize production feasibility in Uasin Gishu County (Eldoret / Turbo), evaluating NCPB and miller wholesale spot prices, certified H614 seed and fertilizer costs, and grain moisture discount penalties.",
    location: "Uasin Gishu County, Kenya",
    crop: "White maize commercial production"
  },
  avocado: {
    question: "Evaluate export Hass avocado orchard investment in Murang'a County (Kandara), focusing on exporter packhouse farmgate contracts, fruit fly phytosanitary standards, and GlobalGAP compliance costs.",
    location: "Murang'a County, Kenya",
    crop: "Hass avocado export orchard"
  },
  onion: {
    question: "Investigate commercial red bulb onion farming in Kajiado County (Loitokitok), examining Wakulima wholesale spot prices, hybrid F1 seed costs, curing losses, and borehole water salinity risks.",
    location: "Kajiado County, Kenya",
    crop: "Red bulb onion farming"
  },
  retail: {
    question: "Assess whether retail merchandise catalog records from TPCDS_DB can support an agricultural loan for horticulture.",
    location: "Kirinyaga County, Kenya",
    crop: "Apparel and Home Goods"
  }
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function safeHttpUrl(value) {
  try {
    const u = new URL(String(value || ""));
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

function showList(id, items) {
  $(id).innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    const z = health.integrations?.zetaris?.status || "unknown";
    const m = health.integrations?.meterless_runtime?.status || "unknown";
    const h = health.integrations?.hmem?.available ? "H-MEM: ready" : "H-MEM: unavailable";
    $("service-state").textContent = `Zetaris: ${z} · Runtime: ${m} · ${h}`;
    $("service-state").title = health.note || "";
  } catch {
    $("service-state").textContent = "API unavailable";
  }
}

// Preset Scenario Buttons
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const key = btn.dataset.preset;
    const preset = PRESETS[key];
    if (preset) {
      question.value = preset.question;
      $("location").value = preset.location;
      $("crop").value = preset.crop;
      question.dataset.userEdited = "";
    }
  });
});

// Auto-sync question if user manually edits crop/location without custom phrasing
$("crop").addEventListener("input", (e) => {
  const newCrop = e.target.value.trim();
  const loc = $("location").value.trim() || "Kenya";
  if (!question.dataset.userEdited && newCrop) {
    question.value = `Assess whether ${newCrop} production in ${loc} is commercially viable, examining wholesale farmgate prices, production and input costs, water access permits, and buyer offtake terms.`;
  }
});
$("location").addEventListener("input", (e) => {
  const newLoc = e.target.value.trim() || "Kenya";
  const cr = $("crop").value.trim() || "commercial agribusiness";
  if (!question.dataset.userEdited) {
    question.value = `Assess whether ${cr} production in ${newLoc} is commercially viable, examining wholesale farmgate prices, production and input costs, water access permits, and buyer offtake terms.`;
  }
});
question.addEventListener("input", () => {
  question.dataset.userEdited = "true";
});

function updateSensitivitySlider(f, price) {
  const opex = f.estimated_opex_per_acre;
  const marketableKg = f.breakeven_price_per_kg > 0 ? (opex / f.breakeven_price_per_kg) : f.expected_yield_kg_per_acre.median;
  const dynamicRev = marketableKg * price;
  const dynamicMargin = Math.round(((dynamicRev - opex) / dynamicRev) * 1000) / 10;

  $("slider-price-display").textContent = price;
  const marginDisplay = $("slider-margin-display");

  if (dynamicMargin < 0) {
    marginDisplay.textContent = `Operating Loss: ${dynamicMargin}%`;
    marginDisplay.style.color = "var(--red)";
  } else if (dynamicMargin < 35) {
    marginDisplay.textContent = `Gross Margin: ${dynamicMargin}% (Marginal)`;
    marginDisplay.style.color = "var(--amber)";
  } else {
    marginDisplay.textContent = `Gross Margin: ${dynamicMargin}% (Viable)`;
    marginDisplay.style.color = "var(--accent)";
  }
}

function render(data) {
  currentInvestigationData = data;
  results.classList.remove("hidden");
  $("result-question").textContent = data.question;
  $("result-date").textContent = new Date(data.created_at).toLocaleString();

  const decision = data.decision || {};
  $("recommendation").textContent = decision.status || "UNKNOWN";
  $("confidence").textContent = `${decision.score ?? 0}/100`;
  $("confidence-note").textContent = decision.note || "Evidence checklist coverage, not a probability of success.";
  $("source-count").textContent = data.source_count ?? new Set((data.evidence || []).map((e) => e.source_name)).size;
  $("source-mode").textContent =
    data.zetaris_mode === "live"
      ? "Live Zetaris response"
      : data.zetaris_mode === "sample"
        ? "Verified agricultural dataset"
        : data.zetaris_mode === "error"
          ? "Zetaris failed · fallback used"
          : "Synthetic fixture mode";
  $("conflict-count").textContent = (data.conflicts || []).length;
  $("rationale").textContent = data.rationale || "No rationale returned.";

  const state =
    decision.status === "SUPPORTED"
      ? "good"
      : decision.status === "INSUFFICIENT EVIDENCE"
        ? "bad"
        : "caution";
  document.querySelector(".decision-metric").dataset.state = state;

  // 1. Multi-Agent Pipeline Telemetry
  if (data.telemetry && Array.isArray(data.telemetry.pipeline_steps)) {
    $("pipeline-total-time").textContent = `Total Pipeline Latency: ${data.telemetry.total_duration_seconds}s`;
    $("pipeline-steps").innerHTML = data.telemetry.pipeline_steps
      .map(
        (step) => `
      <div class="pipeline-step-card ${step.status}">
        <div class="pipeline-step-header">
          <span class="step-agent">${escapeHtml(step.agent)}</span>
          <span class="step-status ${step.status}">${escapeHtml(step.status.toUpperCase())}</span>
        </div>
        <p class="step-summary">${escapeHtml(step.summary)}</p>
        <div class="step-meta">
          <span>Action: <code>${escapeHtml(step.action)}</code></span>
          <span>${step.duration_ms}ms</span>
        </div>
      </div>`
      )
      .join("");
  }

  // 2. Financial Sensitivity & Unit Economics
  const finSection = $("financial-section");
  if (data.financial_metrics) {
    finSection.classList.remove("hidden");
    const f = data.financial_metrics;
    $("fin-capex").textContent = `${f.estimated_capex.toLocaleString()} ${f.currency}`;
    $("fin-opex").textContent = `${f.estimated_opex_per_acre.toLocaleString()} ${f.currency}`;
    $("fin-yield").textContent = `${f.expected_yield_kg_per_acre.median.toLocaleString()} kg`;
    $("fin-yield-range").textContent = `${f.expected_yield_kg_per_acre.min.toLocaleString()} – ${f.expected_yield_kg_per_acre.max.toLocaleString()} kg/acre`;
    $("fin-breakeven").textContent = `${f.breakeven_price_per_kg} ${f.currency}/kg`;
    $("fin-margin").textContent = `${f.gross_margin_percent}%`;
    $("fin-margin-note").textContent = `@ ${f.benchmark_wholesale_price} ${f.currency}/kg wholesale`;
    $("fin-payback").textContent = `${f.payback_period_months} months`;
    $("fin-sensitivity-notes").textContent = f.sensitivity_notes;

    const slider = $("price-slider");
    slider.min = Math.max(5, Math.floor(f.breakeven_price_per_kg * 0.7));
    slider.max = Math.round(f.benchmark_wholesale_price * 1.5);
    slider.value = f.benchmark_wholesale_price;

    const tickBox = $("slider-ticks");
    if (tickBox) {
      const p = f.benchmark_wholesale_price;
      const be = f.breakeven_price_per_kg;
      const pLow = Math.max(5, Math.round(be * 0.85));
      const pHigh = Math.round(p * 1.35);
      tickBox.innerHTML = `
        <span>${pLow} ${f.currency} (Glut Stress)</span>
        <span>${be} ${f.currency} (Breakeven)</span>
        <span>${p} ${f.currency} (Spot Benchmark)</span>
        <span>${pHigh} ${f.currency} (Peak Premium)</span>
      `;
    }

    updateSensitivitySlider(f, Number(slider.value));

    slider.oninput = (e) => {
      updateSensitivitySlider(f, Number(e.target.value));
    };
  } else {
    finSection.classList.add("hidden");
  }

  // 3. Structured Risk Matrix
  const riskSection = $("risk-section");
  if (data.risk_matrix && data.risk_matrix.length > 0) {
    riskSection.classList.remove("hidden");
    $("risk-table-container").innerHTML = `
      <table class="risk-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Risk Factor</th>
            <th>Severity</th>
            <th>Underwriting Impact</th>
            <th>Credit Mitigation Prerequisite</th>
            <th>Evidence ID</th>
          </tr>
        </thead>
        <tbody>
          ${data.risk_matrix
            .map(
              (r) => `
            <tr>
              <td><span class="risk-category-tag">${escapeHtml(r.category)}</span></td>
              <td><strong>${escapeHtml(r.title)}</strong></td>
              <td><span class="severity-pill ${r.severity.toLowerCase()}">${escapeHtml(r.severity)}</span></td>
              <td class="risk-impact">${escapeHtml(r.impact)}</td>
              <td class="risk-mitigation">${escapeHtml(r.mitigation)}</td>
              <td><code class="evidence-ref">${escapeHtml(r.source_evidence_id || "N/A")}</code></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  } else {
    riskSection.classList.add("hidden");
  }

  // 4. Missing items & next actions
  showList("missing-list", data.missing_information);
  showList("next-list", data.next_actions);
  $("evidence-label").textContent = `${(data.evidence || []).length} records`;

  // 5. Evidence Ledger
  $("evidence-list").innerHTML =
    (data.evidence || [])
      .map(
        (e) => `
    <article class="evidence-item">
      <div class="evidence-top">
        <span class="evidence-id">${escapeHtml(e.id)}</span>
        <span class="tag ${e.synthetic ? "synthetic" : ""}">${
          e.synthetic ? "SYNTHETIC" : escapeHtml(String(e.relation || "context").toUpperCase())
        }</span>
      </div>
      <h4>${escapeHtml(e.title)}</h4>
      <p>${escapeHtml(e.detail)}</p>
      <div class="source-meta">${escapeHtml(e.source_name)} · ${escapeHtml(
          e.provenance_status || "provenance unknown"
        )}${e.observed_at ? ` · observed ${escapeHtml(e.observed_at)}` : ""}</div>
      ${(e.quality_flags || []).map((f) => `<p class="subtle">⚑ ${escapeHtml(f)}</p>`).join("")}
      ${
        safeHttpUrl(e.source_url)
          ? `<a href="${escapeHtml(safeHttpUrl(e.source_url))}" target="_blank" rel="noopener noreferrer">Open source ↗</a>`
          : ""
      }
    </article>`
      )
      .join("") || "<p class='subtle'>No evidence records were returned.</p>";

  // 6. Conflicts Box
  $("conflicts").innerHTML = (data.conflicts || [])
    .map(
      (c) => `
    <div class="conflict-box">
      <strong>Conflict · ${escapeHtml(c.topic)}</strong>
      ${escapeHtml(c.explanation)}<br>
      <small>Evidence: ${escapeHtml((c.evidence_ids || []).join(", "))}</small>
    </div>`
    )
    .join("");

  // 7. Warnings Box
  $("warnings").innerHTML = (data.warnings || [])
    .map((w) => `<div class="warning-item">! ${escapeHtml(w)}</div>`)
    .join("");

  notice.classList.toggle("hidden", !(data.warnings || []).length);
  notice.textContent = (data.warnings || []).join(" ");

  if (data.trace_log_path) {
    $("export-trace-path").textContent = `Audit trace: ${data.trace_log_path}`;
  }
}

// Export Handlers
$("export-md-btn").addEventListener("click", () => {
  if (!currentInvestigationData?.id) return;
  window.open(`/api/investigations/${encodeURIComponent(currentInvestigationData.id)}/export?format=markdown`, "_blank");
});

$("export-json-btn").addEventListener("click", () => {
  if (!currentInvestigationData?.id) return;
  window.open(`/api/investigations/${encodeURIComponent(currentInvestigationData.id)}/export?format=json`, "_blank");
});

async function refreshHistory() {
  const host = $("history-list");
  try {
    const response = await fetch("/api/investigations");
    const payload = await response.json();
    const items = payload.investigations || [];
    host.innerHTML = items.length
      ? items
          .slice(0, 8)
          .map(
            (item) => `
        <div class="history-row">
          <div>
            <strong>${escapeHtml(item.question)}</strong>
            <small>${escapeHtml(item.location)} · ${escapeHtml(item.decision?.status || item.status)} (Score: ${item.decision?.score ?? 0}/100) · ${escapeHtml(
              new Date(item.created_at).toLocaleString()
            )}</small>
          </div>
          <button type="button" data-investigation-id="${escapeHtml(item.id)}">Open dossier</button>
        </div>`
          )
          .join("")
      : "<p class='subtle'>No investigations saved yet.</p>";
  } catch {
    host.innerHTML = "<p class='subtle'>Investigation history is unavailable.</p>";
  }
}

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "Investigating Opportunity…";
  notice.classList.add("hidden");
  try {
    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question.value,
        location: $("location").value,
        crop_or_activity: $("crop").value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Investigation failed.");
    render(data);
    await refreshHistory();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    notice.classList.remove("hidden");
    notice.textContent = error.message || "Could not run investigation.";
  } finally {
    button.disabled = false;
    button.innerHTML = 'Investigate Opportunity <span aria-hidden="true">↗</span>';
  }
});

$("refresh-history").addEventListener("click", refreshHistory);
$("history-list").addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-investigation-id]");
  if (!target) return;
  try {
    const response = await fetch(`/api/investigations/${encodeURIComponent(target.dataset.investigationId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    render(data);
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    notice.classList.remove("hidden");
    notice.textContent = error.message || "Could not load investigation.";
  }
});

refreshHealth();
refreshHistory();
