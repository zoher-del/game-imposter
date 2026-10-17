# AFTERHOURS — Imposter Game

A Vite + React starter for a dark, adult-party-themed secret-word game. Host it free on GitHub Pages and use Supabase for shared room data and realtime updates.

## Included in this starter
- Responsive dark/nightlife UI
- Saved member roster in the browser: add, remove, reset, reload persistence
- 3–100 player capacity control and imposter count validation
- Default categories plus add/remove/toggle custom categories
- Room creation, room codes, invite-link copy, join-by-code UI
- Realtime room/player list refresh using Supabase
- Reveal, voting and tally UI flow
- Optional image mode for civilian word cards

## Important honesty about this starter
This is a **starter**, not a launch-ready, secure multiplayer game. The demo currently has known gaps:
- Saved-roster preloading and room capacity need server-side atomic enforcement to avoid race conditions.
- Secret roles/word assignments and votes are not yet safely persisted per authenticated player. The reveal flow is a pass-the-device demo, not a secure per-player reveal.
- The image uses a generic Unsplash source and may not match the secret word.
- The database SQL contains permissive development RLS policies. **Do not launch this publicly with real players until replaced by secure RPC/Edge Functions and tested policies.**
- Sound, video and fully synchronized clue/result phases still need implementation.
- Public anonymous inserts can be abused without rate limiting and host authorization.

The right next step for a production version is Supabase Auth anonymous sessions plus Edge Functions/RPCs for create/join/start/reveal/vote/results. Never store every player's secret role or the word in a publicly readable room row.

## 1. Create Supabase (free tier)
1. Create a project at https://supabase.com.
2. Open **SQL Editor**, create a new query, paste `supabase/schema.sql`, and run it.
3. Open **Project Settings → API**. Copy the Project URL and the `anon` / publishable key.
4. Create `.env.local` in this project root:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
5. The anon key is designed for frontend use, but database security depends on correct RLS. Never put a `service_role` key in frontend code.

## 2. Run locally
Install Node.js LTS from https://nodejs.org, then in this folder run:
```bash
npm install
npm run dev
```
Open the local URL printed in the terminal.

## 3. Publish free with GitHub Pages
1. Create a GitHub repository named `afterhours-imposter`.
2. Upload these files to the repository root. Do **not** upload `.env.local`.
3. In `vite.config.js`, set `base` to your repository path, e.g. `base: '/afterhours-imposter/'`. If using a custom domain or username.github.io root repository, use `base: '/'`.
4. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Create `.github/workflows/deploy.yml` with:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: npm
         - run: npm install
         - run: npm run build
           env:
             VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
             VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       runs-on: ubuntu-latest
       needs: build
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
6. Go to **Settings → Pages**, choose **GitHub Actions** as the build source.
7. Push to `main`; wait for the Actions workflow to finish and open the Pages URL.

Note: Vite embeds `VITE_*` values into the client bundle. That is expected for the Supabase URL and anon key only. Keep privileged secrets server-side.

## 4. Before inviting a real group
- Replace permissive SQL policies with secure room membership policies.
- Add anonymous Supabase Auth and store each player's auth user ID.
- Move host-only actions to server-side functions; verify host identity on every action.
- Keep roles and the word in a private table and return only the requesting player's role through a verified function.
- Enforce player cap, unique names, imposter count and one-vote-per-player in server-side transactions.
- Add a server-generated word/image match, clue phase, synchronized timer, tie logic, results, next round, reconnect recovery and room cleanup.
- Test 3, 4 and 100 players, invite links, refresh/reconnect, duplicate joins, role privacy, ties and simultaneous votes.

## Suggested production architecture
GitHub Pages (frontend) + Supabase Auth + Postgres + Realtime + Edge Functions/RPCs. This avoids the fragile pattern where every player's browser acts as the room server.
