const enc = encodeURIComponent;
async function photo(q) {
  const U = process.env.UNSPLASH_ACCESS_KEY, P = process.env.PEXELS_API_KEY;
  if (U) {
    const r = await fetch(`https://api.unsplash.com/search/photos?per_page=6&orientation=landscape&query=${enc(q + " travel")}&client_id=${U}`);
    if (r.ok) { const photos = (await r.json()).results.map((x) => x.urls.regular); if (photos.length) return { photos }; }
  }
  if (P) {
    const r = await fetch(`https://api.pexels.com/v1/search?per_page=6&orientation=landscape&query=${enc(q + " travel")}`, { headers: { Authorization: P } });
    if (r.ok) { const photos = (await r.json()).photos.map((x) => x.src.large); if (photos.length) return { photos }; }
  }
  return { photos: [] };
}
async function places(q) {
  const G = process.env.GEOAPIFY_API_KEY;
  if (G) {
    const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?limit=6&type=city&text=${enc(q)}&apiKey=${G}`);
    if (r.ok) return { places: (await r.json()).features.map((f) => ({ name: f.properties.city || f.properties.name, country: f.properties.country, label: f.properties.formatted })) };
  }
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&q=${enc(q)}`, { headers: { "User-Agent": "TripNest/1.0" } });
  const j = r.ok ? await r.json() : [];
  return { places: j.map((x) => ({ name: x.name || x.display_name.split(",")[0], country: x.address && x.address.country, label: x.display_name })) };
}
const H = { "content-type": "application/json", "cache-control": "public, max-age=86400" };
const nl = (fn) => async (e) => {
  const q = (e.queryStringParameters || {}).q;
  if (!q || q.length > 80) return { statusCode: 400, body: "{}" };
  try { return { statusCode: 200, headers: H, body: JSON.stringify(await fn(q)) }; } catch (x) { return { statusCode: 502, body: "{}" }; }
};
const vc = (fn) => async (req, res) => {
  const q = req.query.q;
  if (!q || q.length > 80) return res.status(400).json({});
  try { res.setHeader("Cache-Control", "s-maxage=86400"); res.json(await fn(q)); } catch (x) { res.status(502).json({}); }
};
module.exports = { photo, places, nl, vc };
