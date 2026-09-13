# Complete project source

Every authored file below includes its full workspace path and complete contents. Dependency lockfiles, generated builds, screenshots and secret environment files are excluded.

## .gitignore

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\.gitignore

````text
node_modules/
dist/
.env
*.log
test-results/

````

## README.md

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\README.md

````markdown
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

````

## backend/.env.example

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\.env.example

````text
PORT=5000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PHOTO_RETENTION_DAYS=7

````

## backend/README.md

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\README.md

````markdown
# Photobooth API

See the root [setup and deployment guide](../README.md) for complete instructions, environment variables, API contracts, storage configuration, and scheduled cleanup.

From the repository root, run `npm install`, copy `backend/.env.example` to `backend/.env`, fill in the Supabase server credentials, and run `npm run dev`. All camera and download features work while cloud storage is unconfigured.

````

## backend/package.json

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\package.json

````json
{
  "name": "photobooth-backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.js",
    "start": "node --env-file-if-exists=.env src/server.js",
    "cleanup": "node --env-file-if-exists=.env src/cleanup.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.1",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "multer": "^2.0.2",
    "sharp": "^0.35.4",
    "zod": "^3.24.2"
  }
}

````

## backend/src/cleanup.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\cleanup.js

````javascript
import { supabase, bucket } from "./services/supabase.js";
if (!supabase) throw new Error("Configure Supabase before cleanup.");
let removed = 0;
while (true) {
  const { data, error } = await supabase
    .from("photobooths")
    .select("id,storage_path")
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (error) throw error;
  if (!data.length) break;
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove(data.map((x) => x.storage_path));
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase
    .from("photobooths")
    .delete()
    .in(
      "id",
      data.map((x) => x.id),
    );
  if (deleteError) throw deleteError;
  removed += data.length;
}
console.log(`Removed ${removed} expired memories.`);

````

## backend/src/controllers/photoboothController.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\controllers\photoboothController.js

````javascript
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { supabase, bucket } from "../services/supabase.js";
import { metadata, uuid } from "../validation.js";
const fields =
  "id,event_name,custom_text,layout,frame,photo_count,created_at,expires_at";
const alive = (q) =>
  q.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
