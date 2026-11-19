# TripNest ✈️

AI itineraries, destination photos, worldwide place search, expense splitting, shared trips (join code or link), profiles, weather, map and currency conversion.

## 1. Accounts and shared trips (Supabase)
1. Create a free project at supabase.com.
2. SQL Editor > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the **Project URL** and **anon public key** into `config.js`.
4. Authentication > URL Configuration: set Site URL to your deployed address (and `http://localhost:8888` for local testing). Password reset emails use this.
5. Optional while testing: Authentication > Providers > Email > turn off "Confirm email".

Leave `config.js` empty and the app runs in local-only mode (data stays in the browser).

## 2. Server keys (never put these in index.html)
Copy `.env.example` to `.env` (local) and add the same names as environment variables on your host.

| Variable | Used for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI itinerary and travel facts (`/api/ai`) | console.anthropic.com |
| `UNSPLASH_ACCESS_KEY` | Destination photos (`/api/photo`) | unsplash.com/developers |
| `PEXELS_API_KEY` | Photo fallback | pexels.com/api |
| `GEOAPIFY_API_KEY` | Worldwide place search (`/api/places`) | geoapify.com |

Each is optional. Without them: template itineraries, Wikipedia photos, and OpenStreetMap Nominatim search. Unsplash requires crediting photographers when you go to production.

No key needed: Open-Meteo (weather), Leaflet + OpenStreetMap (map), Frankfurter (currency).

## 3. Run locally
`npm run dev` (Netlify CLI, opens http://localhost:8888, serves `/api/*`). Live Server also works for the front end only.

## 4. Deploy
**Netlify:** push to GitHub > Add new site > Import from Git > add the environment variables > Deploy.
**Vercel:** import the repo > add the environment variables > Deploy (`/api/*` files are picked up automatically).
GitHub Pages works for the front end only (no AI/photo/place proxies).

## Notes
- Trips sync by polling every 5 seconds; edits use last-write-wins. For true real-time, swap polling for Supabase Realtime.
- Deleting an account removes the profile and your trips, but the login record itself needs an admin delete in the Supabase dashboard.
