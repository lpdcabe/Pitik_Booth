# Pitik Booth — Online Photobooth

A responsive React + Vite and Tailwind application with an Express API, private Supabase Storage, and a reusable Canvas layout engine. No login, accounts, or protected routes.

## Run locally

Requires Node.js 22.12+ and npm. In this project directory:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
npm.cmd run dev
```

Open **http://localhost:5173**. Express runs on **http://localhost:5000**. Vite proxies `/api` to Express, so a frontend environment file is unnecessary for local development. On macOS/Linux, use `npm` instead of `npm.cmd` and `cp` instead of `Copy-Item`.

Camera capture, file uploads, editing, layout changes, and downloads work without Supabase. Cloud save, session gallery, and share links require the configuration below. The application returns an explicit configuration message until connected; it never simulates a successful save.

## Connect Supabase

1. Create a Supabase project.
2. Run the complete [migration](supabase/migration.sql) in the Supabase SQL Editor. It creates the metadata table, indexes, and the **private** `photobooth-images` bucket with a 10 MB limit and PNG/JPEG restrictions. RLS is enabled; anonymous and authenticated client roles have no direct table access.
3. Set these values in `backend/.env`:

```dotenv
PORT=5000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
PHOTO_RETENTION_DAYS=7
```

4. Restart `npm.cmd run dev`. `/api/health` should report `storageConfigured: true`. This flag indicates credentials are present; save a test image to verify their validity and the migration.

Never put the service-role key in a `VITE_` variable, frontend code, a commit, or a share URL. The Express service uploads and downloads objects with that key. Private storage lets the API check expiry before serving an image; this follows [Supabase's private bucket model](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Features

- Layout browser with categories, search, photo-count and orientation filters, local favorites, safe Surprise Me selection, and a live preview.
- 88 layouts across strips, grids, Polaroids, film, scrapbook, collages, editorial magazines, social posts, postcards, event themes, minimal, retro, cards, landscapes, masks, and asymmetrical compositions.
- 1, 2, 3, 4, 6, 8, and 9-photo sessions; the selected template determines its valid count. Double strips reuse four photos across eight print slots.
- 20 independent frame themes; custom event title, message, date, uploaded logo, background, borders, spacing, margins, corner radius, and title/footer visibility. Advanced settings include a custom magazine masthead and an optional QR destination printed onto the image.
- Front/rear camera switching, mirrored front preview, separate final-image mirroring, selectable 3/5/10-second countdown, automatic capture, flash, optional synthesized shutter sound, cancellation, and actionable camera errors.
- Upload PNG/JPEG/WebP source photos as an alternative to the camera. Files remain in browser memory until a finished image is explicitly saved.
- Individual retakes, replace, reorder, remove/refill, cover/contain, zoom, horizontal/vertical crop position, 15 filters, brightness, contrast, saturation, exposure-like brightness, warmth, and grain.
- High-resolution Canvas output, rotated slots, Polaroid shadows, masks, film perforations, decorative themes, PNG/JPG downloads, public share pages, native sharing, copy-link fallback, and QR codes.
- Session gallery with view/download/share/QR and confirmed deletion. Session IDs stay in `sessionStorage`; favorites use `photobooth_favorite_layouts` in `localStorage`.

The session UUID is anonymous browser tracking, not a user account. It acts as an unguessable possession token for listing/deleting that session's photos. Do not expose it in public share pages. Closing the browser session can remove access to its gallery; downloaded files and shared links remain available until deletion or expiry. Anyone with a share URL can view that individual image.

## Project map

```text
frontend/
  src/
    components/  Chrome, layout browser/preview, QR dialog
    context/     Photobooth state and notifications
    hooks/       Camera lifecycle and permissions
    pages/       Home, setup, capture, editor, result, gallery, share page
    services/    Express API client and downloads
    utils/       Layouts, frames, filters, Canvas renderer, session UUID
    App.jsx      Public routes
    main.jsx     React entry point
    styles.css   Tailwind import and responsive visual system
  .env.example
  vite.config.js
backend/
  src/
    controllers/ Upload, metadata, image serving, session list, deletion
    routes/      API endpoints, multipart parsing, upload throttling
    services/    Server-only Supabase client
    validation.js
    server.js    Express, CORS, Helmet, rate limits, static hosting, errors
    cleanup.js   Batched expiration cleanup
  .env.example
