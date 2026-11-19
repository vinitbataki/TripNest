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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  let prompt = "";
  try { prompt = JSON.parse(event.body || "{}").prompt; } catch (e) {}
  if (!prompt || prompt.length > 2000) return { statusCode: 400, body: "Bad prompt" };
  const { ok, text } = await ask(prompt);
  return { statusCode: ok ? 200 : 502, headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) };
};