export async function create(req, res) {
  const parsed = metadata.safeParse(req.body);
  if (!parsed.success || !req.file)
    return res
      .status(400)
      .json({ error: "Provide a PNG or JPG and valid photobooth details." });
  let info;
  try {
    info = await sharp(req.file.buffer, {
      limitInputPixels: 40000000,
    }).metadata();
  } catch {
    return res.status(400).json({ error: "This image could not be read." });
  }
  if (
    !["png", "jpeg"].includes(info.format) ||
    `image/${info.format}` !== req.file.mimetype
  )
    return res
      .status(400)
      .json({ error: "The image contents must match PNG or JPEG." });
  const image = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
    .rotate()
    .png()
    .toBuffer();
  const id = randomUUID(),
    storage_path = `photobooths/${id}.png`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storage_path, image, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  const days = Number(process.env.PHOTO_RETENTION_DAYS ?? 7);
  const expires_at =
    days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const { data, error } = await supabase
    .from("photobooths")
    .insert({
      ...parsed.data,
      id,
      storage_path,
      image_url: `/api/photobooths/${id}/image`,
      expires_at,
    })
    .select(fields)
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([storage_path]);
    throw error;
  }
  res.status(201).json({
    ...data,
    image_url: `/api/photobooths/${id}/image`,
    share_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/photo/${id}`,
  });
}
export async function get(req, res) {
  if (!uuid.safeParse(req.params.id).success)
    return res.status(400).json({ error: "Invalid photo link." });
  const { data, error } = await alive(
    supabase.from("photobooths").select(fields).eq("id", req.params.id),
  ).maybeSingle();
  if (error) throw error;
  if (!data)
    return res.status(404).json({
      error: "This memory was deleted, expired, or could not be found.",
    });
  res.json({ ...data, image_url: `/api/photobooths/${data.id}/image` });
}
export async function image(req, res) {
  if (!uuid.safeParse(req.params.id).success) return res.status(400).end();
  const { data, error } = await alive(
    supabase.from("photobooths").select("storage_path").eq("id", req.params.id),
  ).maybeSingle();
  if (error) throw error;
  if (!data)
    return res.status(404).json({ error: "Photo not found or expired." });
  const { data: blob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(data.storage_path);
  if (downloadError) throw downloadError;
  res
    .set({
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
    .send(Buffer.from(await blob.arrayBuffer()));
}
export async function list(req, res) {
  if (
    !uuid.safeParse(req.params.sessionId).success ||
    req.get("X-Session-Id") !== req.params.sessionId
  )
    return res
      .status(400)
      .json({ error: "A matching browser session is required." });
  const { data, error } = await alive(
    supabase
      .from("photobooths")
      .select(fields)
      .eq("session_id", req.params.sessionId),
  )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json(
    data.map((row) => ({
      ...row,
      image_url: `/api/photobooths/${row.id}/image`,
    })),
  );
}
export async function remove(req, res) {
  const session = req.get("X-Session-Id");
  if (
    !uuid.safeParse(req.params.id).success ||
    !uuid.safeParse(session).success
  )
    return res.status(400).json({ error: "Invalid photo or session." });
  const { data, error } = await supabase
    .from("photobooths")
    .select("storage_path")
    .eq("id", req.params.id)
    .eq("session_id", session)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    return res
      .status(404)
      .json({ error: "This photo is not in your session." });
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([data.storage_path]);
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase
    .from("photobooths")
    .delete()
    .eq("id", req.params.id)
    .eq("session_id", session);
  if (deleteError) throw deleteError;
  res.status(204).end();
}

````

## backend/src/routes/photobooths.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\routes\photobooths.js

````javascript
import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import * as controller from "../controllers/photoboothController.js";
import { requireStorage } from "../services/supabase.js";
const router = Router();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
  fileFilter(req, file, cb) {
    if (["image/png", "image/jpeg"].includes(file.mimetype)) cb(null, true);
    else
      cb(
        Object.assign(new Error("Only PNG and JPG images are supported."), {
          status: 400,
        }),
      );
  },
});
router.use(requireStorage);
router.post(
  "/",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
  upload.single("image"),
  wrap(controller.create),
);
router.get("/session/:sessionId", wrap(controller.list));
router.get("/:id/image", wrap(controller.image));
router.get("/:id", wrap(controller.get));
router.delete("/:id", wrap(controller.remove));
export default router;

````

## backend/src/server.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\server.js

````javascript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import routes from "./routes/photobooths.js";
import { supabase } from "./services/supabase.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'", "blob:"],
        "script-src": ["'self'"],
        "connect-src": [
          "'self'",
          process.env.FRONTEND_URL || "http://localhost:5173",
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    allowedHeaders: ["Content-Type", "X-Session-Id"],
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) =>
  res.json({ ok: true, storageConfigured: !!supabase }),
);
app.use("/api/photobooths", routes);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
const dist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.use((error, req, res, next) => {
  console.error(error.message);
  const status =
    error.code === "LIMIT_FILE_SIZE"
      ? 413
      : error.status || (error.name === "MulterError" ? 400 : 500);
  res.status(status >= 400 && status < 500 ? status : 500).json({
    error:
      error.code === "LIMIT_FILE_SIZE"
        ? "Please choose an image smaller than 10 MB."
        : error.name === "MulterError"
          ? "Invalid upload."
          : error.status
            ? error.message
            : "Unable to complete this request. Please try again.",
  });
});
if (process.env.NODE_ENV !== "test")
  app.listen(process.env.PORT || 5000, () =>
    console.log(`Photobooth API listening on ${process.env.PORT || 5000}`),
  );

````

## backend/src/services/supabase.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\services\supabase.js

````javascript
import { createClient } from "@supabase/supabase-js";
export const bucket = "photobooth-images";
export const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : null;
export function requireStorage(req, res, next) {
  if (!supabase)
    return res.status(503).json({
      error:
        "Cloud saving is not configured yet. You can still download your photos.",
    });
  next();
}

````

## backend/src/validation.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\backend\src\validation.js

````javascript
import { z } from "zod";
export const uuid = z.string().uuid();
export const metadata = z.object({
  session_id: uuid,
  layout: z.string().min(1).max(100),
  frame: z.string().min(1).max(100),
  photo_count: z.coerce
    .number()
    .refine((n) => [1, 2, 3, 4, 6, 8, 9].includes(n)),
  custom_text: z.string().max(240).default(""),
  event_name: z.string().max(100).default(""),
});

````

## frontend/.env.example

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\.env.example

````text
VITE_API_URL=http://localhost:5000

````

## frontend/index.html

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\index.html

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#faf8f4" />
    <meta
      name="description"
      content="Turn a little moment into a lasting memory. A free online photobooth with creative layouts, frames and filters."
    />
    <title>Pitik Booth — Online Photobooth</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

````

## frontend/package.json

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\package.json

````json
{
  "name": "photobooth-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.5",
    "lucide-react": "^0.468.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "vite": "^6.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.6",
    "@tailwindcss/vite": "^4.0.6"
  }
}

````

## frontend/src/App.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\App.jsx

````jsx
import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { Navbar, Footer } from "./components/Chrome";
import Home from "./pages/Home";
import Setup from "./pages/Setup";
import Photobooth from "./pages/Photobooth";
import EditPhotos from "./pages/EditPhotos";
import Result from "./pages/Result";
import Gallery from "./pages/Gallery";
import SharedPhoto from "./pages/SharedPhoto";
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <div id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup key="setup" />} />
          <Route path="/layouts" element={<Setup key="layouts" library />} />
          <Route path="/photobooth" element={<Photobooth />} />
          <Route path="/edit" element={<EditPhotos />} />
          <Route path="/result" element={<Result />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/photo/:id" element={<SharedPhoto />} />
          <Route
            path="*"
            element={
              <main className="empty-state">
                <h1>A little lost?</h1>
                <Link className="button" to="/">
                  Back home
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
      <Footer />
    </>
  );
}

````

## frontend/src/components/Chrome.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\components\Chrome.jsx

````jsx
import { Link, NavLink } from "react-router-dom";
import { Camera, ArrowUpRight, Heart } from "lucide-react";
export function Navbar() {
  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <span className="brand-icon">
          <Camera size={22} />
        </span>
        Pitik Booth<span className="brand-dot">®</span>
      </Link>
      <nav aria-label="Main navigation">
        <NavLink to="/layouts">Layouts</NavLink>
        <a href="/#how-it-works">How it works</a>
        <NavLink to="/gallery">My gallery</NavLink>
      </nav>
      <Link className="button small" to="/setup">
        Let’s make memories <ArrowUpRight size={16} />
      </Link>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <Link className="brand" to="/">
        <Camera size={20} /> Pitik Booth
      </Link>
      <span>Made for the moments in between.</span>
      <span>
        Made with a little <Heart size={13} />
      </span>
    </footer>
  );
}
export function Steps({ current = 1 }) {
  return (
    <div className="steps">
      {[
        "Choose a layout",
        "Make it yours",
        "Strike a pose",
        "Keep the memory",
      ].map((s, i) => (
        <div key={s} className={current >= i + 1 ? "active" : ""}>
          <span>{i + 1}</span>
          <p>{s}</p>
          {i < 3 && <i />}
        </div>
      ))}
    </div>
  );
}

````

## frontend/src/components/LayoutPreview.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\components\LayoutPreview.jsx

````jsx
import { useEffect, useRef, useState } from "react";
import { generateCanvas } from "../utils/canvasGenerator";
import { frames } from "../utils/frames";
export default function LayoutPreview({
  layout,
  frame = frames[0],
  photos = [],
  settings = {},
  preset = "Original",
  className = "",
}) {
  const ref = useRef(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    generateCanvas(
      { layout, frame, photos, settings, preset },
      Math.min(1, 650 / layout.width, 1000 / layout.height),
    )
      .then((canvas) => {
        if (active && ref.current) {
          ref.current.replaceChildren(canvas);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [layout, frame, photos, settings, preset]);
  return (
    <div
      className={`layout-preview ${className}`}
      role="img"
      aria-label={`${layout.name}, ${layout.photoCount} photos`}
    >
      <div ref={ref} />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

````

## frontend/src/components/LayoutSelector.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\components\LayoutSelector.jsx

````jsx
import { useState } from "react";
import { Search, Heart, Shuffle, Check, ArrowRight } from "lucide-react";
import { layouts, layoutCategories } from "../utils/layouts";
import { useBooth } from "../context/PhotoboothContext";
import LayoutPreview from "./LayoutPreview";
export default function LayoutSelector({ onContinue }) {
  const { layout, setLayout, frame, photos, settings, preset, notify } =
    useBooth();
  const [category, setCategory] = useState("Featured"),
    [search, setSearch] = useState(""),
    [count, setCount] = useState("all"),
    [orientation, setOrientation] = useState("all");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("photobooth_favorite_layouts") || "[]",
      );
    } catch {
      return [];
    }
  });
  function favorite(id) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("photobooth_favorite_layouts", JSON.stringify(next));
    } catch {
      notify("Favorites could not be saved in this browser.");
    }
  }
  const filtered = layouts.filter(
    (l) =>
      (category === "All" ||
        (category === "Featured" && l.featured) ||
        (category === "Favorites" && favorites.includes(l.id)) ||
        l.category === category) &&
      `${l.name} ${l.category} ${l.photoCount} photos`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (count === "all" || l.photoCount === Number(count)) &&
      (orientation === "all" || orientation === l.orientation),
  );
  return (
    <div className="layout-workspace">
      <div className="layout-browser">
        <div className="search-row">
          <label className="search-input">
            <Search size={18} />
            <input
              placeholder="Search layouts..."
              aria-label="Search layouts"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setCategory("All");
              }}
            />
          </label>
          <button
            className="button secondary"
            onClick={() => {
              setLayout(layouts[Math.floor(Math.random() * layouts.length)]);
              notify("A little surprise, just for you.");
            }}
          >
            <Shuffle size={16} /> Surprise me
          </button>
        </div>
        <div className="category-chips">
          {layoutCategories.map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span>{filtered.length} layouts to love</span>
          <select
            aria-label="Filter photo count"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          >
            <option value="all">All photo counts</option>
            {[1, 2, 3, 4, 6, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n} photos
              </option>
            ))}
          </select>
          <select
            aria-label="Filter orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="all">All orientations</option>
            {["portrait", "landscape", "square"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="layout-grid">
          {filtered.map((l) => (
            <article
              key={l.id}
              className={`layout-card ${l.id === layout.id ? "chosen" : ""}`}
            >
              <button
                className="layout-select"
                onClick={() => setLayout(l)}
                aria-label={`Preview ${l.name}`}
              >
                <div className="layout-thumb">
                  <img src={l.thumbnail} alt="" />
                  {l.id === layout.id && (
                    <span className="selected-badge">
                      <Check size={15} />
                    </span>
                  )}
                </div>
                <h3>{l.name}</h3>
                <p>
                  {l.photoCount} photos · {l.orientation}
                </p>
              </button>
              <button
                className={`favorite icon-button ${favorites.includes(l.id) ? "hearted" : ""}`}
                aria-label={`${favorites.includes(l.id) ? "Unfavorite" : "Favorite"} ${l.name}`}
                onClick={() => favorite(l.id)}
              >
                <Heart
                  size={16}
                  fill={favorites.includes(l.id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search />
            <h3>No layouts found</h3>
            <p>Try another search or explore a different category.</p>
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setCount("all");
                setOrientation("all");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
      <aside className="preview-sidebar">
        <span className="eyebrow">YOUR LITTLE MASTERPIECE</span>
        <div className="preview-stage">
          <LayoutPreview {...{ layout, frame, photos, settings, preset }} />
        </div>
        <h3>{layout.name}</h3>
        <p>
          {layout.photoCount} photos · {layout.orientation}
          <br />
          {layout.width} × {layout.height} px
        </p>
        <button className="button" onClick={onContinue}>
          Use this layout <ArrowRight size={17} />
        </button>
        <small>You can always change it later.</small>
      </aside>
    </div>
  );
}

````

## frontend/src/components/QRCodeModal.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\components\QRCodeModal.jsx

````jsx
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Copy } from "lucide-react";
export default function QRCodeModal({ url, onClose }) {
  const [src, setSrc] = useState(""),
    [copied, setCopied] = useState(false),
    ref = useRef();
  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#354b38", light: "#ffffff" },
    }).then(setSrc);
    ref.current?.showModal();
  }, [url]);
  return (
    <dialog
      ref={ref}
      className="qr-modal"
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button
        className="icon-button close"
        aria-label="Close QR code"
        onClick={onClose}
      >
        <X />
      </button>
      <span className="eyebrow">PASS THE MEMORY ON</span>
      <h2>Scan to download</h2>
      <p>A little moment, ready to share.</p>
      {src && <img src={src} alt="QR code linking to this photobooth" />}
      <input readOnly aria-label="Share link" value={url} />
      <button
        className="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={16} />
        {copied ? "Link copied" : "Copy link"}
      </button>
    </dialog>
  );
}

````

## frontend/src/context/PhotoboothContext.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\context\PhotoboothContext.jsx

````jsx
import { createContext, useContext, useState } from "react";
import { defaultLayout } from "../utils/layouts";
import { frames } from "../utils/frames";
const Context = createContext(null);
const initialSettings = () => ({
  eventName: "Pitik Booth",
  message: "a little moment, a lasting memory.",
  date: new Date().toISOString().slice(0, 10),
  showEvent: true,
  showMessage: true,
  showDate: true,
  showHeader: true,
  showFooter: false,
  showLogo: true,
  footer: "made with Pitik Booth",
  spacing: 0,
  margin: 0,
  radius: 0,
  borderWidth: 0,
  textPlacement: "bottom",
});
export function PhotoboothProvider({ children }) {
  const [layout, setLayout] = useState(defaultLayout),
    [frame, setFrame] = useState(frames[0]),
    [photos, setPhotos] = useState([]),
    [settings, setSettings] = useState(initialSettings),
    [preset, setPreset] = useState("Original"),
    [toast, setToast] = useState("");
  const notify = (message) => {
    setToast(message);
    setTimeout(
      () => setToast((current) => (current === message ? "" : current)),
      4000,
    );
  };
  function reset() {
    setPhotos([]);
    setSettings(initialSettings());
    setLayout(defaultLayout);
    setFrame(frames[0]);
    setPreset("Original");
  }
  return (
    <Context.Provider
      value={{
        layout,
        setLayout,
        frame,
        setFrame,
        photos,
        setPhotos,
        settings,
        setSettings,
        preset,
        setPreset,
        notify,
        reset,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export const useBooth = () => useContext(Context);

````

## frontend/src/hooks/useCamera.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\hooks\useCamera.js

````javascript
import { useCallback, useEffect, useRef, useState } from "react";
const messages = {
  NotAllowedError:
    "Camera permission was denied. Allow camera access in your browser settings, then try again.",
  NotFoundError:
    "No camera was found. Connect a camera or upload your photos below.",
  NotReadableError:
    "Your camera may be in use by another app. Close that app and try again.",
  OverconstrainedError:
    "This camera does not support the requested settings. Try another camera.",
};
export default function useCamera() {
  const videoRef = useRef(null),
    streamRef = useRef(null),
    generation = useRef(0);
  const [facing, setFacing] = useState("user"),
    [status, setStatus] = useState("idle"),
    [error, setError] = useState("");
  const stop = useCallback(() => {
    generation.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const open = useCallback(async () => {
    stop();
    const token = generation.current;
    setStatus("loading");
    setError("");
    if (!window.isSecureContext) {
      setError(
        "Camera access requires HTTPS or localhost. Open a secure link, or upload photos.",
      );
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support camera access. Try a current browser or upload photos.",
      );
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (token === generation.current) setStatus("ready");
    } catch (e) {
      if (token === generation.current) {
        setError(
          messages[e.name] ||
            "We couldn’t start your camera. Please check your camera and try again.",
        );
        setStatus("error");
      }
    }
  }, [facing, stop]);
  useEffect(() => {
    open();
    return stop;
  }, [open, stop]);
  return {
    videoRef,
    facing,
    status,
    error,
    open,
    stop,
    switchCamera: () =>
      setFacing((f) => (f === "user" ? "environment" : "user")),
  };
}

````

## frontend/src/main.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\main.jsx

````jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PhotoboothProvider } from "./context/PhotoboothContext";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PhotoboothProvider>
        <App />
      </PhotoboothProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

````

## frontend/src/pages/EditPhotos.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\EditPhotos.jsx

````jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RotateCcw, ArrowLeft, ArrowRight, Upload, Trash2 } from "lucide-react";
import { useBooth } from "../context/PhotoboothContext";
import LayoutPreview from "../components/LayoutPreview";
import { filters, filterCSS, defaultAdjustments } from "../utils/filters";
import { Steps } from "../components/Chrome";
export default function EditPhotos() {
  const booth = useBooth(),
    { photos, setPhotos, layout, preset, notify } = booth;
  const [selected, setSelected] = useState(0),
    [all, setAll] = useState(false);
  const navigate = useNavigate();
  const photo = photos[selected];
  function update(patch) {
    setPhotos((old) =>
      old.map((p, i) =>
        p && (all || i === selected) ? { ...p, ...patch } : p,
      ),
    );
  }
  function swap(delta) {
    const j = selected + delta;
    if (j < 0 || j >= layout.photoCount) return;
    setPhotos((old) => {
      const next = [...old];
      [next[selected], next[j]] = [next[j], next[selected]];
      return next;
    });
    setSelected(j);
  }
  async function replace(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
      f.size > 10 * 1024 * 1024
    )
      return notify("Choose an image under 10 MB.");
    const reader = new FileReader();
    reader.onload = () =>
      setPhotos((old) => {
        const next = [...old];
        next[selected] = {
          src: reader.result,
          filter: preset,
          zoom: 1,
          panX: 0,
          panY: 0,
        };
        return next;
      });
    reader.readAsDataURL(f);
    e.target.value = "";
  }
  const complete = Array.from(
    { length: layout.photoCount },
    (_, i) => photos[i],
  ).every(Boolean);
  return (
    <main className="section">
      <Steps current={3} />
      <div className="page-title">
        <span className="eyebrow">A LITTLE FINISHING TOUCH</span>
        <h1>Looking good. Feeling like you.</h1>
        <p>Pick your favorites, find your filter, and make every photo fit.</p>
      </div>
      <div className="layout-workspace">
        <div className="editor-panel">
          <div className="edit-thumbnails">
            {Array.from({ length: layout.photoCount }, (_, i) => (
              <button
                key={i}
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
              >
                {photos[i] ? (
                  <img src={photos[i].src} alt={`Select photo ${i + 1}`} />
                ) : (
                  <span>
                    Photo {i + 1}
                    <br />
                    Add photo
                  </span>
                )}
                <small>{i + 1}</small>
              </button>
            ))}
          </div>
          {photo ? (
            <div className="edit-photo">
              <img
                src={photo.src}
                alt={`Editing photo ${selected + 1}`}
                style={{ filter: filterCSS(photo, preset) }}
              />
            </div>
          ) : (
            <div className="empty-state">
              <h3>This spot is waiting for a memory.</h3>
              <Link className="button" to={`/photobooth?retake=${selected}`}>
                Take photo {selected + 1}
              </Link>
            </div>
          )}
          <div className="edit-actions">
            <Link
              className="button secondary"
              to={`/photobooth?retake=${selected}`}
            >
              <RotateCcw size={16} /> Retake
            </Link>
            <label className="button secondary">
              <Upload size={16} /> Replace
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                onChange={replace}
              />
            </label>
            <button
              className="icon-button"
              aria-label="Move photo left"
              disabled={selected === 0}
              onClick={() => swap(-1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Move photo right"
              disabled={selected === layout.photoCount - 1}
              onClick={() => swap(1)}
            >
              <ArrowRight size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Remove photo"
              onClick={() =>
                setPhotos((old) =>
                  old.map((p, i) => (i === selected ? null : p)),
                )
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
          {photo && (
            <>
              <div className="section-heading">
                <h3>Find your filter</h3>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) => setAll(e.target.checked)}
                  />{" "}
                  Apply edits to all photos
                </label>
              </div>
              <div className="filter-presets">
                {filters.map((f) => (
                  <button
                    key={f.name}
                    className={
                      (photo.filter || preset) === f.name ? "selected" : ""
                    }
                    onClick={() => update({ filter: f.name })}
                  >
                    <img src={photo.src} alt="" style={{ filter: f.css }} />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
              <details open>
                <summary>Crop & position</summary>
                <label>
                  Fit
                  <select
                    value={photo.fit || "cover"}
                    onChange={(e) => update({ fit: e.target.value })}
                  >
                    <option value="cover">Cover the frame</option>
                    <option value="contain">Show the whole photo</option>
                  </select>
                </label>
                <div className="field-grid">
                  {[
                    ["zoom", "Zoom", 1, 3, 0.05],
                    ["panX", "Horizontal position", -100, 100, 1],
                    ["panY", "Vertical position", -100, 100, 1],
                  ].map(([key, label, min, max, step]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={photo[key] ?? (key === "zoom" ? 1 : 0)}
                        onChange={(e) =>
                          update({ [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="help-text">
                  Your crop updates in the layout preview. Position controls
                  move photos within the available crop.
                </p>
              </details>
              <details>
                <summary>Fine-tune your photos</summary>
                <div className="field-grid">
                  {[
                    ["brightness", 50, 150],
                    ["contrast", 50, 150],
                    ["saturation", 0, 200],
                    ["exposure", -100, 100],
                    ["warmth", 0, 100],
                    ["grain", 0, 100],
                  ].map(([key, min, max]) => (
                    <label key={key} className="capitalize">
                      {key}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={
                          photo.adjustments?.[key] ?? defaultAdjustments[key]
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setPhotos((old) =>
                            old.map((p, i) =>
                              p && (all || i === selected)
                                ? {
                                    ...p,
                                    adjustments: {
                                      ...p.adjustments,
                                      [key]: value,
                                    },
                                  }
                                : p,
                            ),
                          );
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="text-link"
                  onClick={() =>
                    update({
                      adjustments: defaultAdjustments,
                      zoom: 1,
                      panX: 0,
                      panY: 0,
                      filter: "Original",
                    })
                  }
                >
                  Reset edits
                </button>
              </details>
            </>
          )}
        </div>
        <aside className="preview-sidebar">
          <span className="eyebrow">THE BIG PICTURE</span>
          <div className="preview-stage">
            <LayoutPreview {...booth} />
          </div>
          <h3>Made of your best moments.</h3>
          <p>
            {complete
              ? "Ready when you are."
              : `Fill all ${layout.photoCount} photo slots to continue.`}
          </p>
          <button
            className="button"
            disabled={!complete}
            onClick={() => navigate("/result")}
          >
            Create my photobooth <ArrowRight size={17} />
          </button>
          <Link className="text-link" to="/setup?step=frame">
            Change frame or layout
          </Link>
        </aside>
      </div>
    </main>
  );
}

````

## frontend/src/pages/Gallery.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\Gallery.jsx

````jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Download, Share2, QrCode, Trash2 } from "lucide-react";
import { api, imageURL, downloadURL } from "../services/api";
import { useBooth } from "../context/PhotoboothContext";
import QRCodeModal from "../components/QRCodeModal";
export default function Gallery() {
  const [photos, setPhotos] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false);
  const { notify } = useBooth();
  async function load() {
    setLoading(true);
    setError("");
    try {
      setPhotos(await api.list());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function share(p) {
    const url = `${location.origin}/photo/${p.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: p.event_name || "A little moment",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        notify("Share link copied!");
      }
    } catch (e) {
      if (e.name !== "AbortError") setQr(url);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api.remove(deleting.id);
      setPhotos((old) => old.filter((p) => p.id !== deleting.id));
      setDeleting(null);
      notify("Memory deleted.");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="section gallery-page">
      <div className="page-title">
        <span className="eyebrow">YOUR OWN LITTLE COLLECTION</span>
        <h1>A gallery of good feelings.</h1>
        <p>
          Memories saved in this browser session. A little happiness to come
          back to.
        </p>
      </div>
      {loading ? (
        <div className="loading">
          <span className="spinner" />
          Gathering your memories...
        </div>
      ) : error ? (
        <div className="empty-state">
          <Camera size={40} />
          <h3>Your gallery isn’t available yet.</h3>
          <p role="alert">{error}</p>
          <button className="button secondary" onClick={load}>
            Try again
          </button>
          <Link className="text-link" to="/setup">
            Create a photobooth
          </Link>
        </div>
      ) : !photos.length ? (
        <div className="empty-state">
          <Camera size={44} />
          <h2>Your first memory starts here.</h2>
          <p>Create a photobooth and save it to see it in your gallery.</p>
          <Link to="/setup" className="button">
            Make a little moment
          </Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((p) => (
            <article className="gallery-card" key={p.id}>
              <Link to={`/photo/${p.id}`}>
                <div className="gallery-image">
                  <img
                    src={imageURL(p)}
                    alt={p.event_name || "Saved photobooth"}
                  />
                </div>
                <h3>{p.event_name || "A little moment"}</h3>
              </Link>
              <p>{new Date(p.created_at).toLocaleDateString()}</p>
              <div className="gallery-actions">
                <button
                  className="icon-button"
                  aria-label="Download photo"
                  onClick={() =>
                    downloadURL(imageURL(p)).catch((e) => notify(e.message))
                  }
                >
                  <Download size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Share photo"
                  onClick={() => share(p)}
                >
                  <Share2 size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Show QR code"
                  onClick={() => setQr(`${location.origin}/photo/${p.id}`)}
                >
                  <QrCode size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete photo"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {qr && <QRCodeModal url={qr} onClose={() => setQr("")} />}
      {deleting && (
        <div className="modal-backdrop">
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this memory?</h2>
            <p>The image and its share link will be permanently removed.</p>
            <div className="download-buttons">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Keep it
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Deleting..." : "Delete memory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

````

## frontend/src/pages/Home.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\Home.jsx

````jsx
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Camera,
  Sparkles,
  Download,
  ShieldCheck,
  Heart,
  MoveUpRight,
  Check,
} from "lucide-react";
import { layouts } from "../utils/layouts";
import { useBooth } from "../context/PhotoboothContext";
export default function Home() {
  const { setLayout } = useBooth();
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow pill">
              <span className="live-dot" /> YOUR BROWSER. YOUR PERSONAL
              PHOTOBOOTH.
            </span>
            <h1>
              Little moments.
              <br />
              Big <em>memories.</em>
              <span className="sketch-spark">✳</span>
            </h1>
            <p>
              Come as you are. Strike a pose. Turn your everyday
              <br className="desktop" /> moments into something worth keeping.
            </p>
            <Link to="/setup" className="button hero-cta">
              Start photobooth <ArrowUpRight size={20} />
            </Link>
            <div className="hero-promises">
              <span>
                <Check size={14} /> Free to create
              </span>
              <span>
                <Check size={14} /> No sign-up
              </span>
              <span>
                <Check size={14} /> Just you & your camera
              </span>
            </div>
            <div className="love-note">
              <span className="tiny-faces">
                <i>☺</i>
                <i>☺</i>
                <i>☺</i>
              </span>
              <div>
                <span className="stars">★★★★★</span>
                <p>A little joy, one photo at a time.</p>
              </div>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Decorative examples of photobooth memories"
          >
            <div className="orbit" />
            <span className="art-star">✧</span>
            <div className="sample-strip strip-one">
              <div className="sample-photo scene-one">
                <span>☀</span>
                <b>
                  good
                  <br />
                  company.
                </b>
              </div>
              <div className="sample-photo scene-two">
                <span>✿</span>
                <b>
                  stay
                  <br />a little.
                </b>
              </div>
              <div className="sample-photo scene-three">
                <span>☺</span>
                <b>you & me.</b>
              </div>
              <p>the good old days ♡</p>
              <small>09.13.2026</small>
            </div>
            <div className="sample-strip strip-two">
              <div className="sample-photo scene-four">
                <span>✿</span>
                <b>
                  small
                  <br />
                  joys.
                </b>
              </div>
              <div className="sample-photo scene-five">
                <span>☀</span>
                <b>
                  golden
                  <br />
                  hour.
                </b>
              </div>
              <div className="sample-photo scene-six">
                <span>♡</span>
                <b>
                  keep
                  <br />
                  this feeling.
                </b>
              </div>
              <p>Pitik Booth</p>
              <small>MADE TO BE KEPT</small>
            </div>
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <span className="hand-note">
              a little moment,
              <br />a lasting memory. <MoveUpRight size={32} />
            </span>
            <span className="art-heart">♡</span>
            <div className="floating-tag">
              <Camera size={16} />
              <span>Real moments. Perfectly imperfect.</span>
            </div>
          </div>
        </section>
        <div className="feature-ribbon">
          <span>
            <Camera size={19} /> Your camera, your studio
          </span>
          <i>✧</i>
          <span>
            <Sparkles size={19} /> A frame for every feeling
          </span>
          <i>✧</i>
          <span>
            <Download size={19} /> Ready to save & share
          </span>
          <i>✧</i>
          <span>
            <ShieldCheck size={19} /> No account needed
          </span>
        </div>
        <section className="home-layouts section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR KIND OF FRAME</span>
              <h2>One moment. So many possibilities.</h2>
              <p>
                Classic strips, playful Polaroids, and everything in between.
              </p>
            </div>
            <Link to="/layouts" className="text-link">
              Explore all layouts <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="featured-grid">
            {[
              layouts[0],
              layouts.find((l) => l.name === "2x2 Grid"),
              layouts.find((l) => l.name === "Single Polaroid"),
              layouts.find((l) => l.name === "Classic Film Strip"),
            ].map((layout, i) => (
              <Link
                className="featured-card"
                to="/setup"
                onClick={() => setLayout(layout)}
                key={layout.id}
              >
                <div className={`featured-art art-${i}`}>
                  <img
                    src={layout.thumbnail}
                    alt={`${layout.name} layout preview`}
                  />
                  {i === 0 && <span className="tag">THE CLASSIC</span>}
                  {i === 2 && <span className="mini-star">✧</span>}
                </div>
                <div>
                  <h3>
                    {
                      [
                        "The classic strip",
                        "Better together",
                        "A little nostalgia",
                        "Roll the memories",
                      ][i]
                    }
                  </h3>
                  <ArrowUpRight size={18} />
                </div>
                <p>
                  {layout.name} <span>·</span> {layout.photoCount}{" "}
                  {layout.photoCount === 1 ? "photo" : "photos"}
                </p>
              </Link>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="how section">
          <span className="eyebrow">LESS SETUP. MORE SMILING.</span>
          <h2>Good memories are this simple.</h2>
          <div className="how-grid">
            {[
              [
                Sparkles,
                "01",
                "Make it your own",
                "Pick a layout, find your frame, and add a little personality.",
              ],
              [
                Camera,
                "02",
                "Find your good side",
                "Let the countdown do its thing. You just bring the smiles.",
              ],
              [
                Heart,
                "03",
                "Keep it. Share it. Love it.",
                "Download your photos or save a link to send to your favorite people.",
              ],
            ].map(([Icon, n, title, desc]) => (
              <article key={n}>
                <span className="how-icon">
                  <Icon size={24} />
                  <small>{n}</small>
                </span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="bottom-cta">
          <span>✧</span>
          <h2>
            Your next favorite memory
            <br />
            is a click away.
          </h2>
          <Link className="button" to="/setup">
            Let’s make a little moment <ArrowUpRight size={18} />
          </Link>
          <p>No downloads. No sign-ups. Just smiles.</p>
        </section>
      </main>
    </>
  );
}

````

## frontend/src/pages/Photobooth.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\Photobooth.jsx

````jsx
﻿import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera,
  SwitchCamera,
  Upload,
  Volume2,
  VolumeX,
  ArrowRight,
  X,
} from "lucide-react";
import useCamera from "../hooks/useCamera";
import { useBooth } from "../context/PhotoboothContext";
import { Steps } from "../components/Chrome";
import LayoutPreview from "../components/LayoutPreview";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export default function Photobooth() {
  const booth = useBooth(),
    { layout, photos, setPhotos, preset, notify } = booth;
  const camera = useCamera(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const requestedRetake = params.has("retake")
    ? Number(params.get("retake"))
    : null;
  const retake =
    Number.isInteger(requestedRetake) &&
    requestedRetake >= 0 &&
    requestedRetake < layout.photoCount
      ? requestedRetake
      : null;
  const [countdown, setCountdown] = useState(null),
    [busy, setBusy] = useState(false),
    [flash, setFlash] = useState(false),
    [sound, setSound] = useState(false),
    [mirror, setMirror] = useState(false),
    [current, setCurrent] = useState(0),
    [delay, setDelay] = useState(3);
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );
  async function start() {
    if (busy || camera.status !== "ready") return;
    const token = ++run.current;
    setBusy(true);
    const next = Array.from(
      { length: layout.photoCount },
      (_, i) => photos[i] || null,
    );
    const indices =
      retake !== null && retake >= 0 && retake < layout.photoCount
        ? [retake]
        : next.flatMap((p, i) => (p ? [] : [i]));
    try {
      for (const index of indices) {
        setCurrent(index);
        for (let n = delay; n > 0; n--) {
          setCountdown(n);
          await pause(1000);
          if (token !== run.current) return;
        }
        setCountdown("SMILE!");
        await pause(150);
        if (token !== run.current) return;
        const video = camera.videoRef.current;
        if (!video?.videoWidth)
          throw new Error("The camera is not ready. Please try again.");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        next[index] = {
          src: canvas.toDataURL("image/jpeg", 0.95),
          filter: preset,
          zoom: 1,
          panX: 0,
          panY: 0,
        };
        setPhotos([...next]);
        setFlash(true);
        setCountdown(null);
        if (sound) {
          try {
            const ac = new AudioContext(),
              o = ac.createOscillator(),
              g = ac.createGain();
            o.connect(g);
            g.connect(ac.destination);
            g.gain.value = 0.08;
            o.frequency.value = 700;
            o.start();
            o.stop(ac.currentTime + 0.08);
            o.onended = () => ac.close();
          } catch {
            /* Sound is optional. */
          }
        }
        await pause(180);
        if (token !== run.current) return;
        setFlash(false);
        await pause(650);
        if (token !== run.current) return;
      }
      notify("All captured. Let’s make them yours.");
      navigate("/edit");
    } catch (e) {
      notify(e.message);
    } finally {
      if (token === run.current) {
        setBusy(false);
        setCountdown(null);
        setFlash(false);
      }
    }
  }
  async function upload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const next = Array.from(
        { length: layout.photoCount },
        (_, i) => photos[i] || null,
      );
      let index = retake !== null ? retake : next.findIndex((p) => !p);
      if (index < 0) index = 0;
      for (const file of files) {
        if (index >= layout.photoCount) break;
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error("Choose PNG, JPG or WebP photos under 10 MB.");
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () =>
            reject(new Error("Could not read this photo."));
          reader.readAsDataURL(file);
        });
        next[index] = { src, filter: preset, zoom: 1, panX: 0, panY: 0 };
        if (retake !== null) break;
        index++;
      }
      setPhotos(next);
      if (next.every(Boolean)) navigate("/edit");
      else
        notify(
          `${next.filter(Boolean).length} of ${layout.photoCount} photos ready.`,
        );
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="section camera-page">
      <Steps current={3} />
      <div className="page-title">
        <span className="eyebrow">JUST BE YOURSELF</span>
        <h1>
          {retake !== null
            ? `One more try for photo ${retake + 1}.`
            : "Ready for your little moment?"}
        </h1>
        <p>Get comfortable. Find your light. We’ll count you in.</p>
      </div>
      <div className="capture-workspace">
        <div>
          <div className="camera-stage">
            <video
              ref={camera.videoRef}
              muted
              autoPlay
              playsInline
              style={{
                transform: camera.facing === "user" ? "scaleX(-1)" : "none",
              }}
            />
            <Link to="/setup" className="camera-exit" aria-label="Exit camera">
              <X size={20} />
            </Link>
            <span className="camera-label">
              <span className="live-dot" />
              {busy
                ? `PHOTO ${current + 1} OF ${layout.photoCount}`
                : "YOUR LITTLE STUDIO"}
            </span>
            {camera.status === "loading" && (
              <div className="camera-message">
                <span className="spinner" />
                <p>Opening your camera...</p>
              </div>
            )}
            {camera.error && (
              <div className="camera-message">
                <Camera size={40} />
                <h3>Let’s get your camera ready.</h3>
                <p>{camera.error}</p>
                <button className="button" onClick={camera.open}>
                  Try again
                </button>
              </div>
            )}
            {countdown !== null && (
              <div
                className={`countdown ${typeof countdown === "string" ? "smile" : ""}`}
                aria-live="assertive"
              >
                {countdown}
              </div>
            )}
            {flash && <div className="camera-flash" />}
            <span className="viewfinder tl" />
            <span className="viewfinder tr" />
            <span className="viewfinder bl" />
            <span className="viewfinder br" />
          </div>
          <div className="camera-tools">
            <button
              className="button secondary"
              disabled={busy}
              onClick={camera.switchCamera}
            >
              <SwitchCamera size={17} /> Switch camera
            </button>
            <button
              className="icon-button"
              onClick={() => setSound(!sound)}
              aria-label={sound ? "Turn sound off" : "Turn sound on"}
            >
              {sound ? <Volume2 /> : <VolumeX />}
            </button>
            <label>
              Countdown
              <select
                value={delay}
                disabled={busy}
                onChange={(e) => setDelay(Number(e.target.value))}
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}s
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={mirror}
                disabled={busy}
                onChange={(e) => setMirror(e.target.checked)}
              />{" "}
              Mirror final photo
            </label>
          </div>
          <button
            className="button capture-button"
            disabled={busy || camera.status !== "ready"}
            onClick={start}
          >
            <Camera size={20} />
            {busy
              ? "Making a little memory..."
              : retake !== null
                ? "Retake this photo"
                : "Start session"}
          </button>
          {busy && (
            <button
              className="button secondary"
              onClick={() => {
                run.current++;
                setBusy(false);
                setCountdown(null);
                setFlash(false);
              }}
            >
              Cancel countdown
            </button>
          )}
          <label className={`upload-alternative ${busy ? "disabled" : ""}`}>
            <Upload size={16} /> Or upload your own photos
            <input
              type="file"
              multiple={retake === null}
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={upload}
            />
          </label>
          <div className="capture-thumbnails">
            {Array.from({ length: layout.photoCount }, (_, i) => (
              <div key={i}>
                {photos[i] ? (
                  <img src={photos[i].src} alt={`Captured photo ${i + 1}`} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="preview-sidebar">
          <span className="eyebrow">YOUR FRAME IS WAITING</span>
          <div className="preview-stage">
            <LayoutPreview {...booth} />
          </div>
          <h3>{layout.name}</h3>
          <p>
            {photos.slice(0, layout.photoCount).filter(Boolean).length} /{" "}
            {layout.photoCount} photos ready
          </p>
          {photos.slice(0, layout.photoCount).filter(Boolean).length ===
            layout.photoCount && (
            <button
              className="button"
              disabled={busy}
              onClick={() => navigate("/edit")}
            >
              Edit photos <ArrowRight size={17} />
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}

````

## frontend/src/pages/Result.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\Result.jsx

````jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  CloudUpload,
  Share2,
  QrCode,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useBooth } from "../context/PhotoboothContext";
import { generateCanvas, canvasBlob } from "../utils/canvasGenerator";
import { sessionId } from "../utils/session";
import { api, downloadURL } from "../services/api";
import QRCodeModal from "../components/QRCodeModal";
import { Steps } from "../components/Chrome";
export default function Result() {
  const booth = useBooth(),
    { layout, frame, photos, settings, preset, notify, reset } = booth;
  const [preview, setPreview] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(null),
    [qr, setQr] = useState(false);
  const canvasRef = useRef(null),
    savePromise = useRef(null);
  const complete = Array.from(
    { length: layout.photoCount },
    (_, i) => photos[i],
  ).every(Boolean);
  useEffect(() => {
    let active = true,
      url;
    setSaved(null);
    if (!complete) {
      setLoading(false);
      return;
    }
    setLoading(true);
    generateCanvas({ layout, frame, photos, settings, preset })
      .then(async (canvas) => {
        const blob = await canvasBlob(canvas);
        url = URL.createObjectURL(blob);
        if (active) {
          canvasRef.current = canvas;
          setPreview(url);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [layout, frame, photos, settings, preset, complete]);
  async function download(ext) {
    try {
      const blob = await canvasBlob(
        canvasRef.current,
        ext === "jpg" ? "image/jpeg" : "image/png",
      );
      const url = URL.createObjectURL(blob);
      await downloadURL(url, ext);
      URL.revokeObjectURL(url);
      notify("Photobooth downloaded!");
    } catch (e) {
      notify(e.message);
    }
  }
  async function save() {
    if (saved) return saved;
    if (savePromise.current) return savePromise.current;
    setSaving(true);
    savePromise.current = (async () => {
      const blob = await canvasBlob(canvasRef.current);
      if (blob.size > 10 * 1024 * 1024)
        throw new Error(
          "This image exceeds the 10 MB cloud limit. Download it instead, or choose a smaller layout.",
        );
      const form = new FormData();
      form.append("image", blob, "photobooth.png");
      Object.entries({
        session_id: sessionId(),
        layout: layout.id,
        frame: frame.id,
        photo_count: layout.photoCount,
        event_name: settings.showEvent ? settings.eventName : "",
        custom_text: settings.showMessage ? settings.message : "",
      }).forEach(([k, v]) => form.append(k, v));
      const result = await api.save(form);
      setSaved(result);
      notify("Photo saved successfully!");
      return result;
    })();
    try {
      return await savePromise.current;
    } finally {
      savePromise.current = null;
      setSaving(false);
    }
  }
  async function share(showQR = false) {
    try {
      const photo = await save();
      const url = photo.share_url || `${location.origin}/photo/${photo.id}`;
      if (showQR) {
        setQr(url);
        return;
      }
      if (navigator.share) {
        try {
          await navigator.share({
            title: settings.eventName || "A little moment",
            url,
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        notify("Share link copied!");
      } catch {
        setQr(url);
      }
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <main className="section result-page">
      <Steps current={4} />
      <div className="page-title">
        <span className="eyebrow">A MOMENT WORTH KEEPING</span>
        <h1>And just like that, a memory.</h1>
        <p>
          Made by you. Ready for your camera roll, your wall, or someone
          special.
        </p>
      </div>
      {!complete ? (
        <div className="empty-state">
          <h3>Your photos are waiting.</h3>
          <p>Take or upload photos to create your photobooth.</p>
          <Link to="/photobooth" className="button">
            Open photobooth
          </Link>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <Link to="/edit" className="button">
            Back to editor
          </Link>
        </div>
      ) : (
        <div className="result-workspace">
          <div className="result-art">
            {loading ? (
              <div className="loading">
                <span className="spinner" />
                Generating high-resolution image...
              </div>
            ) : (
              <img src={preview} alt="Your finished photobooth" />
            )}
            <span className="result-spark">✧</span>
          </div>
          <div className="result-controls">
            <span className="pill">
              <Check size={14} /> ONE OF A KIND. JUST LIKE YOU.
            </span>
            <h2>{settings.eventName || "Your little masterpiece"}</h2>
            <p>
              {layout.name} · {frame.name}
              <br />
              {layout.width} × {layout.height} pixels
            </p>
            <div className="download-buttons">
              <button
                className="button"
                disabled={loading}
                onClick={() => download("png")}
              >
                <Download size={18} /> Download PNG
              </button>
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => download("jpg")}
              >
                JPG
              </button>
            </div>
            <button
              className="button secondary full"
              disabled={loading || saving || !!saved}
              onClick={() => save().catch((e) => notify(e.message))}
            >
              {saving ? (
                <span className="spinner" />
              ) : (
                <CloudUpload size={18} />
              )}{" "}
              {saving
                ? "Saving your memory..."
                : saved
                  ? "Saved to your gallery"
                  : "Save to my gallery"}
            </button>
            <div className="download-buttons">
              <button
                className="button secondary"
                disabled={loading || saving}
                onClick={() => share()}
              >
                <Share2 size={17} /> Share link
              </button>
              <button
                className="button secondary"
                disabled={loading || saving}
                onClick={() => share(true)}
              >
                <QrCode size={17} /> QR code
              </button>
            </div>
            <p className="help-text">
              Save creates a shareable link. Anyone with that link can view your
              memory.
              {saved?.expires_at &&
                ` Available until ${new Date(saved.expires_at).toLocaleDateString()}.`}
            </p>
            <hr />
            <div className="result-edit-links">
              <Link to="/edit">Edit photos</Link>
              <Link to="/setup?step=frame">Change frame</Link>
              <Link to="/setup">Change layout</Link>
              <Link to="/photobooth" onClick={() => booth.setPhotos([])}>
                Retake all
              </Link>
            </div>
            <Link className="text-link" to="/setup" onClick={reset}>
              Make another little moment <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      )}
      {qr && <QRCodeModal url={qr} onClose={() => setQr(false)} />}
    </main>
  );
}

````

## frontend/src/pages/Setup.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\Setup.jsx

````jsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { Steps } from "../components/Chrome";
import LayoutSelector from "../components/LayoutSelector";
import LayoutPreview from "../components/LayoutPreview";
import { useBooth } from "../context/PhotoboothContext";
import { frames } from "../utils/frames";
import { filters } from "../utils/filters";
export default function Setup({ library = false }) {
  const [params] = useSearchParams();
  const [step, setStep] = useState(params.get("step") === "frame" ? 2 : 1);
  const navigate = useNavigate();
  const booth = useBooth();
  const {
    layout,
    frame,
    setFrame,
    settings,
    setSettings,
    preset,
    setPreset,
    photos,
    notify,
  } = booth;
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  async function logo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg"].includes(f.type) ||
      f.size > 2 * 1024 * 1024
    )
      return notify("Choose a PNG or JPG logo under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => change("logo", reader.result);
    reader.readAsDataURL(f);
  }
  return (
    <main className="section setup-page">
      <Steps current={step} />
      <div className="page-title">
        <span className="eyebrow">
          {step === 1
            ? "A LITTLE SPACE FOR YOUR MEMORIES"
            : "THE DETAILS MAKE IT YOURS"}
        </span>
        <h1>
          {step === 1
            ? library
              ? "Find your perfect layout."
              : "Every memory starts with a frame."
            : "Add a little personality."}
        </h1>
        <p>
          {step === 1
            ? "Pick a layout that feels like you. We’ll take care of the rest."
            : "Choose a color, leave a message, make it unmistakably you."}
        </p>
      </div>
      {step === 1 ? (
        <LayoutSelector
          onContinue={() => {
            setStep(2);
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <div className="layout-workspace">
          <div className="settings-panel">
            <button className="text-link" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back to layouts
            </button>
            <h2>Find your feeling</h2>
            <div className="frame-grid">
              {frames.map((f) => (
                <button
                  className={f.id === frame.id ? "selected" : ""}
                  key={f.id}
                  aria-label={f.name}
                  onClick={() => setFrame(f)}
                >
                  <span
                    style={{
                      background: f.backgroundColor,
                      color: f.textColor,
                    }}
                  >
                    a little
                    <br />
                    <em>moment</em>
                    {f.decoration && <i>✧</i>}
                  </span>
                  {f.name}
                </button>
              ))}
            </div>
            <h2>A few words to remember</h2>
            <label>
              Event name
              <input
                maxLength={100}
                value={settings.eventName}
                onChange={(e) => change("eventName", e.target.value)}
                placeholder="Best day ever"
              />
            </label>
            <label>
              Your message
              <input
                maxLength={240}
                value={settings.message}
                onChange={(e) => change("message", e.target.value)}
              />
            </label>
            <div className="field-grid">
              <label>
                Date
                <input
                  type="date"
                  value={settings.date}
                  onChange={(e) => change("date", e.target.value)}
                />
              </label>
              <label>
                Filter preset
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                >
                  {filters.map((f) => (
                    <option key={f.name}>{f.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="checkbox-row">
              {[
                ["showEvent", "Event name"],
                ["showMessage", "Message"],
                ["showDate", "Date"],
                ["showLogo", "Logo"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => change(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="upload-label">
              <Upload size={16} />{" "}
              {settings.logo ? "Replace logo" : "Add your logo"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={logo}
              />
            </label>
            {settings.logo && (
              <button
                className="text-link"
                onClick={() => change("logo", null)}
              >
                Remove logo
              </button>
            )}
            <details>
              <summary>Customize layout</summary>
              <label>
                QR destination (optional)
                <input
                  type="url"
                  maxLength={1000}
                  placeholder="https://example.com/event"
                  value={settings.qrURL || ""}
                  onChange={(e) => change("qrURL", e.target.value)}
                />
              </label>
              {layout.category === "Magazine" && (
                <label>
                  Magazine title
                  <input
                    maxLength={40}
                    value={settings.magazineTitle || "MEMORIES"}
                    onChange={(e) => change("magazineTitle", e.target.value)}
                  />
                </label>
              )}
              <div className="field-grid">
                {[
                  ["spacing", "Photo spacing", 0, 120],
                  ["margin", "Outer margin", 0, 150],
                  ["radius", "Corner radius", 0, 180],
                  ["borderWidth", "Border width", 0, 30],
                ].map(([key, label, min, max]) => (
                  <label key={key}>
                    {label} <span>{settings[key]} px</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={settings[key]}
                      onChange={(e) => change(key, Number(e.target.value))}
                    />
                  </label>
                ))}
                <label>
                  Background
                  <input
                    type="color"
                    value={
                      settings.background ||
                      layout.background ||
                      frame.backgroundColor
                    }
                    onChange={(e) => change("background", e.target.value)}
                  />
                </label>
                <label>
                  Border color
                  <input
                    type="color"
                    value={settings.borderColor || frame.borderColor}
                    onChange={(e) => change("borderColor", e.target.value)}
                  />
                </label>
                <label>
                  Text placement
                  <select
                    value={settings.textPlacement}
                    onChange={(e) => change("textPlacement", e.target.value)}
                  >
                    <option value="bottom">Bottom</option>
                    <option value="top">Top overlay</option>
                  </select>
                </label>
                <label>
                  Footer text
                  <input
                    maxLength={80}
                    value={settings.footer}
                    onChange={(e) => change("footer", e.target.value)}
                  />
                </label>
              </div>
              <div className="checkbox-row">
                {[
                  ["showHeader", "Show title"],
                  ["showFooter", "Show footer"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => change(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                className="text-link"
                onClick={() => change("background", undefined)}
              >
                Use frame background
              </button>
            </details>
          </div>
          <aside className="preview-sidebar">
            <span className="eyebrow">LOOKING GOOD ALREADY</span>
            <div className="preview-stage">
              <LayoutPreview {...{ layout, frame, settings, preset, photos }} />
            </div>
            <h3>{layout.name}</h3>
            <p>
              {frame.name} · {layout.photoCount} photos
            </p>
            <button
              className="button"
              onClick={() =>
                navigate(
                  photos.slice(0, layout.photoCount).filter(Boolean).length ===
                    layout.photoCount
                    ? "/edit"
                    : "/photobooth",
                )
              }
            >
              {photos.length
                ? "Continue with photos"
                : "Let’s take some photos"}{" "}
              <ArrowRight size={17} />
            </button>
            <small>Your camera opens on the next step.</small>
          </aside>
        </div>
      )}
    </main>
  );
}

````

## frontend/src/pages/SharedPhoto.jsx

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\pages\SharedPhoto.jsx

````jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Share2, QrCode } from "lucide-react";
import { api, imageURL, downloadURL } from "../services/api";
import { useBooth } from "../context/PhotoboothContext";
import QRCodeModal from "../components/QRCodeModal";
export default function SharedPhoto() {
  const { id } = useParams(),
    { notify } = useBooth();
  const [photo, setPhoto] = useState(null),
    [error, setError] = useState(""),
    [qr, setQr] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    setError("");
    api
      .get(id)
      .then((p) => active && setPhoto(p))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: photo.event_name || "A little moment",
          url: location.href,
        });
      else {
        await navigator.clipboard.writeText(location.href);
        notify("Share link copied!");
      }
    } catch (e) {
      if (e.name !== "AbortError") setQr(true);
    }
  }
  return (
    <main className="section shared-page">
      {error ? (
        <div className="empty-state">
          <h1>This moment isn’t here.</h1>
          <p role="alert">{error}</p>
          <Link className="button" to="/setup">
            Make your own memory
          </Link>
        </div>
      ) : !photo ? (
        <div className="loading">
          <span className="spinner" />
          Opening a little memory...
        </div>
      ) : (
        <>
          <div className="page-title">
            <span className="eyebrow">SOME MOMENTS ARE MEANT TO BE SHARED</span>
            <h1>{photo.event_name || "A little moment, just for you."}</h1>
            <p>
              {new Date(photo.created_at).toLocaleDateString()}
              {photo.expires_at &&
                ` · Available until ${new Date(photo.expires_at).toLocaleDateString()}`}
            </p>
          </div>
          <div className="shared-image">
            <img
              src={imageURL(photo)}
              alt={photo.event_name || "Shared photobooth"}
            />
          </div>
          <div className="shared-actions">
            <button
              className="button"
              onClick={() =>
                downloadURL(imageURL(photo)).catch((e) => notify(e.message))
              }
            >
              <Download size={18} /> Download
            </button>
            <button className="button secondary" onClick={share}>
              <Share2 size={18} /> Share
            </button>
            <button className="button secondary" onClick={() => setQr(true)}>
              <QrCode size={18} /> QR code
            </button>
          </div>
          <Link to="/setup" className="text-link">
            Make your own little moment →
          </Link>
        </>
      )}
      {qr && <QRCodeModal url={location.href} onClose={() => setQr(false)} />}
    </main>
  );
}

````

## frontend/src/services/api.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\services\api.js

````javascript
import { sessionId } from "../utils/session";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const imageURL = (photo) =>
  photo.image_url.startsWith("/") ? base + photo.image_url : photo.image_url;
async function request(path, options = {}) {
  const response = await fetch(`${base}/api/photobooths${path}`, {
    ...options,
    headers: { "X-Session-Id": sessionId(), ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return response.status === 204 ? null : response.json();
}
export const api = {
  save: (form) => request("", { method: "POST", body: form }),
  get: (id) => request(`/${id}`),
  list: () => request(`/session/${sessionId()}`),
  remove: (id) => request(`/${id}`, { method: "DELETE" }),
};
export async function downloadURL(url, extension = "png") {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to download this photo.");
  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectURL;
  a.download = `photobooth-${new Date().toISOString().slice(0, 10)}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
}

````

## frontend/src/styles.css

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\styles.css

````css
@import "tailwindcss";
@theme {
  --color-sage: #4d6349;
  --color-paper: #faf8f4;
  --font-sans: "Segoe UI", Arial, sans-serif;
}
:root {
  font-family: "Segoe UI", Arial, sans-serif;
  color: #303a2e;
  background: #faf8f4;
  font-synthesis: none;
  font-weight: 400;
  --green: #4d6349;
  --ink: #303a2e;
  --muted: #7b7e73;
  --line: #e4e4db;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
a {
  color: inherit;
  text-decoration: none;
}
button,
input,
select {
  font: inherit;
}
button,
a,
label,
summary {
  -webkit-tap-highlight-color: transparent;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
button {
  color: inherit;
}
button:not(.button) {
  border: 0;
}
button,
input,
select {
  outline-offset: 4px;
}
button:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 2px solid #718a62;
  outline-offset: 4px;
}
input,
select {
  min-width: 0;
  border: 1px solid #dddcd2;
  border-radius: 8px;
  background: #fffefa;
  color: #394233;
  padding: 11px 13px;
  width: 100%;
}
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--green);
}
input[type="range"] {
  padding: 8px 0;
  accent-color: var(--green);
  border: none;
  background: none;
}
input[type="color"] {
  height: 43px;
  padding: 4px;
}
select {
  cursor: pointer;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1,
h2 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 400;
  letter-spacing: -1.5px;
}
h3 {
  font-weight: 600;
  font-size: 16px;
}
p {
  line-height: 1.75;
}
svg {
  flex-shrink: 0;
}
label {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 25px 0;
}
.navbar {
  height: 94px;
  max-width: 1320px;
  padding: 0 52px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: Georgia, serif;
  font-size: 23px;
  font-weight: bold;
  letter-spacing: -0.8px;
  white-space: nowrap;
}
.brand-icon {
  width: 37px;
  height: 33px;
  border: 1.6px solid #46573e;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-6deg);
}
.brand-dot {
  font-family: Arial, sans-serif;
  font-size: 10px;
  align-self: flex-start;
  margin: 4px 0 0 -6px;
}
.navbar nav {
  display: flex;
  gap: 30px;
  font-size: 13px;
  color: #606558;
}
.navbar nav a:hover,
.navbar nav a.active {
  color: #303e2c;
}
.button {
  background: var(--green);
  color: #fffef6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  border: 1px solid var(--green);
  border-radius: 7px;
  padding: 15px 22px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  transition:
    background 0.18s,
    transform 0.18s;
}
.button:hover:not(:disabled) {
  background: #3a5037;
  transform: translateY(-1px);
}
.button.small {
  padding: 12px 17px;
  font-size: 12px;
}
.button.secondary {
  background: transparent;
  border-color: #d4d8cc;
  color: #46553f;
}
.button.secondary:hover:not(:disabled) {
  background: #eef0e7;
}
.text-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: none;
  font-size: 13px;
  font-weight: 600;
  color: #4b6045;
}
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border-radius: 7px;
}
.icon-button:hover {
  background: #e9ede2;
}
.section {
  max-width: 1216px;
  margin: auto;
  padding: 70px 0;
}
.eyebrow {
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
  line-height: 1.6;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #eef0e5;
  border: 1px solid #e0e4d6;
  border-radius: 20px;
  padding: 7px 11px;
  font-size: 9px;
  letter-spacing: 1.2px;
}
.live-dot {
  height: 6px;
  width: 6px;
  background: #789366;
  border-radius: 50%;
  display: inline-block;
}
.hero {
  max-width: 1216px;
  margin: 0 auto;
  min-height: 641px;
  display: grid;
  grid-template-columns: 1.03fr 1fr;
  align-items: center;
  gap: 45px;
  padding: 53px 0 57px;
}
.hero-copy {
  padding-bottom: 4px;
}
.hero h1 {
  font-size: 73px;
  line-height: 1.09;
  position: relative;
  margin: 25px 0 24px;
  letter-spacing: -3.7px;
}
.hero h1 em {
  font-weight: 400;
  color: #718266;
  position: relative;
}
.hero h1 em:after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -5px;
  width: 100%;
  height: 9px;
  border-top: 2px solid #abb39b;
  border-radius: 50%;
  transform: rotate(-2deg);
}
.sketch-spark {
  display: inline-block;
  vertical-align: top;
  font-family: Georgia, serif;
  color: #87956f;
  font-size: 55px;
  margin: -13px 0 0 14px;
  font-weight: normal;
}
.hero-copy > p {
  font-size: 14px;
  color: #7c7e72;
  line-height: 1.9;
}
.hero-cta {
  margin-top: 28px;
  padding: 17px 24px;
  gap: 24px;
}
.hero-promises {
  display: flex;
  gap: 17px;
  font-size: 10px;
  color: #787d6e;
  margin-top: 19px;
}
.hero-promises span {
  display: flex;
  gap: 5px;
  align-items: center;
}
.hero-promises svg {
  color: #778b68;
}
.love-note {
  display: flex;
  gap: 13px;
  align-items: center;
  margin-top: 32px;
}
.tiny-faces {
  display: flex;
  padding-left: 6px;
}
.tiny-faces i {
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  border: 2px solid #faf8f4;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #d3b797;
  color: #584f3e;
  margin-left: -6px;
  font-size: 26px;
  line-height: 1;
}
.tiny-faces i:nth-child(2) {
  background: #b9c2ab;
}
.tiny-faces i:nth-child(3) {
  background: #e2c3b8;
}
.stars {
  font-size: 10px;
  letter-spacing: 2px;
  color: #9b9567;
}
.love-note p {
  font-size: 10px;
  color: #7b7d71;
  margin-top: 3px;
}
.hero-art {
  position: relative;
  height: 509px;
}
.orbit {
  position: absolute;
  width: 420px;
  height: 420px;
  background: #eeeee2;
  border-radius: 50%;
  left: 48px;
  top: 39px;
}
.orbit:after {
  content: "";
  position: absolute;
  inset: -16px;
  border: 1px dashed #dfe3d4;
  border-radius: 50%;
}
.sample-strip {
  position: absolute;
  padding: 11px 11px 17px;
  width: 191px;
  box-shadow: 0 13px 23px #40392520;
  background: #fffdf8;
  text-align: center;
}
.strip-one {
  left: 59px;
  top: 40px;
  transform: rotate(-12deg);
  z-index: 1;
}
.strip-two {
  left: 267px;
  top: 81px;
  transform: rotate(11deg);
  background: #d9dfc9;
  z-index: 2;
}
.sample-photo {
  height: 105px;
  margin-bottom: 8px;
  overflow: hidden;
  position: relative;
  text-align: left;
  padding: 12px;
  isolation: isolate;
}
.sample-photo b {
  font-family: Georgia, serif;
  font-size: 24px;
  line-height: 0.96;
  font-weight: 400;
  position: relative;
  z-index: 2;
  letter-spacing: -1px;
}
.sample-photo span {
  position: absolute;
  right: 8px;
  top: 4px;
  font-size: 76px;
  line-height: 1;
  opacity: 0.9;
}
.sample-photo:after {
  content: "";
  position: absolute;
  width: 120px;
  height: 120px;
  border: 1px solid #ffffff40;
  border-radius: 50%;
  left: 70px;
  top: 20px;
  z-index: -1;
}
.scene-one {
  background: #adbaa0;
  color: #f9f8e8;
}
.scene-two {
  background: #cfb493;
  color: #fff8e8;
}
.scene-three {
  background: #8b9c83;
  color: #f5f1d7;
}
.scene-four {
  background: #d6a99a;
  color: #763d37;
}
.scene-five {
  background: #dccc9c;
  color: #777547;
}
.scene-six {
  background: #a6b1a0;
  color: #f9f7e9;
}
.sample-strip p {
  font:
    italic 17px Georgia,
    serif;
  margin-top: 16px;
  line-height: 1.2;
}
.sample-strip small {
  font-size: 7px;
  letter-spacing: 1.5px;
  display: block;
  margin-top: 8px;
}
.tape {
  position: absolute;
  height: 31px;
  width: 82px;
  background: #c4bd956e;
  z-index: 4;
  clip-path: polygon(2% 0, 97% 4%, 100% 95%, 0 100%);
}
.tape-one {
  left: 118px;
  top: 23px;
  transform: rotate(-19deg);
}
.tape-two {
  left: 333px;
  top: 60px;
  transform: rotate(19deg);
}
.art-star {
  position: absolute;
  right: 7px;
  top: 6px;
  font-size: 69px;
  font-family: Georgia, serif;
  color: #949d80;
  transform: rotate(12deg);
}
.art-heart {
  position: absolute;
  left: 8px;
  bottom: 65px;
  font:
    55px Georgia,
    serif;
  color: #a2aa8e;
  transform: rotate(-18deg);
}
.hand-note {
  position: absolute;
  right: -6px;
  bottom: 0;
  font:
    italic 19px/1.25 Georgia,
    serif;
  color: #7a846c;
  transform: rotate(-8deg);
  z-index: 5;
}
.hand-note svg {
  position: absolute;
  right: 35px;
  top: -42px;
  transform: rotate(-20deg);
}
.floating-tag {
  position: absolute;
  z-index: 5;
  bottom: 2px;
  left: 50px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fffdf7;
  border: 1px solid #e5e2d7;
  border-radius: 6px;
  padding: 12px 15px;
  box-shadow: 0 4px 10px #33333306;
  font-size: 9px;
  color: #747b66;
  transform: rotate(-3deg);
}
.feature-ribbon {
  padding: 24px 45px;
  background: #f0f1e9;
  border-block: 1px solid #e5e6dc;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 39px;
  font-size: 12px;
  color: #64705a;
}
.feature-ribbon span {
  display: flex;
  align-items: center;
  gap: 10px;
}
.feature-ribbon i {
  font-style: normal;
  color: #b5bca8;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}
.section-heading h2 {
  font-size: 35px;
  margin-top: 10px;
}
.section-heading p {
  font-size: 13px;
  color: #7d8074;
  margin-top: 10px;
}
.section-heading > .text-link {
  align-self: flex-end;
  padding-bottom: 6px;
  white-space: nowrap;
}
.home-layouts {
  padding-top: 65px;
  padding-bottom: 62px;
}
.featured-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 23px;
}
.featured-card {
  display: block;
}
.featured-art {
  position: relative;
  height: 247px;
  border-radius: 9px;
  background: #ecece3;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.featured-art img {
  height: 183px;
  width: auto;
  max-width: 80%;
  box-shadow: 1px 8px 12px #3d493219;
  transform: rotate(-7deg);
}
.art-1 {
  background: #ede5dd;
}
.art-1 img {
  height: 168px;
  transform: rotate(6deg);
}
.art-2 {
  background: #e6e9e0;
}
.art-2 img {
  height: 179px;
  transform: rotate(-8deg);
}
.art-3 {
  background: #e8e6de;
}
.art-3 img {
  transform: rotate(8deg);
}
.tag {
  position: absolute;
  top: 15px;
  left: 14px;
  font-size: 7px;
  letter-spacing: 1.4px;
  background: #fffdf4;
  padding: 6px 9px;
  border-radius: 3px;
}
.mini-star {
  font:
    60px Georgia,
    serif;
  position: absolute;
  right: 25px;
  bottom: 12px;
  color: #8e9c7f;
}
.featured-card > div:nth-child(2) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 17px;
}
.featured-card h3 {
  font-size: 14px;
}
.featured-card > p {
  font-size: 11px;
  color: #929486;
  margin-top: 7px;
}
.featured-card > p span {
  margin: 0 5px;
}
.featured-card:hover img {
  transform: rotate(0);
  transition: transform 0.25s;
}
.how {
  border-top: 1px solid var(--line);
  text-align: center;
  padding-top: 54px;
  padding-bottom: 58px;
}
.how > h2 {
  font-size: 35px;
  margin-top: 12px;
}
.how-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 70px;
  margin: 40px 55px 0;
}
.how-grid article {
  display: flex;
  align-items: center;
  flex-direction: column;
}
.how-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 55px;
  height: 55px;
  background: #edf0e4;
  border: 1px solid #dce3d2;
  border-radius: 14px;
  color: #697e59;
  margin-bottom: 20px;
  transform: rotate(-5deg);
}
.how-icon small {
  position: absolute;
  top: -7px;
  right: -12px;
  font-size: 9px;
  background: #faf8f4;
  border: 1px solid #dce3d2;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}
.how-grid h3 {
  font-size: 14px;
}
.how-grid p {
  font-size: 12px;
  color: #838578;
  line-height: 1.8;
  margin-top: 10px;
}
.bottom-cta {
  margin: 10px auto 70px;
  max-width: 1216px;
  background: #edf0e6;
  border: 1px solid #e2e6d9;
  border-radius: 12px;
  padding: 36px;
  text-align: center;
  position: relative;
}
.bottom-cta > span {
  position: absolute;
  left: 20%;
  top: 43px;
  font: 77px Georgia;
  color: #a1ac90;
}
.bottom-cta h2 {
  font-size: 36px;
  line-height: 1.2;
}
.bottom-cta .button {
  margin-top: 24px;
}
.bottom-cta p {
  font-size: 10px;
  color: #8b907e;
  margin-top: 14px;
}
footer {
  border-top: 1px solid var(--line);
  max-width: 1320px;
  margin: auto;
  padding: 28px 52px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
footer .brand {
  font-size: 18px;
}
footer > span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #929487;
}
.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 47px;
}
.steps > div {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  color: #999e8f;
}
.steps span {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid #d9ddce;
  border-radius: 50%;
  font-size: 10px;
}
.steps .active {
  color: #4b6343;
}
.steps .active span {
  background: #e6ebdc;
  border-color: #bdc9ae;
}
.steps i {
  width: 64px;
  height: 1px;
  background: #dfe3d7;
  margin: 0 16px;
}
.page-title {
  text-align: center;
  margin-bottom: 43px;
}
.page-title h1 {
  font-size: 43px;
  line-height: 1.15;
  margin: 12px 0 16px;
}
.page-title p {
  font-size: 13px;
  color: #85897b;
}
.setup-page {
  padding-top: 36px;
}
.layout-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 35px;
  align-items: start;
}
.search-row {
  display: flex;
  gap: 12px;
}
.search-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  border: 1px solid #dfe2d6;
  background: #fffefb;
  border-radius: 8px;
  padding: 0 13px;
  flex: 1;
  color: #87947a;
}
.search-input input {
  border: 0;
  background: none;
  padding: 13px 0;
  outline: none;
}
.search-row .button {
  padding: 12px 16px;
}
.category-chips {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 20px 0 12px;
  scrollbar-width: thin;
  flex-wrap: wrap;
}
.category-chips button {
  font-size: 11px;
  padding: 8px 13px;
  border-radius: 20px;
  background: #f0f0e8;
  white-space: nowrap;
}
.category-chips button.selected {
  background: #4d6349;
  color: white;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0 20px;
  font-size: 11px;
  color: #89917e;
}
.filter-row > span {
  margin-right: auto;
}
.filter-row select {
  width: auto;
  font-size: 10px;
  padding: 7px;
}
.layout-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
}
.layout-card {
  position: relative;
  border: 1px solid #e3e5da;
  border-radius: 9px;
  background: #fffdf8;
  overflow: hidden;
  padding: 8px;
  transition: border-color 0.15s;
}
.layout-card.chosen {
  border: 2px solid #789267;
  padding: 7px;
  background: #f3f5ec;
}
.layout-select {
  background: none;
  width: 100%;
  text-align: left;
  padding: 0;
}
.layout-thumb {
  height: 175px;
  border-radius: 5px;
  background: #eeeee5;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.layout-thumb img {
  max-width: 77%;
  max-height: 145px;
  box-shadow: 2px 4px 7px #27391e15;
}
.layout-card h3 {
  font-size: 12px;
  margin: 12px 4px 4px;
}
.layout-card p {
  font-size: 10px;
  color: #8c9383;
  margin: 0 4px 5px;
}
.favorite {
  position: absolute;
  right: 12px;
  top: 12px;
  background: #fffdf2b0;
  width: 28px;
  height: 28px;
}
.hearted {
  color: #ad6b74;
}
.selected-badge {
  position: absolute;
  bottom: 9px;
  right: 9px;
  display: grid;
  place-items: center;
  background: #6a845d;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.preview-sidebar {
  position: sticky;
  top: 25px;
  border: 1px solid #e0e3d5;
  border-radius: 11px;
  background: #f3f4ec;
  padding: 23px;
  text-align: center;
}
.preview-sidebar > .eyebrow {
  font-size: 8px;
  letter-spacing: 1.7px;
}
.preview-stage {
  height: 340px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 10px;
}
.layout-preview {
  max-height: 100%;
  max-width: 100%;
  display: flex;
  justify-content: center;
}
.layout-preview > div {
  max-height: inherit;
  display: flex;
  justify-content: center;
  max-width: 100%;
}
.layout-preview canvas {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  width: auto;
  height: auto;
  box-shadow: 0 7px 17px #33432817;
}
.preview-sidebar h3 {
  font:
    21px Georgia,
    serif;
  letter-spacing: -0.5px;
  margin: 10px 0;
}
.preview-sidebar p {
  font-size: 11px;
  color: #818976;
  margin: 8px 0 20px;
}
.preview-sidebar > .button {
  width: 100%;
}
.preview-sidebar > small {
  display: block;
  font-size: 9px;
  color: #929985;
  margin-top: 12px;
}
.preview-sidebar > .text-link {
  margin-top: 18px;
  font-size: 11px;
}
.settings-panel {
  background: #fffdf8;
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 28px;
}
.settings-panel h2 {
  font-size: 25px;
  margin: 26px 0 19px;
}
.frame-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 13px;
}
.frame-grid button {
  background: none;
  padding: 4px;
  border-radius: 6px;
  font-size: 9px;
  text-align: center;
}
.frame-grid button > span {
  height: 89px;
  display: flex;
  position: relative;
  flex-direction: column;
  justify-content: center;
  border: 1px solid #00000009;
  border-radius: 4px;
  margin-bottom: 8px;
  font:
    14px Georgia,
    serif;
}
.frame-grid button i {
  position: absolute;
  right: 8px;
  top: 5px;
  font-size: 18px;
}
.frame-grid button.selected {
  outline: 2px solid #879c72;
}
.settings-panel > label {
  margin: 17px 0;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0;
}
.checkbox-row {
  display: flex;
  gap: 20px;
  margin: 21px 0;
  flex-wrap: wrap;
}
.checkbox-row label,
.inline-check {
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 7px;
  font-size: 11px;
  color: #757e6b;
}
.upload-label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 15px;
  border: 1px dashed #cbd3c0;
  border-radius: 7px;
  width: max-content;
  cursor: pointer;
  font-size: 12px;
}
.upload-label input,
.upload-alternative input {
  display: none;
}
details {
  border-top: 1px solid var(--line);
  padding: 20px 0 0;
  margin-top: 24px;
}
summary {
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
details > label {
  margin-top: 18px;
}
.camera-page {
  padding-top: 36px;
}
.capture-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 30px;
}
.camera-stage {
  position: relative;
  background: #e4e9dd;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4/3;
}
.camera-stage video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.camera-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  padding: 35px;
  background: #e8ecdf;
  color: #53654a;
}
.camera-message p {
  font-size: 13px;
  max-width: 390px;
  margin: 15px 0;
}
.camera-message h3 {
  font:
    25px Georgia,
    serif;
  margin-top: 18px;
}
.camera-message .button {
  margin-top: 10px;
}
.camera-label {
  position: absolute;
  top: 21px;
  left: 23px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9faf2df;
  border-radius: 20px;
  padding: 8px 11px;
  font-size: 8px;
  letter-spacing: 1.4px;
  z-index: 2;
}
.camera-exit {
  position: absolute;
  right: 18px;
  top: 18px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #ffffffb0;
  display: grid;
  place-items: center;
  z-index: 3;
}
.viewfinder {
  position: absolute;
  width: 30px;
  height: 30px;
  border-color: #ffffff70;
  border-style: solid;
  pointer-events: none;
}
.tl {
  top: 75px;
  left: 22px;
  border-width: 2px 0 0 2px;
}
.tr {
  top: 75px;
  right: 22px;
  border-width: 2px 2px 0 0;
}
.bl {
  bottom: 22px;
  left: 22px;
  border-width: 0 0 2px 2px;
}
.br {
  bottom: 22px;
  right: 22px;
  border-width: 0 2px 2px 0;
}
.countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: white;
  font-size: 130px;
  text-shadow: 0 3px 20px #0005;
  font-family: Georgia, serif;
  background: #0002;
  z-index: 4;
}
.countdown.smile {
  font-size: 65px;
}
.camera-flash {
  position: absolute;
  inset: 0;
  background: white;
  z-index: 5;
}
.camera-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 17px;
}
.camera-tools label {
  flex-direction: row;
  align-items: center;
  font-size: 10px;
}
.camera-tools select {
  padding: 8px;
  width: auto;
}
.camera-tools .button {
  padding: 10px 12px;
  font-size: 11px;
}
.capture-button {
  display: flex;
  margin: 22px auto 0;
  padding: 17px 36px;
}
.upload-alternative {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
  gap: 8px;
  font-size: 11px;
  color: #87947b;
  cursor: pointer;
  margin-top: 18px;
}
.capture-thumbnails {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin: 27px 0;
}
.capture-thumbnails > div {
  width: 68px;
  aspect-ratio: 4/3;
  background: #e8ecdf;
  border: 1px solid #dce3d3;
  border-radius: 5px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #94a388;
  font-size: 12px;
}
.capture-thumbnails img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.edit-thumbnails {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 3px 15px;
}
.edit-thumbnails button {
  position: relative;
  padding: 3px;
  background: #e9eddf;
  border-radius: 7px;
  flex-shrink: 0;
  width: 83px;
  height: 70px;
}
.edit-thumbnails img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}
.edit-thumbnails button.selected {
  outline: 2px solid #7b9169;
}
.edit-thumbnails small {
  position: absolute;
  bottom: 5px;
  right: 6px;
  background: #ffffffe0;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  font-size: 9px;
  display: grid;
  place-items: center;
}
.edit-thumbnails span {
  font-size: 9px;
}
.edit-photo {
  height: 365px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e7eadf;
  border-radius: 10px;
  overflow: hidden;
}
.edit-photo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.edit-actions {
  display: flex;
  gap: 9px;
  align-items: center;
  margin: 15px 0 28px;
  flex-wrap: wrap;
}
.edit-actions .button {
  font-size: 11px;
  padding: 10px 13px;
}
.editor-panel .section-heading {
  margin: 0 0 17px;
}
.filter-presets {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 3px 3px 12px;
}
.filter-presets button {
  width: 79px;
  flex-shrink: 0;
  background: none;
  padding: 4px;
  border-radius: 7px;
}
.filter-presets img {
  width: 100%;
  height: 62px;
  border-radius: 5px;
  object-fit: cover;
  margin-bottom: 8px;
}
.filter-presets span {
  font-size: 9px;
  white-space: nowrap;
}
.filter-presets button.selected {
  outline: 2px solid #789368;
}
.help-text {
  font-size: 10px;
  color: #8b9480;
  line-height: 1.7;
  margin-top: 15px;
}
.capitalize {
  text-transform: capitalize;
}
.result-workspace {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 80px;
  align-items: center;
  max-width: 980px;
  margin: auto;
}
.result-art {
  height: 610px;
  background: #e9edde;
  border-radius: 13px;
  padding: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.result-art > img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 4px 11px 24px #30412e20;
  transform: rotate(-3deg);
}
.result-spark {
  position: absolute;
  right: 24px;
  bottom: 28px;
  font: 72px Georgia;
  color: #9aa988;
}
.result-controls h2 {
  font-size: 36px;
  margin-top: 22px;
}
.result-controls > p {
  font-size: 12px;
  color: #89917c;
  margin: 14px 0 25px;
}
.download-buttons {
  display: flex;
  gap: 11px;
  margin-top: 13px;
}
.download-buttons .button {
  flex: 1;
  white-space: nowrap;
  padding-inline: 15px;
}
.full {
  width: 100%;
  margin-top: 13px;
}
.result-edit-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 17px;
  font-size: 12px;
  color: #66785b;
  margin-bottom: 30px;
}
.result-controls > .help-text {
  font-size: 10px;
}
.gallery-page {
  min-height: 70vh;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 25px;
}
.gallery-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  background: #fffdf8;
}
.gallery-image {
  height: 340px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #edf0e5;
  border-radius: 6px;
  padding: 20px;
}
.gallery-image img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  box-shadow: 2px 6px 10px #263e2017;
}
.gallery-card h3 {
  margin: 17px 7px 0;
}
.gallery-card p {
  font-size: 10px;
  color: #8a947d;
  margin: 8px;
}
.gallery-actions {
  display: flex;
  justify-content: flex-end;
}
.empty-state {
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 20px;
  text-align: center;
  padding: 45px;
  color: #7c8c6d;
}
.empty-state h2 {
  font-size: 30px;
}
.empty-state p {
  font-size: 13px;
  max-width: 480px;
}
.loading {
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 13px;
  color: #859475;
}
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #a2b294;
  border-top-color: #3e5a32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  background: #354d30;
  color: #fffef8;
  box-shadow: 0 5px 25px #0002;
  border-radius: 9px;
  padding: 15px 25px;
  z-index: 100;
  font-size: 12px;
  max-width: 90vw;
  width: max-content;
}
.qr-modal {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 1px solid #dfe5d5;
  border-radius: 15px;
  background: #faf9f4;
  padding: 40px;
  width: min(420px, 90vw);
  color: var(--ink);
  text-align: center;
  box-shadow: 0 15px 70px #0003;
}
.qr-modal::backdrop {
  background: #25321b70;
  backdrop-filter: blur(3px);
}
.qr-modal h2 {
  font-size: 30px;
  margin: 17px 0 8px;
}
.qr-modal p {
  font-size: 12px;
  color: #87947a;
}
.qr-modal img {
  width: 240px;
  max-width: 100%;
  margin: 23px auto;
}
.qr-modal input {
  font-size: 10px;
  margin: 0 0 17px;
}
.qr-modal > .button {
  width: 100%;
}
.close {
  position: absolute;
  top: 10px;
  right: 10px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: #26331c70;
  padding: 20px;
}
.confirm-modal {
  width: min(430px, 100%);
  background: #faf8f4;
  padding: 32px;
  border-radius: 12px;
}
.confirm-modal h2 {
  font-size: 30px;
  margin-bottom: 15px;
}
.confirm-modal p {
  font-size: 13px;
  color: #7e8c73;
}
.danger {
  background: #a25c4f;
  border-color: #a25c4f;
}
.shared-page {
  text-align: center;
  min-height: 70vh;
}
.shared-image {
  height: 600px;
  max-width: 680px;
  background: #e9eddf;
  border-radius: 12px;
  padding: 30px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.shared-image img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}
.shared-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin: 25px;
}
.shared-page > .text-link {
  margin-top: 10px;
}
.skip-link {
  position: fixed;
  top: -60px;
  left: 10px;
  z-index: 100;
  background: #fff;
  padding: 15px;
}
.skip-link:focus {
  top: 10px;
}
@media (min-width: 1450px) {
  .hero {
    min-height: 690px;
  }
  .hero h1 {
    font-size: 79px;
  }
  .hero-art {
    transform: scale(1.05);
  }
}
@media (max-width: 1300px) {
  .section,
  .hero {
    margin-left: 52px;
    margin-right: 52px;
  }
  .bottom-cta {
    margin-left: 52px;
    margin-right: 52px;
  }
  .hero {
    gap: 20px;
  }
  .hero h1 {
    font-size: 65px;
  }
  .hero-art {
    transform: scale(0.92);
    transform-origin: center right;
  }
  .hero-promises {
    gap: 12px;
  }
  .feature-ribbon {
    gap: 24px;
    font-size: 11px;
  }
  .section-heading h2 {
    font-size: 31px;
  }
  .layout-workspace {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 25px;
  }
  .preview-sidebar {
    padding: 18px;
  }
  .capture-workspace {
    grid-template-columns: minmax(0, 1fr) 270px;
  }
  .layout-grid {
    gap: 12px;
  }
  .frame-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (max-width: 1050px) {
  .navbar {
    padding-inline: 30px;
  }
  .navbar nav {
    gap: 20px;
  }
  .brand {
    font-size: 20px;
  }
  .section,
  .hero {
    margin-inline: 35px;
  }
  .hero {
    gap: 0;
    min-height: 580px;
    grid-template-columns: 1.1fr 1fr;
  }
  .hero h1 {
    font-size: 57px;
  }
  .hero-art {
    transform: scale(0.77);
    width: 530px;
    margin-left: -90px;
  }
  .hero-copy {
    position: relative;
    z-index: 6;
  }
  .hero-copy > p {
    font-size: 12px;
  }
  .hero-promises {
    gap: 9px;
    font-size: 8px;
  }
  .love-note {
    margin-top: 27px;
  }
  .feature-ribbon {
    gap: 18px;
    padding-inline: 22px;
    font-size: 10px;
  }
  .feature-ribbon svg {
    width: 16px;
  }
  .featured-art {
    height: 215px;
  }
  .featured-grid {
    gap: 17px;
  }
  .section-heading h2 {
    font-size: 29px;
  }
  .how-grid {
    margin-inline: 20px;
    gap: 40px;
  }
  .bottom-cta {
    margin-inline: 35px;
  }
  .layout-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .search-row {
    flex-wrap: wrap;
  }
  .search-input {
    min-width: 180px;
  }
  .search-row .button {
    font-size: 10px;
  }
  .filter-row {
    flex-wrap: wrap;
  }
  .filter-row > span {
    width: 100%;
  }
  .page-title h1 {
    font-size: 37px;
  }
  .steps i {
    width: 30px;
    margin-inline: 12px;
  }
  .frame-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .result-workspace {
    gap: 35px;
  }
  .capture-workspace {
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 20px;
  }
  .preview-stage {
    height: 300px;
  }
  .layout-preview canvas {
    max-height: 270px;
  }
  .camera-tools {
    gap: 8px;
  }
  .camera-tools .inline-check {
    width: 100%;
  }
  .camera-message {
    padding: 30px 20px;
  }
  .camera-message h3 {
    font-size: 22px;
  }
  .camera-message p {
    font-size: 11px;
  }
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 760px) {
  .navbar {
    height: 77px;
    padding: 0 22px;
    gap: 10px;
    flex-wrap: wrap;
    align-content: center;
  }
  .navbar .brand {
    font-size: 20px;
  }
  .brand-icon {
    width: 32px;
    height: 28px;
  }
  .navbar nav {
    gap: 16px;
    margin-left: auto;
    font-size: 11px;
  }
  .navbar nav a:nth-child(2) {
    display: none;
  }
  .navbar > .button {
    display: none;
  }
  .hero {
    display: flex;
    flex-direction: column;
    margin: 0 24px;
    padding: 40px 0 30px;
    min-height: auto;
    gap: 0;
  }
  .hero-copy {
    text-align: center;
    padding-bottom: 0;
    width: 100%;
  }
  .hero h1 {
    font-size: 60px;
    margin-top: 22px;
    letter-spacing: -3px;
  }
  .sketch-spark {
    font-size: 37px;
    margin: 0 0 0 7px;
  }
  .hero-copy > p {
    font-size: 13px;
    line-height: 1.8;
  }
  .hero .pill {
    font-size: 7px;
    letter-spacing: 1px;
  }
  .hero-cta {
    margin-top: 24px;
  }
  .hero-promises {
    justify-content: center;
    font-size: 9px;
    margin-top: 17px;
    gap: 14px;
  }
  .love-note {
    justify-content: center;
    margin-top: 22px;
  }
  .hero-art {
    width: 530px;
    max-width: none;
    height: 509px;
    transform: scale(0.75);
    transform-origin: top center;
    margin: 38px 0 -115px;
  }
  .feature-ribbon {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 19px 14px;
    padding: 22px 24px;
    font-size: 9px;
  }
  .feature-ribbon i {
    display: none;
  }
  .feature-ribbon span {
    gap: 8px;
    justify-content: center;
  }
  .section {
    margin: 0 23px;
    padding-block: 42px;
  }
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 17px;
    margin-bottom: 23px;
  }
  .section-heading h2 {
    font-size: 30px;
    line-height: 1.2;
  }
  .section-heading p {
    font-size: 12px;
  }
  .section-heading > .text-link {
    align-self: flex-start;
  }
  .featured-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 25px 15px;
  }
  .featured-art {
    height: 206px;
  }
  .featured-art img {
    max-height: 160px;
    max-width: 72%;
  }
  .art-1 img {
    height: 128px;
  }
  .art-2 img {
    height: 141px;
  }
  .featured-card h3 {
    font-size: 12px;
  }
  .featured-card > p {
    font-size: 9px;
  }
  .featured-card > div:nth-child(2) {
    margin-top: 12px;
  }
  .featured-card svg {
    width: 14px;
  }
  .tag {
    font-size: 6px;
    top: 10px;
    left: 10px;
    padding: 5px 7px;
  }
  .how > h2 {
    font-size: 30px;
  }
  .how-grid {
    grid-template-columns: 1fr;
    margin: 35px 20px 0;
    gap: 32px;
  }
  .how-grid p {
    max-width: 280px;
  }
  .how-icon {
    margin-bottom: 14px;
  }
  .bottom-cta {
    margin: 10px 23px 40px;
    padding: 35px 20px;
  }
  .bottom-cta h2 {
    font-size: 30px;
  }
  .bottom-cta > span {
    left: 15px;
    top: 20px;
    font-size: 38px;
  }
  .bottom-cta .button {
    font-size: 11px;
  }
  footer {
    padding: 25px 23px;
    flex-wrap: wrap;
    gap: 17px;
  }
  footer .brand {
    font-size: 17px;
  }
  footer > span {
    font-size: 8px;
  }
  footer > span:nth-child(2) {
    display: none;
  }
  .steps {
    margin-bottom: 29px;
    gap: 0;
  }
  .steps > div {
    flex-direction: column;
    gap: 7px;
    position: relative;
    flex: 1;
  }
  .steps p {
    font-size: 8px;
    white-space: nowrap;
  }
  .steps i {
    position: absolute;
    left: 62%;
    top: 12px;
    width: 76%;
    margin: 0;
  }
  .steps span {
    z-index: 1;
    background: #faf8f4;
  }
  .page-title {
    margin-bottom: 28px;
  }
  .page-title h1 {
    font-size: 34px;
    letter-spacing: -1.3px;
  }
  .page-title p {
    font-size: 12px;
  }
  .page-title .eyebrow {
    font-size: 8px;
    letter-spacing: 1.5px;
  }
  .layout-workspace {
    grid-template-columns: 1fr;
    gap: 25px;
  }
  .preview-sidebar {
    position: static;
    padding: 23px;
  }
  .layout-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .layout-thumb {
    height: 165px;
  }
  .layout-thumb img {
    max-height: 137px;
  }
  .layout-card h3 {
    font-size: 11px;
  }
  .layout-card p {
    font-size: 9px;
  }
  .category-chips {
    flex-wrap: nowrap;
  }
  .category-chips button {
    font-size: 10px;
    padding: 8px 11px;
  }
  .filter-row {
    padding-top: 8px;
  }
  .filter-row > span {
    width: auto;
  }
  .search-row {
    gap: 8px;
    flex-wrap: nowrap;
  }
  .search-row .button {
    padding: 10px;
    font-size: 9px;
    gap: 5px;
  }
  .search-input {
    min-width: 0;
  }
  .search-input input {
    font-size: 11px;
  }
  .preview-stage {
    height: 350px;
  }
  .layout-preview canvas {
    max-height: 320px;
  }
  .settings-panel {
    padding: 22px;
  }
  .frame-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .frame-grid button {
    font-size: 8px;
  }
  .frame-grid button > span {
    height: 76px;
    font-size: 12px;
  }
  .settings-panel h2 {
    font-size: 25px;
  }
  .checkbox-row {
    gap: 15px;
  }
  .field-grid {
    gap: 12px;
  }
  .field-grid label {
    font-size: 11px;
  }
  .capture-workspace {
    grid-template-columns: 1fr;
  }
  .camera-stage {
    aspect-ratio: 3/4;
    max-height: 540px;
  }
  .camera-tools {
    justify-content: center;
    gap: 10px;
  }
  .camera-tools .inline-check {
    width: auto;
  }
  .camera-message p {
    font-size: 12px;
  }
  .camera-label {
    font-size: 7px;
    left: 15px;
  }
  .capture-thumbnails {
    gap: 6px;
  }
  .capture-thumbnails > div {
    min-width: 0;
    max-width: 60px;
    flex: 1;
  }
  .editor-panel .section-heading {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .editor-panel .inline-check {
    font-size: 9px;
  }
  .edit-photo {
    height: 310px;
  }
  .edit-thumbnails button {
    width: 70px;
    height: 60px;
  }
  .result-workspace {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .result-art {
    height: 530px;
  }
  .result-controls {
    text-align: center;
  }
  .result-controls h2 {
    font-size: 33px;
  }
  .result-edit-links {
    text-align: left;
    padding-inline: 20px;
  }
  .gallery-grid {
    gap: 15px;
  }
  .gallery-image {
    height: 240px;
    padding: 12px;
  }
  .gallery-card {
    padding: 8px;
  }
  .gallery-card h3 {
    font-size: 12px;
  }
  .gallery-actions .icon-button {
    width: 29px;
  }
  .gallery-actions svg {
    width: 15px;
  }
  .shared-image {
    height: 520px;
    padding: 20px;
  }
  .shared-actions {
    gap: 8px;
    margin-inline: 0;
  }
  .shared-actions .button {
    font-size: 11px;
    padding: 13px;
  }
  .empty-state {
    padding: 30px 15px;
  }
  .empty-state h2 {
    font-size: 26px;
  }
  .qr-modal {
    padding: 35px 25px;
  }
}
@media (max-width: 390px) {
  .hero h1 {
    font-size: 51px;
  }
  .hero-art {
    transform: scale(0.64);
    margin-bottom: -168px;
  }
  .hero-promises {
    font-size: 8px;
    gap: 8px;
  }
  .navbar nav {
    gap: 12px;
  }
  .navbar .brand {
    font-size: 18px;
  }
  .brand-icon {
    display: none;
  }
  .featured-art {
    height: 175px;
  }
  .featured-art img {
    max-height: 140px;
  }
  .frame-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .page-title h1 {
    font-size: 30px;
  }
  .steps p {
    font-size: 7px;
  }
  .layout-thumb {
    height: 140px;
  }
  .layout-thumb img {
    max-height: 115px;
  }
  .gallery-grid {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

````

## frontend/src/utils/canvasGenerator.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\canvasGenerator.js

````javascript
import { filterCSS } from "./filters";
import QRCode from "qrcode";
import { filteredBitmap } from "./filterFallback";
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("A photo could not be loaded. Please replace it."));
    img.src = src;
  });
export function resolveSlots(layout, settings = {}) {
  const inset = Number(settings.margin || 0);
  const spacing = Number(settings.spacing || 0);
  return layout.slots.map((s) => ({
    ...s,
    x: s.x + inset * (1 - (2 * s.x) / layout.width) + spacing / 2,
    y: s.y + inset * (1 - (2 * s.y) / layout.height) + spacing / 2,
    width: Math.max(20, s.width * (1 - (2 * inset) / layout.width) - spacing),
    height: Math.max(
      20,
      s.height * (1 - (2 * inset) / layout.height) - spacing,
    ),
  }));
}
function clip(ctx, s, radius) {
  const { width: w, height: h } = s;
  ctx.beginPath();
  if (s.mask === "circle") ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
  else if (s.mask === "heart") {
    ctx.moveTo(0, h / 2);
    ctx.bezierCurveTo(-w, -h / 8, -w / 3, -h * 0.85, 0, -h * 0.25);
    ctx.bezierCurveTo(w / 3, -h * 0.85, w, -h / 8, 0, h / 2);
  } else if (s.mask === "arch") {
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.bezierCurveTo(-w / 2, -h * 0.67, w / 2, -h * 0.67, w / 2, 0);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
  } else
    ctx.roundRect(
      -w / 2,
      -h / 2,
      w,
      h,
      s.mask === "rounded"
        ? Math.min(w, h) * 0.18
        : Math.min(radius, w / 2, h / 2),
    );
}
export async function generateCanvas(
  { layout, frame, photos = [], settings = {}, preset = "Original" },
  scale = 1,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  const canvasFilterSupported = "filter" in ctx;
  if (layout.duplicate) {
    const strip = await generateCanvas(
      {
        layout: {
          ...layout,
          width: layout.width / 2,
          slots: layout.slots.slice(0, layout.photoCount),
          duplicate: false,
        },
        frame,
        photos,
        settings,
        preset,
      },
      scale,
    );
    ctx.drawImage(strip, 0, 0);
    ctx.drawImage(strip, strip.width, 0);
    return canvas;
  }
  ctx.scale(scale, scale);
  const w = layout.width,
    h = layout.height,
    bg =
      settings.background ||
      (frame.id === "classic-white" && layout.background) ||
      frame.backgroundColor,
    ink = (frame.id === "classic-white" && layout.textColor) || frame.textColor;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const decoration = frame.decoration || layout.decoration;
  if (layout.name.includes("Y2K")) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bg);
    g.addColorStop(1, "#b8dcf1");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const images = await Promise.all(
    photos.map((p) => (p ? loadImage(p.src) : null)),
  );
  for (const [i, s] of resolveSlots(layout, settings).entries()) {
    const p = photos[s.photoIndex ?? i],
      img = images[s.photoIndex ?? i];
    ctx.save();
    ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    if (["polaroid", "tape", "pins"].includes(decoration)) {
      ctx.shadowColor = "#00000025";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(
        -s.width / 2 - 22,
        -s.height / 2 - 22,
        s.width + 44,
        s.height + 95,
      );
      ctx.shadowColor = "transparent";
    }
    clip(ctx, s, Number(settings.radius || 0));
    ctx.save();
    ctx.clip();
    if (img) {
      const css = filterCSS(p, preset);
      const bitmap = canvasFilterSupported ? img : filteredBitmap(img, css);
      if (canvasFilterSupported) ctx.filter = css;
      const zoom = p.zoom || 1;
      const ratio =
        (p.fit === "contain"
          ? Math.min(s.width / img.width, s.height / img.height)
          : Math.max(s.width / img.width, s.height / img.height)) * zoom;
      const dw = img.width * ratio,
        dh = img.height * ratio;
      ctx.fillStyle = bg;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.drawImage(
        bitmap,
        -dw / 2 + (((p.panX || 0) / 100) * Math.abs(dw - s.width)) / 2,
        -dh / 2 + (((p.panY || 0) / 100) * Math.abs(dh - s.height)) / 2,
        dw,
        dh,
      );
      ctx.filter = "none";
      const grain = p.adjustments?.grain || 0;
      if (grain) {
        ctx.fillStyle = `rgba(35,29,21,${grain / 550})`;
        let seed = i + 1;
        for (let n = 0; n < grain * 75; n++) {
          seed = (seed * 16807) % 2147483647;
          const x = (seed / 2147483647) * s.width - s.width / 2;
          seed = (seed * 16807) % 2147483647;
          ctx.fillRect(x, (seed / 2147483647) * s.height - s.height / 2, 2, 2);
        }
      }
    } else {
      const g = ctx.createLinearGradient(
        -s.width / 2,
        -s.height / 2,
        s.width / 2,
        s.height / 2,
      );
      g.addColorStop(0, ["#b5c1a5", "#d9c7ad", "#c8cec5", "#d9b8ad"][i % 4]);
      g.addColorStop(1, "#e6e8da");
      ctx.fillStyle = g;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.fillStyle = "#ffffffaa";
      ctx.beginPath();
      ctx.arc(
        s.width * 0.19,
        -s.height * 0.16,
        Math.min(s.width, s.height) * 0.12,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#66775c35";
      ctx.beginPath();
      ctx.moveTo(-s.width / 2, s.height / 2);
      ctx.lineTo(-s.width * 0.15, -s.height * 0.05);
      ctx.lineTo(s.width * 0.12, s.height * 0.2);
      ctx.lineTo(s.width * 0.35, -s.height * 0.15);
      ctx.lineTo(s.width / 2, s.height / 2);
      ctx.fill();
      ctx.fillStyle = "#3e503c";
      ctx.textAlign = "center";
      ctx.font = `500 ${Math.min(s.width, s.height) * 0.07}px sans-serif`;
      ctx.fillText(`PHOTO ${(s.photoIndex ?? i) + 1}`, 0, s.height * 0.3);
    }
    ctx.restore();
    if (settings.borderWidth) {
      clip(ctx, s, Number(settings.radius || 0));
      ctx.lineWidth = Number(settings.borderWidth);
      ctx.strokeStyle = settings.borderColor || frame.borderColor;
      ctx.stroke();
    }
    if (decoration === "tape") {
      ctx.fillStyle = "#d3b98ebb";
      ctx.fillRect(-s.width * 0.2, -s.height / 2 - 38, s.width * 0.4, 65);
    }
    if (decoration === "pins") {
      ctx.fillStyle = "#b45543";
      ctx.beginPath();
      ctx.arc(0, -s.height / 2 - 10, 19, 0, Math.PI * 2);
      ctx.fill();
    }
    if (decoration === "film") {
      ctx.fillStyle = ink;
      ctx.font = "22px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `FRAME ${String((s.photoIndex ?? i) + 1).padStart(2, "0")}  •  35mm`,
        -s.width / 2,
        s.height / 2 + 35,
      );
    }
    if (["timestamp", "vhs"].includes(decoration)) {
      ctx.fillStyle = "#ffad55";
      ctx.font = `${w * 0.016}px monospace`;
      ctx.fillText(
        `${decoration === "vhs" ? "● REC  " : ""}${settings.date || new Date().toISOString().slice(0, 10)}`,
        -s.width * 0.44,
        s.height * 0.43,
      );
    }
    ctx.restore();
  }
  if (decoration === "film") {
    ctx.fillStyle = "#eee8d6";
    if (w < h) {
      for (let y = 50; y < h - 40; y += 140) {
        ctx.beginPath();
        ctx.roundRect(22, y, 38, 65, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(w - 60, y, 38, 65, 6);
        ctx.fill();
        ctx.beginPath();
      }
    } else {
      for (let x = 50; x < w - 40; x += 140) {
        ctx.fillRect(x, 22, 65, 35);
        ctx.fillRect(x, h - 60, 65, 35);
      }
    }
  }
  const glyph = {
    hearts: "♥",
    floral: "❀",
    stars: "✦",
    snow: "❄",
    confetti: "✧",
    halloween: "✦",
    arcade: "▣",
  }[decoration];
  if (glyph) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.55;
    ctx.font = `${w * 0.045}px serif`;
    for (let n = 0; n < 8; n++) {
      ctx.fillText(
        glyph,
        n % 2 ? w * 0.94 : w * 0.025,
        h * (0.08 + Math.floor(n / 2) * 0.23),
      );
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  if (layout.category === "Magazine" && settings.showHeader !== false) {
    ctx.font = `bold ${w * 0.115}px Georgia`;
    ctx.fillText(
      settings.magazineTitle || "MEMORIES",
      w / 2,
      h * 0.1,
      w * 0.88,
    );
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText("THE GOOD TIMES ISSUE", w / 2, h * 0.135, w * 0.8);
  }
  const title =
    settings.showEvent === false
      ? ""
      : settings.eventName || layout.header || "Pitik Booth";
  const titleY = layout.centerText
    ? h * 0.49
    : settings.textPlacement === "top"
      ? h * 0.06
      : h * 0.91;
  const titleSize = Math.min(w * 0.052, 110);
  ctx.font = `${decoration === "editorial" ? "bold" : "500"} ${titleSize}px Georgia`;
  if (settings.showHeader !== false && title)
    ctx.fillText(title, w / 2, titleY, w * (layout.centerText ? 0.26 : 0.8));
  ctx.font = `${Math.min(w * 0.024, 46)}px sans-serif`;
  if (settings.showMessage !== false && settings.message)
    ctx.fillText(
      settings.message,
      w / 2,
      layout.centerText ? h * 0.53 : h * 0.947,
      w * (layout.centerText ? 0.26 : 0.8),
    );
  if (settings.showDate !== false)
    ctx.fillText(
      settings.date || new Date().toISOString().slice(0, 10),
      w / 2,
      layout.centerText ? h * 0.57 : h * 0.975,
      w * (layout.centerText ? 0.26 : 0.8),
    );
  if (settings.showFooter && settings.footer) {
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText(settings.footer, w / 2, h * 0.995, w * 0.8);
  }
  if (settings.logo && settings.showLogo !== false) {
    const logo = await loadImage(settings.logo);
    const size = w * 0.09;
    const ratio = Math.min(size / logo.width, size / logo.height);
    ctx.drawImage(
      logo,
      w * 0.85,
      h * 0.9,
      logo.width * ratio,
      logo.height * ratio,
    );
  }
  if (settings.qrURL && /^https?:\/\//i.test(settings.qrURL)) {
    const qr = await loadImage(
      await QRCode.toDataURL(settings.qrURL, { width: 240, margin: 1 }),
    );
    const size = Math.min(w * 0.12, h * 0.12);
    ctx.drawImage(qr, w * 0.025, h - size - h * 0.025, size, size);
  }
  return canvas;
}
export const canvasBlob = (canvas, type = "image/png") =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Unable to export image.")),
      type,
      0.95,
    ),
  );

````

## frontend/src/utils/filterFallback.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\filterFallback.js

````javascript
// Pixel fallback for browsers without CanvasRenderingContext2D.filter.
// Compose CSS color operations once, then transform each pixel in a single pass.
export function filteredBitmap(image, css) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  let matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const compose = (next) => {
    const out = Array(12).fill(0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++)
        for (let k = 0; k < 3; k++)
          out[r * 4 + c] += next[r * 4 + k] * matrix[k * 4 + c];
      out[r * 4 + 3] = next[r * 4 + 3];
      for (let k = 0; k < 3; k++)
        out[r * 4 + 3] += next[r * 4 + k] * matrix[k * 4 + 3];
    }
    matrix = out;
  };
  for (const match of css.matchAll(/([a-z-]+)\(([-.\d]+)(deg|%)?\)/g)) {
    const name = match[1],
      a = Number(match[2]) / (match[3] === "%" ? 100 : 1);
    let m;
    if (name === "brightness") m = [a, 0, 0, 0, 0, a, 0, 0, 0, 0, a, 0];
    if (name === "contrast") {
      const offset = 127.5 * (1 - a);
      m = [a, 0, 0, offset, 0, a, 0, offset, 0, 0, a, offset];
    }
    if (name === "saturate" || name === "grayscale") {
      const s = name === "grayscale" ? 1 - a : a;
      const r = 0.2126 * (1 - s),
        g = 0.7152 * (1 - s),
        b = 0.0722 * (1 - s);
      m = [r + s, g, b, 0, r, g + s, b, 0, r, g, b + s, 0];
    }
    if (name === "sepia")
      m = [
        1 - 0.607 * a,
        0.769 * a,
        0.189 * a,
        0,
        0.349 * a,
        1 - 0.314 * a,
        0.168 * a,
        0,
        0.272 * a,
        0.534 * a,
        1 - 0.869 * a,
        0,
      ];
    if (name === "hue-rotate") {
      const c = Math.cos((a * Math.PI) / 180),
        s = Math.sin((a * Math.PI) / 180);
      m = [
        0.213 + c * 0.787 - s * 0.213,
        0.715 - c * 0.715 - s * 0.715,
        0.072 - c * 0.072 + s * 0.928,
        0,
        0.213 - c * 0.213 + s * 0.143,
        0.715 + c * 0.285 + s * 0.14,
        0.072 - c * 0.072 - s * 0.283,
        0,
        0.213 - c * 0.213 - s * 0.787,
        0.715 - c * 0.715 + s * 0.715,
        0.072 + c * 0.928 + s * 0.072,
        0,
      ];
    }
    if (m) compose(m);
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height),
    pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    pixels[i] = matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[3];
    pixels[i + 1] = matrix[4] * r + matrix[5] * g + matrix[6] * b + matrix[7];
    pixels[i + 2] = matrix[8] * r + matrix[9] * g + matrix[10] * b + matrix[11];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

````

## frontend/src/utils/filters.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\filters.js

````javascript
export const filters = [
  ["Original", "none"],
  ["Black & White", "grayscale(1) contrast(1.2)"],
  ["Grayscale", "grayscale(1)"],
  ["Sepia", "sepia(1)"],
  ["Vintage", "sepia(.35) contrast(.88) saturate(.8)"],
  ["Warm", "sepia(.2) saturate(1.2)"],
  ["Cool", "hue-rotate(15deg) saturate(.85)"],
  ["High Contrast", "contrast(1.45)"],
  ["Soft", "contrast(.85) brightness(1.1)"],
  ["Film", "sepia(.15) contrast(1.15) saturate(.8)"],
  ["Retro", "sepia(.4) saturate(1.3)"],
  ["Bright", "brightness(1.2)"],
  ["Disposable Camera", "sepia(.2) contrast(1.25) saturate(1.15)"],
  ["Faded", "contrast(.75) saturate(.8) brightness(1.1)"],
  ["Cinematic", "contrast(1.2) saturate(.65)"],
].map(([name, css]) => ({ name, css }));
export const defaultAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  warmth: 0,
  grain: 0,
};
export function filterCSS(photo = {}, preset = "Original") {
  const a = { ...defaultAdjustments, ...photo.adjustments };
  return `${filters.find((f) => f.name === (photo.filter || preset))?.css.replace("none", "") || ""} brightness(${(a.brightness / 100) * 2 ** (a.exposure / 100)}) contrast(${a.contrast / 100}) saturate(${a.saturation / 100}) sepia(${a.warmth / 200})`;
}

````

## frontend/src/utils/frames.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\frames.js

````javascript
const definitions = [
  ["Classic White", "#fffdf8", "#343d32"],
  ["Classic Black", "#222723", "#faf8ef"],
  ["Minimal", "#f2f1ed", "#44483e"],
  ["Pink", "#f5dce3", "#774550"],
  ["Blue", "#dae8ee", "#345368"],
  ["Pastel", "#e8e5f4", "#65597a"],
  ["Vintage", "#e8dbbd", "#68593a"],
  ["Retro", "#e8c596", "#713e2c"],
  ["Film Strip", "#202522", "#fff5d4", "film"],
  ["Birthday", "#f6dee5", "#a04261", "confetti"],
  ["Wedding", "#f2eee3", "#686d4e", "floral"],
  ["Christmas", "#e5eee1", "#456141", "snow"],
  ["Valentine’s Day", "#f5dde0", "#994c59", "hearts"],
  ["Party", "#e9e0f3", "#714b82", "confetti"],
  ["Graduation", "#e3e7ee", "#3b4d72", "stars"],
  ["Corporate", "#e9eef0", "#344b57"],
  ["Floral", "#f1ecdf", "#657352", "floral"],
  ["Neon", "#242334", "#b4f470", "stars"],
  ["Y2K", "#e6dcf9", "#78559b", "stars"],
  ["Elegant Gold", "#f1e9d5", "#8d743f"],
];
export const frames = definitions.map(
  ([name, backgroundColor, textColor, decoration]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    backgroundColor,
    textColor,
    borderColor: textColor,
    photoSpacing: 0,
    borderRadius: 0,
    headerText: "",
    footerText: "Pitik Booth",
    decoration,
  }),
);

````

## frontend/src/utils/layouts.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\layouts.js

````javascript
// Every position is in output pixels. photoIndex allows print duplicates without extra captures.
const slot = (x, y, width, height, extra = {}) => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  ...extra,
});
const grid = (
  cols,
  rows,
  w = 2400,
  h = 2400,
  p = 100,
  gap = 45,
  footer = 260,
) =>
  Array.from({ length: cols * rows }, (_, i) =>
    slot(
      p + (i % cols) * ((w - 2 * p + gap) / cols),
      p + Math.floor(i / cols) * ((h - 2 * p - footer + gap) / rows),
      (w - 2 * p - gap * (cols - 1)) / cols,
      (h - 2 * p - footer - gap * (rows - 1)) / rows,
      { photoIndex: i },
    ),
  );
const entries = [];
function add(name, category, count, w, h, slots, extra = {}) {
  entries.push({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    category,
    photoCount: count,
    orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    width: w,
    height: h,
    slots,
    thumbnail: "",
    allowText: true,
    allowLogo: true,
    allowDate: true,
    ...extra,
  });
}
for (const n of [4, 3, 2])
  add(
    `Classic ${n} Strip`,
    "Classic Strips",
    n,
    1200,
    3600,
    grid(1, n, 1200, 3600, 95, 55, 300),
    { featured: true },
  );
for (const n of [4, 3])
  add(
    `Horizontal ${n} Strip`,
    "Classic Strips",
    n,
    3000,
    1000,
    grid(n, 1, 3000, 1000, 70, 35, 160),
  );
add(
  "Double Photobooth Strip",
  "Classic Strips",
  4,
  2400,
  3600,
  [
    ...grid(1, 4, 1200, 3600, 95, 55, 300),
    ...grid(1, 4, 1200, 3600, 95, 55, 300).map((s) => ({
      ...s,
      x: s.x + 1200,
    })),
  ],
  { duplicate: true },
);
for (const [name, c, r, w, h, p, g, f] of [
  ["2x2 Grid", 2, 2, 2400, 2400, 100, 45, 260],
  ["2x3 Grid", 2, 3, 2400, 3200, 100, 45, 260],
  ["3x2 Grid", 3, 2, 3000, 2000, 90, 40, 240],
  ["3x3 Grid", 3, 3, 2400, 2400, 90, 35, 240],
  ["Four Square", 2, 2, 2400, 2800, 160, 90, 400],
  ["Six Mini Grid", 3, 2, 2400, 2400, 140, 70, 650],
  ["Eight Photo Grid", 3, 3, 2400, 2400, 100, 40, 0],
]) {
  let slots = grid(c, r, w, h, p, g, f);
  if (name === "Eight Photo Grid")
    slots = slots
      .filter((_, i) => i !== 4)
      .map((s, i) => ({ ...s, photoIndex: i }));
  add(name, "Grid", slots.length, w, h, slots, {
    featured: name === "2x2 Grid",
    centerText: name === "Eight Photo Grid",
  });
}
for (const [name, c, r, count] of [
  ["Single Polaroid", 1, 1, 1],
  ["Double Polaroid", 1, 2, 2],
  ["Side-by-Side Polaroid", 2, 1, 2],
  ["Three Polaroids", 3, 1, 3],
  ["Four Polaroid Collage", 2, 2, 4],
])
  add(
    name,
    "Polaroid",
    count,
    c === 3 ? 3000 : 2400,
    r === 2 ? 3000 : 2400,
    grid(c, r, c === 3 ? 3000 : 2400, r === 2 ? 3000 : 2400, 180, 140, 350).map(
      (s, i) => ({ ...s, rotation: count > 2 ? [-5, 3, -2, 4][i] : 0 }),
    ),
    { decoration: "polaroid", featured: count === 1 },
  );
for (const [name, c, r, w, h] of [
  ["Classic Film Strip", 1, 4, 1200, 3600],
  ["Horizontal Film Roll", 4, 1, 3000, 1200],
  ["Cinema Strip", 1, 4, 1200, 3600],
  ["35mm Film Layout", 2, 2, 2400, 2400],
])
  add(name, "Film", c * r, w, h, grid(c, r, w, h, 150, 70, 260), {
    decoration: "film",
    background: "#20231f",
    textColor: "#f9f5e9",
    featured: name === "Classic Film Strip",
  });
for (const name of [
  "Scrapbook Four",
  "Memory Board",
  "Photo Wall",
  "Travel Scrapbook",
  "Journal Layout",
])
  add(
    name,
    "Scrapbook",
    4,
    2400,
    2800,
    grid(2, 2, 2400, 2800, 200, 130, 450).map((s, i) => ({
      ...s,
      rotation: [-4, 3, 2, -3][i],
    })),
    {
      decoration: name === "Memory Board" ? "pins" : "tape",
      background: "#eee5d0",
    },
  );
const hero = [
  slot(100, 100, 2200, 1400, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(100 + i * 750, 1550, 700, 550, { photoIndex: i + 1 }),
  ),
];
const left = [
  slot(100, 100, 1400, 2000, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(1550, 100 + i * 680, 750, 640, { photoIndex: i + 1 }),
  ),
];
const center = [
  slot(750, 700, 900, 1000, { photoIndex: 0 }),
  slot(100, 100, 550, 900, { photoIndex: 1 }),
  slot(1750, 100, 550, 900, { photoIndex: 2 }),
  slot(100, 1200, 550, 900, { photoIndex: 3 }),
  slot(1750, 1200, 550, 900, { photoIndex: 4 }),
  slot(750, 100, 900, 500, { photoIndex: 5 }),
];
add("Hero + Three", "Collage", 4, 2400, 2400, hero, { featured: true });
add("One Large + Two Small", "Collage", 3, 2400, 2400, [
  slot(100, 100, 1400, 2000, { photoIndex: 0 }),
  slot(1550, 100, 750, 975, { photoIndex: 1 }),
  slot(1550, 1125, 750, 975, { photoIndex: 2 }),
]);
add("Magazine Collage", "Collage", 4, 2400, 2400, left);
add("Mosaic Collage", "Collage", 6, 2400, 2400, center);
add(
  "Freeform Collage",
  "Collage",
  4,
  2400,
  2400,
  grid(2, 2, 2400, 2400, 160, 100, 280).map((s, i) => ({
    ...s,
    rotation: [-5, 3, -2, 4][i],
  })),
  { decoration: "polaroid" },
);
add("Center Hero Layout", "Collage", 6, 2400, 2400, center);
for (const name of [
  "Magazine Cover",
  "Fashion Magazine",
  "Wedding Magazine",
  "Birthday Magazine",
  "Graduation Magazine",
])
  add(
    name,
    "Magazine",
    1,
    2400,
    3200,
    [slot(130, 500, 2140, 2070, { photoIndex: 0 })],
    { decoration: "editorial", header: "MEMORIES" },
  );
for (const [name, w, h, c, r] of [
  ["Story Style", 1080, 1920, 1, 1],
  ["Square Social Post", 1080, 1080, 2, 2],
  ["Portrait Social Post", 1080, 1350, 1, 2],
  ["Photo Dump", 2400, 2400, 2, 2],
  ["Social Story Collage", 1080, 1920, 1, 3],
])
  add(name, "Social", c * r, w, h, grid(c, r, w, h, 60, 25, 180));
for (const name of [
  "Classic Postcard",
  "Travel Postcard",
  "Event Postcard",
  "Retro Postcard",
])
  add(
    name,
    "Postcard",
    1,
    3000,
    2000,
    [slot(100, 120, 2800, 1300, { photoIndex: 0 })],
    {
      header: "Greetings from…",
      background: name === "Retro Postcard" ? "#f4dfb9" : undefined,
    },
  );
for (const [name, category, decor, bg] of [
  ["Wedding", "Wedding", "floral", "#f2eee4"],
  ["Birthday", "Birthday", "confetti", "#f9e5ed"],
  ["Graduation", "Graduation", "stars", "#e6ebf4"],
  ["Corporate Event", "Corporate", null, "#e8eef0"],
  ["Christmas", "Holiday", "snow", "#e5efe4"],
  ["Valentine’s", "Holiday", "hearts", "#f8dce3"],
  ["Halloween", "Holiday", "halloween", "#ecd9c1"],
  ["New Year", "Holiday", "confetti", "#efe8cd"],
  ["Baby Shower", "Cards", "stars", "#e5e8f5"],
  ["Anniversary", "Cards", "hearts", "#f3e4df"],
])
  add(
    `${name} Layout`,
    category,
    4,
    2400,
    2800,
    grid(2, 2, 2400, 2800, 170, 70, 500),
    { decoration: decor, background: bg, header: name },
  );
for (const [name, p, g, bg] of [
  ["Minimal White", 100, 30, "#ffffff"],
  ["Minimal Black", 100, 30, "#222222"],
  ["Borderless Grid", 0, 0, "#ffffff"],
  ["Thin Border Grid", 40, 15, "#ffffff"],
  ["Large Margin Layout", 300, 80, "#faf8f4"],
  ["Centered Editorial", 240, 70, "#faf8f4"],
])
  add(name, "Minimal", 4, 2400, 2400, grid(2, 2, 2400, 2400, p, g, 260), {
    background: bg,
    textColor: name === "Minimal Black" ? "#ffffff" : undefined,
  });
for (const [name, decor, bg] of [
  ["Y2K Photobooth", "stars", "#e2dcfc"],
  ["90s Camera Layout", "timestamp", "#f3d5a8"],
  ["VHS Layout", "vhs", "#202524"],
  ["Disposable Camera Layout", "timestamp", "#eadcc3"],
  ["Vintage Newspaper", "editorial", "#e9e1cf"],
  ["Retro Arcade", "arcade", "#d8e6c6"],
])
  add(name, "Retro", 4, 2400, 2800, grid(2, 2, 2400, 2800, 150, 80, 400), {
    decoration: decor,
    background: bg,
    textColor: decor === "vhs" ? "#ffffff" : undefined,
  });
for (const name of [
  "Thank You Card",
  "Save the Date",
  "Birthday Card",
  "Holiday Card",
  "Invitation Card",
])
  add(
    name,
    "Cards",
    1,
    2400,
    2400,
    [slot(160, 160, 2080, 1540, { photoIndex: 0 })],
    { header: name },
  );
for (const [name, c, r] of [
  ["Wide Four", 4, 1],
  ["Cinematic Two", 2, 1],
  ["Panorama Hero", 1, 1],
  ["Event Banner", 3, 1],
])
  add(
    name,
    "Landscape",
    c * r,
    3000,
    2000,
    grid(c, r, 3000, 2000, 100, 50, 350),
  );
for (const [name, mask, c, r] of [
  ["Circle Four", "circle", 2, 2],
  ["Circle Grid", "circle", 3, 2],
  ["Heart Layout", "heart", 2, 2],
  ["Rounded Card", "rounded", 2, 2],
  ["Arch Layout", "arch", 2, 2],
])
  add(
    name,
    "Shapes",
    c * r,
    2400,
    2600,
    grid(c, r, 2400, 2600, 130, 70, 350).map((s) => ({ ...s, mask })),
  );
for (const [name, slots] of [
  ["Spotlight", hero],
  ["Left Hero", left],
  ["Right Hero", left.map((s) => ({ ...s, x: 2400 - s.x - s.width }))],
  ["Top Hero", hero],
  ["Center Hero", center],
])
  add(name, "Asymmetrical", slots.length, 2400, 2400, slots);
const story = entries.find((l) => l.name === "Story Style");
story.photoCount = 3;
story.slots = [
  slot(60, 60, 960, 1530, { photoIndex: 0 }),
  slot(90, 1060, 420, 480, { photoIndex: 1, rotation: -4 }),
  slot(565, 1060, 420, 480, { photoIndex: 2, rotation: 3 }),
];
const panorama = entries.find((l) => l.name === "Panorama Hero");
panorama.photoCount = 4;
panorama.slots = [
  slot(100, 100, 2800, 950, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(100 + i * 950, 1100, 900, 540, { photoIndex: i + 1 }),
  ),
];
function thumbnail(l) {
  const shapes = l.slots
    .map((s) => {
      const transform = `translate(${s.x} ${s.y}) rotate(${s.rotation} ${s.width / 2} ${s.height / 2})`;
      let shape;
      if (s.mask === "circle")
        shape = `<circle cx="${s.width / 2}" cy="${s.height / 2}" r="${Math.min(s.width, s.height) / 2}"/>`;
      else if (s.mask === "heart")
        shape = `<path d="M50 100 C-50 35 15 -30 50 25 C85 -30 150 35 50 100" transform="scale(${s.width / 100} ${s.height / 100})"/>`;
      else if (s.mask === "arch")
        shape = `<path d="M0 100 L0 50 C0 -17 100 -17 100 50 L100 100Z" transform="scale(${s.width / 100} ${s.height / 100})"/>`;
      else
        shape = `<rect width="${s.width}" height="${s.height}" rx="${s.mask === "rounded" ? Math.min(s.width, s.height) * 0.18 : 12}"/>`;
      return `<g transform="${transform}" fill="#bac7b4">${shape}</g>`;
    })
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.width} ${l.height}"><rect width="100%" height="100%" fill="${l.background || "#faf8f2"}"/>${shapes}</svg>`)}`;
}
export const layouts = entries.map((l) => ({
  ...l,
  thumbnail: thumbnail(l),
}));
export const layoutCategories = [
  "All",
  "Featured",
  "Favorites",
  ...new Set(layouts.map((l) => l.category)),
];
export const defaultLayout = layouts[0];

````

## frontend/src/utils/session.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\src\utils\session.js

````javascript
export function sessionId() {
  let id = sessionStorage.getItem("photobooth_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("photobooth_session_id", id);
  }
  return id;
}

````

## frontend/vite.config.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\frontend\vite.config.js

````javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:5000" } },
});

````

## package.json

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\package.json

````json
{
  "name": "little-moments-photobooth",
  "private": true,
  "type": "module",
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "dev": "concurrently -k \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w frontend",
    "start": "npm run start -w backend",
    "test": "node --test tests/*.test.js",
    "test:browser": "playwright test",
    "source:bundle": "node scripts/export-source.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "concurrently": "^9.1.2",
    "prettier": "^3.9.6"
  },
  "overrides": {
    "qs": "6.16.0"
  }
}

````

## playwright.config.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\playwright.config.js

````javascript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    channel: "msedge",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
    permissions: ["camera"],
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60000,
  },
});

````

## scripts/check-env.mjs

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\scripts\check-env.mjs

````javascript
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const read = async path => {
  try { return parseEnv(await readFile(new URL(path, root), 'utf8')); }
  catch { console.log(`${path}: missing or unreadable`); return {}; }
};
const front = await read('frontend/.env');
const back = await read('backend/.env');
const report = (name, ok) => console.log(`${name}: ${ok ? 'PASS' : 'FAIL'}`);
for (const name of ['PORT','FRONTEND_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])
  report(`Backend ${name} is populated`, Boolean(back[name]?.trim()));
report('Frontend contains no server secret variables', !Object.keys(front).some(k => /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY/i.test(k)));
report('Backend secret is not present in frontend values', !back.SUPABASE_SERVICE_ROLE_KEY || !Object.values(front).some(v => v.includes(back.SUPABASE_SERVICE_ROLE_KEY)));
report('Frontend API matches backend local port', !front.VITE_API_URL || front.VITE_API_URL.replace(/\/$/,'') === `http://localhost:${back.PORT || 5000}`);
report('Backend allows local Vite origin', back.FRONTEND_URL === 'http://localhost:5173');
report('Retention is a nonnegative finite number', Number.isFinite(Number(back.PHOTO_RETENTION_DAYS ?? 7)) && Number(back.PHOTO_RETENTION_DAYS ?? 7) >= 0);
const key = back.SUPABASE_SERVICE_ROLE_KEY;
if (key) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  report('Key is a service-role JWT or server secret key', role === 'service_role' || key.startsWith('sb_secret_'));
}
if (back.SUPABASE_URL && key) {
  try {
    const client = createClient(back.SUPABASE_URL, key, {auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url, options) => fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
    const checks = await Promise.allSettled([
      client.from('photobooths').select('id,session_id,image_url,storage_path,layout,frame,photo_count,custom_text,event_name,created_at,expires_at').limit(0),
      client.storage.getBucket('photobooth-images'),
    ]);
    for (const [index, result] of checks.entries()) {
      const label = index === 0 ? 'Database table and required columns' : 'Storage bucket access';
      if (result.status === 'rejected') { console.log(`${label}: NETWORK/CONNECTION FAILED`); continue; }
      const {data,error} = result.value;
      if (error) {
        console.log(`${label}: FAIL (code ${String(error.code || error.status || error.statusCode || 'connection').replace(/[^a-zA-Z0-9_-]/g,'')})`);
        continue;
      }
      report(label,true);
      if (index === 1) {
        report('Storage bucket is private',data.public === false);
        report('Storage upload limit is 10 MB',Number(data.file_size_limit) === 10485760);
        report('Storage allows PNG and JPEG', ['image/png','image/jpeg'].every(type => data.allowed_mime_types?.includes(type)));
      }
    }
  } catch { console.log('Supabase client: configuration or connection failed'); }
}

````

## scripts/export-source.mjs

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\scripts\export-source.mjs

````javascript
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const ignored = new Set([
  "node_modules",
  "dist",
  ".git",
  ".codex",
  ".agents",
  "test-results",
  "SOURCE_CODE.md",
  "package-lock.json",
  ".env",
]);
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
let output =
  "# Complete project source\n\nEvery authored file below includes its full workspace path and complete contents. Dependency lockfiles, generated builds, screenshots and secret environment files are excluded.\n\n";
for (const path of (await walk(root)).sort()) {
  const extension = extname(path).slice(1);
  const language =
    {
      js: "javascript",
      mjs: "javascript",
      jsx: "jsx",
      json: "json",
      css: "css",
      sql: "sql",
      html: "html",
      md: "markdown",
    }[extension] || "text";
  output += `## ${relative(root, path).replaceAll("\\", "/")}\n\nFull path: ${path}\n\n\`\`\`\`${language}\n${await readFile(path, "utf8")}\n\`\`\`\`\n\n`;
}
await writeFile(resolve(root, "SOURCE_CODE.md"), output);
console.log("Created SOURCE_CODE.md with complete source files.");

````

## supabase/migration.sql

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\supabase\migration.sql

````sql
create extension if not exists pgcrypto;
create table if not exists public.photobooths (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 image_url text not null,
 storage_path text not null unique,
 layout text not null,
 frame text not null,
 photo_count integer not null check (photo_count in (1,2,3,4,6,8,9)),
 custom_text text,
 event_name text,
 created_at timestamptz not null default now(),
 expires_at timestamptz
);
create index if not exists photobooths_session_idx on public.photobooths(session_id,created_at desc);
create index if not exists photobooths_expiry_idx on public.photobooths(expires_at);
alter table public.photobooths enable row level security;
revoke all on public.photobooths from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('photobooth-images','photobooth-images',false,10485760,array['image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/png','image/jpeg'];

````

## tests/api-storage.test.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\tests\api-storage.test.js

````javascript
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://test.example.com";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { supabase } = await import("../backend/src/services/supabase.js");
const { app } = await import("../backend/src/server.js");
const rows = new Map(),
  objects = new Map();
// Replace only external persistence. HTTP routing, Multer, decoding, validation and ownership run unchanged.
supabase.storage.from = () => ({
  upload: async (path, buffer) => {
    objects.set(path, buffer);
    return { error: null };
  },
  download: async (path) => ({
    data: new Blob([objects.get(path)]),
    error: null,
  }),
  remove: async (paths) => {
    paths.forEach((p) => objects.delete(p));
    return { error: null };
  },
});
supabase.from = () => {
  let conditions = [],
    operation = "select",
    inserted,
    columns = "",
    active = false;
  const query = {
    select(c) {
      columns = c;
      return this;
    },
    insert(row) {
      operation = "insert";
      inserted = { created_at: new Date().toISOString(), ...row };
      return this;
    },
    delete() {
      operation = "delete";
      return this;
    },
    eq(k, v) {
      conditions.push((row) => row[k] === v);
      return this;
    },
    or() {
      active = true;
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    single() {
      return execute(true);
    },
    maybeSingle() {
      return execute(true);
    },
    then(resolve, reject) {
      return execute(false).then(resolve, reject);
    },
  };
  async function execute(single) {
    if (operation === "insert") rows.set(inserted.id, inserted);
    let data = [...rows.values()].filter(
      (row) =>
        conditions.every((fn) => fn(row)) &&
        (!active || !row.expires_at || new Date(row.expires_at) > new Date()),
    );
    if (operation === "insert") data = [inserted];
    if (operation === "delete") {
      data.forEach((row) => rows.delete(row.id));
      return { error: null };
    }
    if (columns)
      data = data.map((row) =>
        Object.fromEntries(columns.split(",").map((k) => [k, row[k]])),
      );
    return { data: single ? data[0] || null : data, error: null };
  }
  return query;
};
test("real HTTP upload, private metadata, gallery isolation, expiry and deletion with a storage test double", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/photobooths`;
  const session = "a6b2d4e1-1222-4bc1-8b11-0f94b8121729",
    other = "b6b2d4e1-1222-4bc1-8b11-0f94b8121729";
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#84976b" },
  })
    .png()
    .toBuffer();
  function form(bytes = png, type = "image/png") {
    const body = new FormData();
    body.set("image", new Blob([bytes], { type }), "photo.png");
    for (const [k, v] of Object.entries({
      session_id: session,
      layout: "classic-4-strip",
      frame: "classic-white",
      photo_count: "4",
      event_name: "Test memory",
      custom_text: "Hello",
    }))
      body.set(k, v);
    return body;
  }
  try {
    const bad = await fetch(base, {
      method: "POST",
      body: form(Buffer.from("not an image")),
    });
    assert.equal(bad.status, 400);
    const wrongFormat = await fetch(base, {
      method: "POST",
      body: form(png, "image/jpeg"),
    });
    assert.equal(wrongFormat.status, 400);
    const response = await fetch(base, { method: "POST", body: form() });
    assert.equal(response.status, 201);
    const photo = await response.json();
    assert.match(photo.share_url, new RegExp(`/photo/${photo.id}$`));
    assert.equal(photo.session_id, undefined);
    assert.equal(photo.storage_path, undefined);
    assert.equal(objects.size, 1);
    const publicPhoto = await (await fetch(`${base}/${photo.id}`)).json();
    assert.equal(publicPhoto.event_name, "Test memory");
    assert.equal(publicPhoto.session_id, undefined);
    const image = await fetch(`${base}/${photo.id}/image`);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(
      (await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width,
      32,
    );
    const list = await (
      await fetch(`${base}/session/${session}`, {
        headers: { "X-Session-Id": session },
      })
    ).json();
    assert.equal(list.length, 1);
    assert.equal(
      (
        await fetch(`${base}/session/${session}`, {
          headers: { "X-Session-Id": other },
        })
      ).status,
      400,
    );
    const otherList = await (
      await fetch(`${base}/session/${other}`, {
        headers: { "X-Session-Id": other },
      })
    ).json();
    assert.deepEqual(otherList, []);
    assert.equal(
      (
        await fetch(`${base}/${photo.id}`, {
          method: "DELETE",
          headers: { "X-Session-Id": other },
        })
      ).status,
      404,
    );
    rows.get(photo.id).expires_at = "2020-01-01T00:00:00.000Z";
    assert.equal((await fetch(`${base}/${photo.id}`)).status, 404);
    assert.equal((await fetch(`${base}/${photo.id}/image`)).status, 404);
    assert.equal(
      (
        await fetch(`${base}/${photo.id}`, {
          method: "DELETE",
          headers: { "X-Session-Id": session },
        })
      ).status,
      204,
    );
    assert.equal(objects.size, 0);
    assert.equal(rows.size, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

````

## tests/api.test.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\tests\api.test.js

````javascript
import test from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { app } = await import("../backend/src/server.js");
test("API health, unavailable cloud storage, CORS and safe errors", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(origin + "/api/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      storageConfigured: false,
    });
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      health.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    const gallery = await fetch(
      origin + "/api/photobooths/session/a6b2d4e1-1222-4bc1-8b11-0f94b8121729",
    );
    assert.equal(gallery.status, 503);
    assert.match((await gallery.json()).error, /not configured/);
    const missing = await fetch(origin + "/api/not-found");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), {
      error: "API endpoint not found.",
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
});

````

## tests/browser/photobooth.spec.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\tests\browser\photobooth.spec.js

````javascript
import { test, expect } from "@playwright/test";
test("desktop capture, edit, retake, export, and honest cloud error", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Little moments\. Big memories/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Start photobooth", exact: true })
    .click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page.getByRole("button", { name: "Let’s take some photos" }).click();
  await expect(
    page.getByRole("button", { name: "Start session", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: 25000 });
  await expect(page.getByAltText("Editing photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Sepia", exact: true }).click();
  await page.getByRole("link", { name: "Retake", exact: true }).click();
  await page
    .getByRole("button", { name: "Retake this photo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: 10000 });
  await page.getByRole("button", { name: "Create my photobooth" }).click();
  await expect(page.getByAltText("Your finished photobooth")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/photobooth-.*\.png/);
  const jpg = page.waitForEvent("download");
  await page.getByRole("button", { name: "JPG", exact: true }).click();
  expect((await jpg).suggestedFilename()).toMatch(/photobooth-.*\.jpg/);
  await page.getByRole("button", { name: "Save to my gallery" }).click();
  await expect(page.getByRole("status")).toContainText("not configured");
  await page.screenshot({
    path: "test-results/result-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile layout search, favorites, customization, navigation and no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Layouts", exact: true }).click();
  await page.getByRole("textbox", { name: "Search layouts" }).fill("9 photos");
  await expect(
    page.getByRole("button", { name: "Preview 3x3 Grid" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Favorite 3x3 Grid", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search layouts" }).fill("");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview 3x3 Grid" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview 3x3 Grid" }).click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page
    .getByRole("textbox", { name: "Event name", exact: true })
    .fill("Our favorite day");
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await page.screenshot({
    path: "test-results/setup-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "My gallery" }).click();
  await expect(
    page.getByText("Your gallery isn’t available yet."),
  ).toBeVisible();
});
test("all layouts render using the reusable engine including masks and duplicate strips", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { layouts } = await import("/src/utils/layouts.js");
    const { frames } = await import("/src/utils/frames.js");
    const { generateCanvas } = await import("/src/utils/canvasGenerator.js");
    const source = document.createElement("canvas");
    source.width = 100;
    source.height = 80;
    const c = source.getContext("2d");
    c.fillStyle = "red";
    c.fillRect(0, 0, 100, 80);
    const photos = Array.from({ length: 9 }, () => ({
      src: source.toDataURL(),
      filter: "Sepia",
      zoom: 1.1,
      panX: 40,
      adjustments: { grain: 2 },
    }));
    for (const layout of layouts) {
      const output = await generateCanvas(
        {
          layout,
          frame: frames[0],
          photos,
          settings: {
            eventName: "Test memory",
            message: "A day to remember",
            showDate: true,
          },
        },
        0.1,
      );
      if (!output.toDataURL().startsWith("data:image/png"))
        throw new Error(layout.name);
      if (layout.name === "Classic Film Strip") {
        const last = layout.slots.at(-1);
        const pixel = output
          .getContext("2d")
          .getImageData(
            Math.floor((last.x + last.width / 2) * 0.1),
            Math.floor((last.y + last.height / 2) * 0.1),
            1,
            1,
          ).data;
        if (pixel[0] > 230 && pixel[1] > 230)
          throw new Error("Film decorations covered the final photo");
      }
    }
    const { filteredBitmap } = await import("/src/utils/filterFallback.js");
    const fallback = filteredBitmap(source, "grayscale(1)");
    const pixel = fallback.getContext("2d").getImageData(0, 0, 1, 1).data;
    if (pixel[0] !== pixel[1] || pixel[1] !== pixel[2])
      throw new Error("Pixel grayscale fallback failed");
    const duplicate = await generateCanvas(
      {
        layout: layouts.find((l) => l.duplicate),
        frame: frames[10],
        photos,
        settings: { eventName: "Same memory", logo: source.toDataURL() },
      },
      0.1,
    );
    const duplicateContext = duplicate.getContext("2d");
    const first = duplicateContext.getImageData(
      0,
      0,
      duplicate.width / 2,
      duplicate.height,
    ).data;
    const second = duplicateContext.getImageData(
      duplicate.width / 2,
      0,
      duplicate.width / 2,
      duplicate.height,
    ).data;
    if (!first.every((value, index) => value === second[index]))
      throw new Error("Print strips are not identical");
    return layouts.length;
  });
  expect(result).toBeGreaterThanOrEqual(80);
});
test("uploaded photo, saved result, QR code, session gallery and delete with a cloud API test double", async ({
  page,
}) => {
  const id = "a6b2d4e1-1222-4bc1-8b11-0f94b8121729";
  let saved = false;
  const fixture = {
    id,
    event_name: "little moments",
    created_at: new Date().toISOString(),
    expires_at: null,
    image_url: `/api/photobooths/${id}/image`,
    share_url: `http://localhost:5173/photo/${id}`,
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/api/photobooths**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "POST") {
      saved = true;
      return route.fulfill({ status: 201, json: fixture });
    }
    if (request.method() === "DELETE") {
      saved = false;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith("/image"))
      return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname.includes("/session/"))
      return route.fulfill({ json: saved ? [fixture] : [] });
    return route.fulfill({ json: fixture });
  });
  await page.goto("/setup");
  await page
    .getByRole("textbox", { name: "Search layouts" })
    .fill("Single Polaroid");
  await page.getByRole("button", { name: "Preview Single Polaroid" }).click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page.getByRole("button", { name: "Let’s take some photos" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "memory.png", mimeType: "image/png", buffer: png });
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Create my photobooth" }).click();
  await expect(page.getByAltText("Your finished photobooth")).toBeVisible();
  await page.getByRole("button", { name: "Save to my gallery" }).click();
  await expect(
    page.getByRole("button", { name: "Saved to your gallery" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "QR code", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan to download" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("QR code linking to this photobooth"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close QR code" }).click();
  await page.getByRole("link", { name: "My gallery" }).click();
  await expect(page.getByAltText("little moments")).toBeVisible();
  await page.getByRole("button", { name: "Delete photo" }).click();
  await page
    .getByRole("button", { name: "Delete memory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your first memory starts here." }),
  ).toBeVisible();
});

````

## tests/layouts.test.js

Full path: C:\Users\JDNSI\Downloads\lance-project\PHOTOBOOTH\tests\layouts.test.js

````javascript
import test from "node:test";
import assert from "node:assert/strict";
import { layouts } from "../frontend/src/utils/layouts.js";
import { frames } from "../frontend/src/utils/frames.js";
import { metadata } from "../backend/src/validation.js";
test("library has every supported count, unique IDs, and exportable geometry", () => {
  assert.ok(layouts.length >= 80);
  assert.equal(new Set(layouts.map((l) => l.id)).size, layouts.length);
  assert.deepEqual(
    [...new Set(layouts.map((l) => l.photoCount))].sort((a, b) => a - b),
    [1, 2, 3, 4, 6, 8, 9],
  );
  for (const l of layouts) {
    assert.ok(l.width >= 1080 && l.height >= 1000, l.name);
    assert.ok(l.thumbnail.startsWith("data:image/svg+xml,"));
    const indices = new Set();
    for (const s of l.slots) {
      assert.ok(s.width > 0 && s.height > 0, l.name);
      assert.ok(s.x >= 0 && s.y >= 0, l.name);
      assert.ok(s.x + s.width <= l.width + 0.01, l.name);
      assert.ok(s.y + s.height <= l.height + 0.01, l.name);
      assert.ok(s.photoIndex >= 0 && s.photoIndex < l.photoCount, l.name);
      indices.add(s.photoIndex);
    }
    assert.equal(indices.size, l.photoCount, l.name);
  }
});
test("double strip repeats the same four photos at print resolution", () => {
  const l = layouts.find((l) => l.duplicate);
  assert.equal(l.photoCount, 4);
  assert.equal(l.slots.length, 8);
  for (let i = 0; i < 4; i++) {
    assert.equal(l.slots[i].photoIndex, l.slots[i + 4].photoIndex);
    assert.equal(l.slots[i + 4].x - l.slots[i].x, 1200);
  }
});
test("frame library is separate and has 20 unique configurations", () => {
  assert.equal(frames.length, 20);
  assert.equal(new Set(frames.map((f) => f.id)).size, 20);
  for (const f of frames) {
    assert.match(f.backgroundColor, /^#[a-f0-9]{6}$/i);
    assert.match(f.textColor, /^#[a-f0-9]{6}$/i);
  }
});
test("upload metadata accepts anonymous sessions and rejects bad counts and oversized text", () => {
  const good = {
    session_id: "a6b2d4e1-1222-4bc1-8b11-0f94b8121729",
    layout: layouts[0].id,
    frame: frames[0].id,
    photo_count: "4",
  };
  assert.ok(metadata.safeParse(good).success);
  for (const patch of [
    { session_id: "bad" },
    { photo_count: 5 },
    { event_name: "a".repeat(101) },
    { custom_text: "a".repeat(241) },
  ])
    assert.equal(metadata.safeParse({ ...good, ...patch }).success, false);
});

````

