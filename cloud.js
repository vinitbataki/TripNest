// Cloud layer: Supabase (auth + shared trips), photo/place proxies, weather, map, currency.
(function () {
  const C = window.TRIPNEST || {};
  const sb = C.SUPABASE_URL && window.supabase ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  const J = async (u) => { const r = await fetch(u); if (!r.ok) throw 0; return r.json(); };
  const O = { signup, login, reset, logout, changePw, joinCode, doDel, leave, saveProfile, pickAv, doDelAcct, sr, render };
  const persist = () => { try { localStorage.setItem("tripnest", JSON.stringify(S)); } catch (e) {} };

  /* ---------- Photos: Unsplash/Pexels via /api/photo, Wikipedia fallback ---------- */
  const PH = {};
  window.photo = async (n) => {
    if (n in PH) return PH[n];
    try { const a = await J("/api/photo?q=" + encodeURIComponent(n)); if (a.photos && a.photos.length) return (PH[n] = a.photos[0]); } catch (e) {}
    try { const j = await J("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(n)); const u = j.thumbnail && j.thumbnail.source; return (PH[n] = u ? u.replace(/\/\d+px-/, "/800px-") : null); } catch (e) { return (PH[n] = null); }
  };
  window.photos = async (n) => {
    try { const a = await J("/api/photo?q=" + encodeURIComponent(n)); if (a.photos && a.photos.length) return a.photos.slice(0, 6); } catch (e) {}
    try { const j = await J("https://en.wikipedia.org/api/rest_v1/page/media-list/" + encodeURIComponent(n)); return (j.items || []).filter((x) => x.type == "image" && x.srcset && x.srcset.length).slice(0, 6).map((x) => "https:" + x.srcset[0].src); } catch (e) { return []; }
  };

  /* ---------- Worldwide place search via /api/places ---------- */
  let pt;
  window.sr = function () {
    O.sr(); clearTimeout(pt);
    const q = V.q.trim(); if (q.length < 3) return;
    pt = setTimeout(async () => {
      try {
        const a = await J("/api/places?q=" + encodeURIComponent(q)), box = $("#res");
        if (!box || V.q.trim() != q || !a.places || !a.places.length) return;
        box.insertAdjacentHTML("beforeend", `<h3>🌍 More places</h3><div class="grid">${a.places.map((p, i) => destCard([String(p.name).replace(/'/g, "’"), p.country || "", "📍", "#1f2a44", "#7a1f2b", p.label || ""], i)).join("")}</div>`);
        loadPhotos();
      } catch (e) {}
    }, 400);
  };

  /* ---------- Weather (Open-Meteo), map (Leaflet/OSM), currency (Frankfurter) ---------- */
  const GC = {};
  const geo = async (n) => { if (n in GC) return GC[n]; try { const j = await J("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(n)); return (GC[n] = (j.results || [])[0] || null); } catch (e) { return (GC[n] = null); } };
  async function extras() {
    if (V.page != "trip") return; const t = trip(); if (!t) return;
    const g = await geo(t.dest); if (!g || V.page != "trip" || V.trip != t.id) return;
    const hero = document.querySelector(".hero"), wrap = document.querySelector(".wrap");
    if (hero && !hero.querySelector(".wx")) {
      try { const w = await J(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
        if (!hero.querySelector(".wx")) hero.insertAdjacentHTML("beforeend", `<div class="wx" style="margin-top:8px">🌡 ${Math.round(w.current.temperature_2m)}°C now · ${Math.round(w.daily.temperature_2m_min[0])}–${Math.round(w.daily.temperature_2m_max[0])}°C today</div>`); } catch (e) {}
    }
    if (V.tt == "plan" && window.L && wrap && !$("#map")) {
      wrap.insertAdjacentHTML("beforeend", '<div id="map" style="height:240px;border-radius:16px;margin-top:16px"></div>');
      const m = L.map("map").setView([g.latitude, g.longitude], 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(m);
      L.marker([g.latitude, g.longitude]).addTo(m);
    }
    if (V.tt == "exp" && wrap && !$("#fx")) {
      const tot = t.exp.reduce((a, e) => a + e.amt, 0);
      if (tot > 0) try { const j = await J("https://api.frankfurter.app/latest?from=INR&to=USD,EUR");
        if (V.tt == "exp" && !$("#fx")) document.querySelector(".wrap").insertAdjacentHTML("beforeend", `<p id="fx" class="mu">≈ $${(tot * j.rates.USD).toFixed(2)} · €${(tot * j.rates.EUR).toFixed(2)} (Frankfurter rates)</p>`); } catch (e) {}
    }
  }
  window.render = function () { O.render(); extras(); };

  if (!sb) return; // everything below needs Supabase

  /* ---------- Supabase: auth, profile, shared trips ---------- */
  let last = "", dirty = false, pushT;
  const upProfile = () => { const u = me(); if (u) sb.from("profiles").upsert({ id: u.id, name: u.name, city: u.city || null, bio: u.bio || null, av: u.av || 0 }); };
  async function enter(user, silent) {
    const { data: p } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let x = S.users.find((a) => a.id == user.id);
    if (!x) { x = { id: user.id, pw: "" }; S.users.push(x); }
    Object.assign(x, { email: user.email, name: (p && p.name) || x.name || (user.user_metadata && user.user_metadata.name) || user.email.split("@")[0], city: (p && p.city) || x.city, bio: (p && p.bio) || x.bio, av: p ? p.av : x.av || 0 });
    S.me = user.id; S.trips = []; last = ""; persist();
    await pull(true);
    if (!silent) afterAuth();
  }
  async function pull(force) {
    if (!S.me || dirty) return;
    const { data, error } = await sb.from("trips").select("data");
    if (error || !data) return;
    const ts = data.map((r) => r.data), k = JSON.stringify(ts);
    if (k == last && !force) return;
    last = k; S.trips = ts; persist();
    if (!force && !document.querySelector(".modal") && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) render();
  }
  window.cloudPush = () => {
    if (!S.me) return; dirty = true; clearTimeout(pushT);
    pushT = setTimeout(async () => {
      for (const t of mine()) {
        const row = { data: t, updated_at: new Date().toISOString() };
        if (t.owner == S.me) await sb.from("trips").upsert({ id: t.id, code: t.code, owner: t.owner, ...row });
        else await sb.from("trips").update(row).eq("id", t.id);
      }
      dirty = false; last = JSON.stringify(S.trips.filter((t) => t.members.some((m) => m.id == S.me)));
    }, 500);
  };
  const val = (id) => ($(id) ? $(id).value : "");
  window.signup = async () => {
    const n = val("#n").trim(), e = val("#e").trim().toLowerCase(), p = val("#p");
    if (!n || !e.includes("@") || p.length < 6) return toast("Enter name, valid email and 6+ char password");
    const { data, error } = await sb.auth.signUp({ email: e, password: p, options: { data: { name: n } } });
    if (error) return toast(error.message);
    if (!data.session) return toast("Check your email to confirm, then sign in");
    await sb.from("profiles").upsert({ id: data.user.id, name: n }); enter(data.user);
  };
  window.login = async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: val("#e").trim().toLowerCase(), password: val("#p") });
    if (error) return toast("Wrong email or password"); enter(data.user);
  };
  window.reset = async () => {
    const { error } = await sb.auth.resetPasswordForEmail(val("#e").trim().toLowerCase(), { redirectTo: location.origin + location.pathname });
    if (error) return toast(error.message); toast("Reset link sent. Check your email"); go("auth", { mode: "in" });
  };
  window.setNewPw = async () => {
    const p = val("#rp"); if (p.length < 6) return toast("6+ characters please");
    const { error } = await sb.auth.updateUser({ password: p }); if (error) return toast(error.message);
    closeM(); toast("Password updated ✓");
  };
  window.logout = async () => { await sb.auth.signOut(); S.trips = []; O.logout(); };
  window.changePw = async () => {
    const u = me(), n = val("#np");
    const { error } = await sb.auth.signInWithPassword({ email: u.email, password: val("#cp") });
    if (error) return toast("Current password is wrong"); if (n.length < 6) return toast("New password needs 6+ characters");
    const r = await sb.auth.updateUser({ password: n }); if (r.error) return toast(r.error.message);
    $("#cp").value = $("#np").value = ""; toast("Password changed ✓");
  };
  window.saveProfile = () => { O.saveProfile(); upProfile(); };
  window.pickAv = (i) => { O.pickAv(i); upProfile(); };
  window.joinCode = async (c) => {
    const { data, error } = await sb.rpc("join_trip", { p_code: c });
    if (error || !data || !data.id) { toast("Invalid trip code"); return go("home"); }
    await pull(true); toast("Joined " + data.data.name + " 🎉"); go("trip", { trip: data.id, tt: "plan" });
  };
  window.doDel = async (id) => { const t = S.trips.find((x) => x.id == id); O.doDel(id); if (t && t.owner == S.me) await sb.from("trips").delete().eq("id", id); };
  window.leave = async (id) => {
    const t = S.trips.find((x) => x.id == id); O.leave(id);
    if (t) { await sb.from("trips").update({ data: t }).eq("id", id); await sb.from("trip_members").delete().eq("trip_id", id).eq("user_id", S.me); }
    pull(true);
  };
  window.doDelAcct = async () => {
    const id = S.me;
    for (const t of S.trips.filter((t) => t.owner == id && t.members.length < 2)) await sb.from("trips").delete().eq("id", t.id);
    await sb.from("trip_members").delete().eq("user_id", id); await sb.from("profiles").delete().eq("id", id);
    await sb.auth.signOut(); O.doDelAcct();
  };
  sb.auth.onAuthStateChange((ev) => {
    if (ev == "PASSWORD_RECOVERY") modal(`<h2 style="margin-top:0">Set a new password</h2><input id="rp" type="password" autocomplete="new-password"><div class="row"><button class="btn" onclick="setNewPw()">Save</button></div>`);
  });
  window.cloudBoot = async () => {
    load();
    const { data } = await sb.auth.getSession(), u = data.session && data.session.user;
    if (u) await enter(u, true); else { S.me = null; S.trips = []; V.page = "auth"; }
    const m = location.hash.match(/join-(\d{6})/);
    if (u && m) { window.joinCode(m[1]); history.replaceState(null, "", location.pathname); }
    else { if (u) V.page = "home"; render(); }
  };
  setInterval(() => pull(), 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
})();
