export interface ModelAnswer {
  text: string;
  mode: "meterless-runtime" | "deterministic-fallback";
  model?: string;
  warning?: string;
}

export async function reasonWithMeterless(
  question: string,
  evidence: unknown[],
  memoryContext: string
): Promise<ModelAnswer> {
  const isSampleMode = process.env.SAMPLE_MODE === "true";
  const base = process.env.METERLESS_BASE_URL?.trim().replace(/\/+$/, "");
  const token = (process.env.METERLESS_RUNTIME_TOKEN || process.env.METERLESS_API_KEY)?.trim();
  const model = process.env.METERLESS_MODEL?.trim() || "nvidia/nemotron-3-super-120b-a12b";

  if (isSampleMode || !base || !token) {
    return {
      text: "",
      mode: "deterministic-fallback",
      model: `${model} (fallback)`,
      warning: isSampleMode
        ? `Running in SAMPLE_MODE; deterministic synthesis applied for target model ${model}.`
        : `Meterless Nightshift credentials not configured; used deterministic synthesis for ${model}.`
    };
  }

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return {
      text: "",
      mode: "deterministic-fallback",
      model,
      warning: "METERLESS_BASE_URL is not a valid URL; deterministic synthesis used."
    };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      text: "",
      mode: "deterministic-fallback",
      model,
      warning: "Meterless endpoint must use HTTP or HTTPS."
    };
  }

  const prompt = `Decision question: ${question}

Prior H-MEM memory context (provenance note: internal recall, not external citation):
${memoryContext || "(no prior memories in ledger)"}

Evidence records retrieved from data layer (strictly ground all claims here):
${JSON.stringify(evidence, null, 2)}

Provide an evidence-based assessment. Return ONLY a single valid JSON object with these keys:
- "rationale": Clear summary synthesizing the evidence, citing evidence IDs like [zetaris-kiri-001].
- "missing_information": String array of specific data points still needed before committing capital.
- "next_actions": String array of immediate due-diligence steps the entrepreneur should take.
Do not invent facts, numbers, or external URLs.`;

  try {
    const timeout = Math.max(1000, Number(process.env.METERLESS_TIMEOUT_MS || 25000));
    const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "meterless-app": process.env.METERLESS_APP || "nexus-evidence",
        "meterless-scope": process.env.METERLESS_SCOPE || "user"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are Nexus, an evidence-first agribusiness decision intelligence agent powered by NVIDIA Nemotron. Base every claim on supplied evidence. Prefer uncertainty over unsupported optimism. Output valid JSON only."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1200,
        stream: false
      }),
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      return {
        text: "",
        mode: "deterministic-fallback",
        model,
        warning: `Meterless Nightshift returned HTTP ${response.status}; fell back to deterministic synthesis.`
      };
    }

    const payload: unknown = await response.json();
    const content = (payload as any)?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return {
        text: "",
        mode: "deterministic-fallback",
        model,
        warning: "Meterless Nightshift returned an empty message; fell back to deterministic synthesis."
      };
    }

    return {
      text: content,
      mode: "meterless-runtime",
      model
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inference error";
    return {
      text: "",
      mode: "deterministic-fallback",
      model,
      warning: `Meterless Nightshift request failed (${message}); fell back to deterministic synthesis.`
    };
  }
}
