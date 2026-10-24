const $ = (id) => document.getElementById(id);
const button = $("run-button");
const question = $("question");
const notice = $("notice");
const results = $("results");

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

function render(data) {
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
        ? "Verified agricultural dataset (Sample mode)"
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

  showList("missing-list", data.missing_information);
  showList("next-list", data.next_actions);
  $("evidence-label").textContent = `${(data.evidence || []).length} records`;

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

  $("warnings").innerHTML = (data.warnings || [])
    .map((w) => `<div class="warning-item">! ${escapeHtml(w)}</div>`)
    .join("");

  notice.classList.toggle("hidden", !(data.warnings || []).length);
  notice.textContent = (data.warnings || []).join(" ");
}

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
            <small>${escapeHtml(item.location)} · ${escapeHtml(item.decision?.status || item.status)} · ${escapeHtml(
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
  button.textContent = "Investigating…";
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
    button.innerHTML = 'Investigate <span aria-hidden="true">↗</span>';
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
