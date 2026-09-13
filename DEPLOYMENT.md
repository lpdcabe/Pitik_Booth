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

Only `VITE_API_URL` belongs in Vercel. Supabase credentials stay on Render. The SPA rewrite keeps `/gallery`, `/setup`, and `/photo/:id` working when opened directly.

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

The free backend may need time to wake after inactivity. Expired photos are blocked by the API; physical cleanup still requires scheduling `npm run cleanup -w backend` on an environment with the backend credentials.

References: [Render Blueprint configuration](https://render.com/docs/blueprint-spec), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
