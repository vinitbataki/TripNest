const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const json = (code, obj) => ({
  statusCode: code,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY is not set on the server" });

  let prompt = "";
  try { prompt = JSON.parse((event.body || "{}").replace(/^\uFEFF/, "")).prompt; } catch (e) {}
  if (!prompt || prompt.length > 2000) return json(400, { error: "Bad prompt" });

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
      return json(502, { error: (j.error && j.error.message) || "Anthropic request failed", status: r.status, model: MODEL });
    }
    const blocks = Array.isArray(j.content) ? j.content : [];
    const text = blocks.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    if (!text) {
      console.error("Empty AI reply", JSON.stringify(j).slice(0, 500));
      return json(502, { error: "Empty reply from model", stop_reason: j.stop_reason, block_types: blocks.map((c) => c.type), model: MODEL });
    }
    return json(200, { text });
  } catch (e) {
    console.error("AI function crashed", e);
    return json(502, { error: String(e) });
  }
};