// Netlify serverless function for AI endpoint using NVIDIA API exclusively.
const NVIDIA_MODELS = [
  process.env.NVIDIA_MODEL,
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "minimaxai/minimax-m3.1-flash",
  "mistralai/mistral-large-4-1t-a52b",
  "fastino/gliner2-pii",
].filter(Boolean);

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
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "content-type": "application/json",
      },
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.NVIDIA_API_KEY) return json(500, { error: "NVIDIA_API_KEY is not set on the server" });

  let prompt = "";
  try { prompt = JSON.parse((event.body || "{}").replace(/^\uFEFF/, "")).prompt; } catch (e) {}
  if (!prompt || prompt.length > 2000) return json(400, { error: "Bad prompt" });

  try {
    const result = await viaNvidia(prompt);
    return json(200, result);
  } catch (e) {
    console.error("NVIDIA AI failed:", e.message || e);
    return json(502, { error: e.message || String(e) });
  }
};
