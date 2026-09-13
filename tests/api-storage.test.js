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
