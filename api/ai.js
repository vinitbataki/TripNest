const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });

  const prompt = req.body && req.body.prompt;
  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Bad prompt" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error("Anthropic error", r.status, JSON.stringify(j));
      return res.status(502).json({ error: (j.error && j.error.message) || "Anthropic request failed", status: r.status, model: MODEL });
    }
    const blocks = Array.isArray(j.content) ? j.content : [];
    const text = blocks.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    if (!text) {
      return res.status(502).json({ error: "Empty reply from model", stop_reason: j.stop_reason, block_types: blocks.map((c) => c.type), model: MODEL });
    }
    return res.status(200).json({ text });
  } catch (e) {
    console.error("AI function crashed", e);
    return res.status(502).json({ error: String(e) });
  }
};
