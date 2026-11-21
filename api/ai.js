// AI endpoint using NVIDIA API exclusively.
const NVIDIA_MODELS = [
  process.env.NVIDIA_MODEL,
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "minimaxai/minimax-m3.1-flash",
  "mistralai/mistral-large-4-1t-a52b",
  "fastino/gliner2-pii",
].filter(Boolean);

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

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!process.env.NVIDIA_API_KEY) return res.status(500).json({ error: "NVIDIA_API_KEY is not set on the server" });

  const prompt = req.body && req.body.prompt;
  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Bad prompt" });

  try {
    const result = await viaNvidia(prompt);
    return res.status(200).json(result);
  } catch (e) {
    console.error("NVIDIA AI failed:", e.message || e);
    return res.status(502).json({ error: e.message || String(e) });
  }
};
