const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

async function ask(prompt) {
  const r = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, text: (j.content || []).map((c) => c.text || "").join("") };
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let prompt = "";
  try { prompt = (await req.json()).prompt; } catch (e) {}
  if (!prompt || typeof prompt !== "string" || prompt.length > 2000) return new Response("Bad prompt", { status: 400 });
  const { ok, text } = await ask(prompt);
  return Response.json({ text }, { status: ok ? 200 : 502 });
};
