# Deploy Pitik Booth: Render API + Vercel frontend

Repository: https://github.com/lpdcabe/Pitik_Booth (branch `main`).

Both services use the **repository root**, not `backend` or `frontend`, because the npm workspaces share the root lockfile. Commit and push `render.yaml`, `vercel.json`, and the backend proxy change before importing the repository.

## 1. Render backend

Open https://dashboard.render.com/select-repo?type=blueprint and connect `lpdcabe/Pitik_Booth`. Render reads `render.yaml` from the root. Choose the free plan defined in the Blueprint; no paid service is required by this configuration.

Enter the prompted environment variables:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Copy the existing value from `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Copy the existing server-only value from `backend/.env` |
| `FRONTEND_URL` | Your Vercel production origin, without a trailing slash; if not yet assigned, use `http://localhost:5173` temporarily and replace it in step 3 |

The Blueprint sets Node 22, production mode, and seven-day retention. Render supplies `PORT`. Leave Root Directory blank.

If creating a Web Service manually instead of a Blueprint:

- Build command: `npm ci --omit=dev --workspace=backend --include-workspace-root=false`
- Start command: `node backend/src/server.js`
- Health check: `/api/health`
- Set the variables above plus `NODE_VERSION=22`, `NODE_ENV=production`, and `PHOTO_RETENTION_DAYS=7`.

Copy the actual assigned Render URL once the service is live. Do not assume a particular subdomain is available. Open `https://YOUR-RENDER-HOST/api/health`; it should return `{"ok":true,"storageConfigured":true}`. The storage flag checks that credentials are present, not that all live operations succeed.

## 2. Vercel frontend

Open https://vercel.com/new and import the same repository.

- Project name: `pitik-booth` (or an available name).
- Root Directory: **leave at repository root (`./`)**.
- Framework: Vite.
- Build/install/output settings are supplied by the root `vercel.json`.
- Add `VITE_API_URL` with the actual Render origin, e.g. `https://YOUR-RENDER-HOST.onrender.com`. Do not append `/api` or a trailing slash.
- Deploy. Copy the actual production URL assigned by Vercel.

For Booth Together, also add `VITE_STUN_URL` and production TURN settings `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL`. See [BOOTH_TOGETHER.md](BOOTH_TOGETHER.md) for relay setup and credential visibility: every `VITE_` value is public in the built frontend. Supabase credentials stay on Render. The SPA rewrite keeps `/gallery`, `/setup`, `/together`, `/room/:roomCode`, and `/photo/:id` working when opened directly.

## 3. Connect the production origins

In Render, change `FRONTEND_URL` to the exact Vercel production origin (for example `https://YOUR-VERCEL-HOST.vercel.app`) and save/redeploy. This value controls both CORS and the generated share links.

If you change `VITE_API_URL` in Vercel, redeploy the frontend: Vite embeds it at build time. Your local `.env` files can continue using localhost. Vercel preview deployments have different origins and are intentionally not granted blanket CORS access; test cloud features on the configured production origin.

## 4. Verify the deployed app

1. Open the Vercel production URL on desktop and a phone.
2. Take or upload photos and download both PNG and JPG.
3. Save a finished image. Confirm it appears in My gallery.
4. Open the share link in another browser and scan the QR code. The link must use Vercel, not localhost or Render.
5. Refresh the shared page directly to verify the SPA rewrite.
6. Delete the test image from the original browser session and confirm its shared URL no longer serves the image.

The free backend may need time to wake after inactivity. Expired photos and rooms are blocked by the API; physical cleanup still requires scheduling `npm run cleanup -w backend` on an environment with the backend credentials.

## 5. Enable Booth Together

1. Run `supabase/booth-together.sql` in the existing project's SQL Editor after the original `supabase/migration.sql`. This adds room tables, transactional commands, and the private `room-photos` bucket.
2. Enable Supabase Realtime. The backend uses **private** Broadcast and Presence channels with its server credential. This implementation requires no frontend Supabase key, login, anonymous Realtime policy, or public room table access.
3. Redeploy Render and Vercel with the updated source and ICE variables. Keep the existing repository-root build and start commands.
4. Keep the room events endpoint `/api/rooms/:roomCode/events` directly on Render. It is a streaming SSE response, relayed from Supabase Realtime, with bearer credentials in headers. Do not buffer/cache it through a proxy or move it into a short-lived frontend function.
5. Verify `FRONTEND_URL` again. The CORS configuration must allow `Authorization`, `X-Participant-Id`, `X-Host-Token`, `Content-Type`, and `X-Session-Id` from the configured frontend origin.
6. Open two independent browser profiles, create a room, join through its invite, and confirm live camera feeds and pushed ready states. Complete a full session and verify both browsers receive the same `/photo/:id`.
7. Test on two real devices using separate networks, with a working TURN relay. Verify captures, individual/all retakes, reconnect, host recovery, PNG/JPG download, and QR sharing. A successful build or local fake-camera test does not verify this production scenario.

Rooms expire after two hours; final saved photos retain their existing retention setting. Schedule the cleanup command above to remove expired private room stills and records. Full configuration, API notes, and troubleshooting are in [BOOTH_TOGETHER.md](BOOTH_TOGETHER.md).

References: [Render Blueprint configuration](https://render.com/docs/blueprint-spec), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
