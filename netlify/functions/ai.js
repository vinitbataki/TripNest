// Netlify serverless function for AI endpoint.
// Providers tried in order: NVIDIA (NVIDIA_API_KEY), Gemini (GEMINI_API_KEY), Claude (ANTHROPIC_API_KEY).
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const NVIDIA_MODELS = [
  process.env.NVIDIA_MODEL,
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "minimaxai/minimax-m3.1-flash",
  "mistralai/mistral-large-4-1t-a52b",
  "fastino/gliner2-pii",
].filter(Boolean);
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"].filter(Boolean);

const json = (code, obj) => ({
  statusCode: code,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj),
});

async function viaNvidia(prompt) {
  let last = "NVIDIA request failed";
  for (const model of NVIDIA_MODELS) {
    const isGliner = model.includes("gliner");
    const payload = {
      model,
      messages: [{ role: "user", content: prompt }],
      ...(isGliner
        ? { labels: ["person", "location", "organization", "date", "email", "phone_number"], threshold: 0.3 }
        : { temperature: 0.2, top_p: 0.7, max_tokens: 3000 }),
    };

    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.NVIDIA_API_KEY, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const choice = j.choices && j.choices[0];
      const text = (choice && choice.message && (choice.message.content || choice.message.reasoning_content)) || "";
      if (text) return { text, model };
      last = "Empty reply from " + model;
    } else {
      last = model + ": " + ((j.error && j.error.message) || j.detail || j.title || r.status);
      if (r.status === 401 || r.status === 403) break;
    }
  }
  throw new Error(last);
}

async function viaGemini(prompt) {
  let last = "Gemini request failed";
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8192 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      const text = parts.map((p) => p.text || "").join("");
      if (text) return { text, model };
      last = "Empty reply from " + model;
    } else {
      last = model + ": " + ((j.error && j.error.message) || r.status);
    }
  }
  throw new Error(last);
}

async function viaClaude(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Claude: " + ((j.error && j.error.message) || r.status));
  const text = (Array.isArray(j.content) ? j.content : []).filter((c) => c.type === "text").map((c) => c.text || "").join("");
  if (!text) throw new Error("Claude: empty reply");
  return { text, model: CLAUDE_MODEL };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  let prompt = "";
  try { prompt = JSON.parse((event.body || "{}").replace(/^\uFEFF/, "")).prompt; } catch (e) {}
  if (!prompt || prompt.length > 2000) return json(400, { error: "Bad prompt" });

  const errors = [];
  if (process.env.NVIDIA_API_KEY) {
    try { return json(200, await viaNvidia(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return json(200, await viaGemini(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try { return json(200, await viaClaude(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }

  if (!errors.length) return json(500, { error: "No AI key set. Add NVIDIA_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY." });
  console.error("AI failed:", errors.join(" | "));
  return json(502, { error: errors.join(" | ") });
};
