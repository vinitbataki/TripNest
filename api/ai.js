// AI endpoint. Providers are tried in this order if their key is set:
// NVIDIA (NVIDIA_API_KEY), Google Gemini (GEMINI_API_KEY), Claude (ANTHROPIC_API_KEY).
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const NVIDIA_MODELS = [process.env.NVIDIA_MODEL, "meta/llama-3.3-70b-instruct", "meta/llama-3.1-70b-instruct", "meta/llama-3.1-8b-instruct"].filter(Boolean);
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"].filter(Boolean);

async function viaNvidia(prompt) {
  let last = "NVIDIA request failed";
  for (const model of NVIDIA_MODELS) {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.NVIDIA_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2, top_p: 0.7, max_tokens: 3000, stream: false }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
      if (text) return { text, model };
      last = "Empty reply from " + model;
    } else {
      last = model + ": " + ((j.error && j.error.message) || j.detail || j.title || r.status);
      if (r.status === 401 || r.status === 403) break; // key problem: other models will fail the same way
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

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const prompt = req.body && req.body.prompt;
  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Bad prompt" });

  const errors = [];
  if (process.env.NVIDIA_API_KEY) {
    try { return res.status(200).json(await viaNvidia(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return res.status(200).json(await viaGemini(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try { return res.status(200).json(await viaClaude(prompt)); } catch (e) { errors.push(String(e.message || e)); }
  }
  if (!errors.length) return res.status(500).json({ error: "No AI key set. Add NVIDIA_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY." });
  console.error("AI failed:", errors.join(" | "));
  return res.status(502).json({ error: errors.join(" | ") });
};
