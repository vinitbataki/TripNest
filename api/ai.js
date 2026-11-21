// AI endpoint powered by Google Gemini (free tier via Google AI Studio).
// Needs the environment variable GEMINI_API_KEY. GEMINI_MODEL is optional.
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"].filter(Boolean);

async function askGemini(prompt) {
  let last = "Gemini request failed";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
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

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server" });
  const prompt = req.body && req.body.prompt;
  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Bad prompt" });
  try {
    return res.status(200).json(await askGemini(prompt));
  } catch (e) {
    console.error("AI failed:", e.message || e);
    return res.status(502).json({ error: String(e.message || e) });
  }
};
