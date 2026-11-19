const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
async function ask(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json();
  return { ok: r.ok, text: (j.content || []).map((c) => c.text || "").join("") };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const prompt = req.body && req.body.prompt;
  if (!prompt || prompt.length > 2000) return res.status(400).send("Bad prompt");
  const { ok, text } = await ask(prompt);
  res.status(ok ? 200 : 502).json({ text });
};
