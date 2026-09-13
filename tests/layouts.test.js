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
