import test from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.FRONTEND_URL = "http://localhost:5173/";
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