supabase/migration.sql
tests/           Unit/API tests and browser workflow tests
playwright.config.js
```

## API contract

| Method | Endpoint                              | Behavior                                                       |
| ------ | ------------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/health`                         | Server and configuration status                                |
| POST   | `/api/photobooths`                    | Multipart image and metadata; returns ID and share URL         |
| GET    | `/api/photobooths/:id`                | Public, non-expired metadata without session/storage internals |
| GET    | `/api/photobooths/:id/image`          | Streams PNG from private storage after checking expiry         |
| GET    | `/api/photobooths/session/:sessionId` | Latest 100 active photos for matching `X-Session-Id`           |
| DELETE | `/api/photobooths/:id`                | Removes storage and metadata only for matching session header  |

POST fields: `image` (PNG/JPEG, max 10 MB), `session_id` (UUID), `layout`, `frame`, `photo_count`, `event_name` (max 100 chars), and `custom_text` (max 240 chars). Image decoding checks actual format, limits source pixels, and re-encodes uploads to remove embedded metadata. API errors are JSON `{ "error": "..." }` with safe messages. Limits are 120 API requests/minute/IP and 10 uploads/minute/IP.

## Layout architecture

`frontend/src/utils/layouts.js` contains output sizes and reusable slot definitions. Each slot has `x`, `y`, `width`, `height`, `rotation`, and `photoIndex`, with optional `mask`. Add templates here without adding another renderer. `frames.js` owns independent visual themes. `canvasGenerator.js` combines slot geometry, crop state, effects, decorations, text and logos for previews and exports.

The future drag-and-drop template/sticker builder is intentionally not implemented. Its extension points are slot geometry, decoration metadata, and the shared rendering pipeline.

## Expiration

`PHOTO_RETENTION_DAYS=7` stamps saved rows with `expires_at`; use `0` to disable expiration for new uploads. Expired images are immediately unavailable through the API. To physically remove expired storage objects and rows, run:

```powershell
npm.cmd run cleanup -w backend
```

Schedule this command daily in your hosting provider's cron service with the same backend environment variables. Changing retention does not rewrite existing expiration timestamps.

## Verify

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright test
npm.cmd audit
```

Browser tests use installed Microsoft Edge with a simulated camera, and save screenshots under `test-results/`. If Edge is unavailable, install Chromium with `npx playwright install chromium` and remove `channel: 'msedge'` from `playwright.config.js`. No physical webcam is used by these tests. Real Android/iPhone camera permissions and real Supabase credentials still need deployment acceptance checks.

## Production deployment

### One Node service (simplest)

1. Install with `npm ci`, then `npm run build` in the repository root.
2. Set `NODE_ENV=production`, `PORT` to your host's assigned port, `FRONTEND_URL` to the public HTTPS origin, and both server-only Supabase variables.
3. Start with `npm start`. Express serves `frontend/dist`, the API, and SPA routes including `/photo/:id`.
4. Leave `VITE_API_URL` unset at build time for this same-origin deployment.
5. Serve through HTTPS. Camera access on phones requires a secure origin; plain LAN HTTP does not qualify.

Vite's production artifact is the `dist` directory, as described in its [deployment guide](https://vite.dev/guide/static-deploy). Its development server is not the production server.

### Separate frontend and API

Build the frontend with `VITE_API_URL=https://api.example.com`. Deploy `frontend/dist` to your static host and rewrite application routes to `/index.html`. Run Express as a Node service with `FRONTEND_URL=https://example.com` for CORS and share URL generation. Preserve API paths without static-host rewrites. Use HTTPS for both origins.

For a reverse proxy, configure Express `trust proxy` for the known proxy topology before relying on per-IP limits. Do not blindly trust arbitrary forwarded IP headers. For multiple API replicas, replace the in-memory limiter with a shared store. Allow enough memory for high-resolution image decoding; the app limits upload source images to 40 megapixels.

## Acceptance with your Supabase project

Save a finished image, verify it appears in the same session's gallery, open its share link in another browser, scan the QR code, download it, and delete it from the original session. Confirm the second browser cannot list the first browser's gallery and the deleted share link returns 404. Credentials are not supplied with this project, so live cloud operations cannot be verified until configured.
#   P i t i k _ B o o t h  
 