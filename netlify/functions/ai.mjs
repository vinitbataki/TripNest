import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let prompt = "";
  try { prompt = (await req.json()).prompt; } catch (e) {}
  if (!prompt || typeof prompt !== "string" || prompt.length > 2000) return new Response("Bad prompt", { status: 400 });

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (message.content || []).map((c) => c.text || "").join("");
    return Response.json({ text });
  } catch (e) {
    return Response.json({ text: "" }, { status: 502 });
  }
};
