TripNest ✈️
TripNest is a collaborative travel-planning web app for creating trips, exploring destinations, generating AI itineraries, sharing trips, and splitting expenses.

Live demo: https://tripnest-ecru.vercel.app

Features
🔐 Email/password authentication
🧳 Create, edit, and delete trips
👥 Invite friends using a six-digit trip code or join link
✨ Generate AI-powered itineraries
🌍 Search destinations worldwide
📷 Browse destination photos
🗓️ Build a daily travel plan
💸 Add shared expenses and calculate settlements
🌡️ View destination weather
🗺️ Display destinations on an OpenStreetMap map
💱 Convert expense totals from INR to USD and EUR
👤 Manage profiles, avatars, and passwords
❤️ Save favourite destinations
🌙 Automatic and manual light/dark themes
☁️ Optional cloud synchronization with Supabase
💾 Fully usable local-only mode
Tech Stack
HTML5, CSS, and vanilla JavaScript
Leaflet and OpenStreetMap
Supabase Auth and PostgreSQL
Google Gemini API
Unsplash and Pexels APIs
Geoapify or OpenStreetMap Nominatim
Open-Meteo
Frankfurter currency API
Vercel or Netlify serverless functions
Project Structure
Text
TripNest/
├── index.html          # Main application UI and local application logic
├── cloud.js            # Supabase, cloud sync, weather, maps, photos, and search
├── config.js           # Browser-side Supabase configuration
├── api/                # Vercel serverless functions
│   ├── ai.js
│   ├── photo.js
│   └── places.js
├── lib/
│   └── handlers.js     # Shared photo and place search handlers
├── netlify/
│   └── functions/      # Netlify serverless function implementations
├── supabase/
│   └── schema.sql      # Database tables, policies, and join-trip function
├── .env.example        # Optional server-side API key examples
├── package.json        # Local development and deployment scripts
├── vercel.json         # Vercel configuration
└── netlify.toml        # Netlify build and API redirects
How It Works
TripNest has two storage modes:

Local mode: When Supabase configuration is empty, data is stored in the browser's localStorage.
Cloud mode: When Supabase is configured, authentication, profiles, and shared trips are synchronized through Supabase.
Cloud-backed trips are pulled from Supabase periodically and uploaded after edits. Members can join using a six-digit code or a #join-CODE link.

Local Setup
1. Clone the repository
bash
git clone https://github.com/vinitbataki/TripNest.git
cd TripNest
2. Start locally with Netlify
bash
npm install
npm run dev
Open:

Text
http://localhost:8888
The Netlify development server provides both the static application and /api/* routes.

For Vercel:

bash
npm run dev:vercel
Supabase Setup
Supabase is optional. Without valid configuration, TripNest automatically remains in local-only mode.

1. Create a Supabase project
Create a project at https://supabase.com.

2. Create the database objects
Open the Supabase SQL Editor, paste the contents of:

Text
supabase/schema.sql
and run the query.

This creates:

profiles
trips
trip_members
Row Level Security policies
An owner membership trigger
The join_trip RPC function
3. Configure the browser
Update config.js:

JavaScript
window.TRIPNEST = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"
};
For local-only mode, leave the values empty:

JavaScript
window.TRIPNEST = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
Only the Supabase publishable/anon key belongs in this browser configuration. Never expose a Supabase service-role key.

4. Configure authentication URLs
In the Supabase dashboard, open:

Text
Authentication → URL Configuration
Set the Site URL to your deployed application URL and add local development when required:

Text
http://localhost:8888
For testing, email confirmation may be disabled in:

Text
Authentication → Providers → Email
Server-Side API Keys
API keys are optional and should be stored only as environment variables. Never place private keys in index.html, config.js, or another browser-side file.

Copy .env.example to .env for local Netlify use:

bash
cp .env.example .env
Available variables:

Variable	Purpose
GEMINI_API_KEY	AI itineraries and destination information
GEMINI_MODEL	Optional Gemini model override
UNSPLASH_ACCESS_KEY	Unsplash destination photos
PEXELS_API_KEY	Pexels photo fallback
GEOAPIFY_API_KEY	Worldwide place search
Add the same variables to the environment settings in Netlify or Vercel when deploying.

Optional API fallbacks
Without server API keys, TripNest uses:

Template itineraries
Wikipedia photos
OpenStreetMap Nominatim place search
Open-Meteo, Leaflet, OpenStreetMap, and Frankfurter can be used without API keys.

Deployment
Netlify
Push the repository to GitHub.
Import the repository in Netlify.
Add the server-side environment variables.
Deploy the site.
Netlify configuration is provided in netlify.toml.

Vercel
Import the repository in Vercel.
Add the server-side environment variables.
Deploy the project.
Vercel serverless functions are located in the api/ directory.

GitHub Pages
GitHub Pages can host the frontend, but /api/* serverless routes are not available. AI generation, private photo access, and Geoapify place proxies therefore require Netlify or Vercel.

Development Notes
Supabase data synchronization currently uses polling every five seconds.
Trip updates use last-write-wins behavior.
Unsplash images require appropriate attribution when used in production.
Supabase account deletion removes TripNest profiles and trip membership data, but account deletion from the Supabase Dashboard may be required for the authentication record.
The local and Supabase implementations maintain separate authentication behavior, so cloud mode should be used for shared trips.
Language Composition
HTML — 61.1%
JavaScript — 33.6%
PLpgSQL — 5.3%
License
No license has been specified for this project.

Code
