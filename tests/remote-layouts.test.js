import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRemoteLayout,
  getRemotePhotos,
  getRemoteTemplates,
  remoteLayouts,
} from "../frontend/src/utils/remoteLayouts.js";

const roster = (count) =>
  Array.from({ length: count }, (_, index) => ({
    participant_id: `participant-${index}`,
    display_name: `Guest ${index + 1}`,
  }));

test("remote template choices contain all 20 compatible duo, trio, and squad designs", () => {
  assert.equal(remoteLayouts.length, 20);
  assert.equal(new Set(remoteLayouts.map((layout) => layout.id)).size, 20);
  assert.deepEqual(
    [2, 3, 4].map((count) => getRemoteTemplates(count).length),
    [10, 5, 5],
  );
  assert.equal(getRemoteTemplates(1).length, 0);
  assert.equal(getRemoteTemplates(5).length, 0);
  for (const template of remoteLayouts) {
    assert.match(template.category, /^Remote (Duo|Trio|Squad)$/);
    assert.ok(template.thumbnail.startsWith("data:image/svg+xml,"));
    assert.ok(template.description);
  }
  const geometries = remoteLayouts.map((template) => {
    const layout = buildRemoteLayout(
      template.id,
      roster(template.participantCount),
      4,
    );
    return JSON.stringify([
      layout.width,
      layout.height,
      layout.slots.map(({ x, y, width, height, rotation, mask }) => [
        x,
        y,
        width,
        height,
        rotation,
        mask,
      ]),
    ]);
  });
  assert.equal(
    new Set(geometries).size,
    remoteLayouts.length,
    "Each template should offer a distinct composition.",
  );
});

test("all remote templates keep all participants and rounds within bounded export geometry", () => {
  for (const template of remoteLayouts) {
    for (let rounds = 1; rounds <= 9; rounds++) {
      const participants = roster(template.participantCount);
      const layout = buildRemoteLayout(template.id, participants, rounds);
      const label = `${template.name}, ${rounds} rounds`;
      assert.ok(layout.width <= 2400 && layout.height <= 5400, label);
      assert.ok(layout.width * layout.height <= 12960000, label);
      assert.equal(layout.photoCount, participants.length * rounds, label);
      assert.equal(layout.roundCount, rounds, label);
      assert.equal(layout.slots.length, layout.photoCount, label);
      assert.equal(
        new Set(layout.slots.map((slot) => slot.photoIndex)).size,
        layout.photoCount,
        label,
      );
      for (const slot of layout.slots) {
        assert.ok(
          slot.width >= 80 && slot.height >= 80,
          `${label}: usable portrait dimensions`,
        );
        assert.equal(
          slot.participantId,
          participants[slot.participantIndex].participant_id,
          label,
        );
        assert.equal(
          slot.photoIndex,
          (slot.round - 1) * participants.length + slot.participantIndex,
          label,
        );
        assert.ok(slot.round >= 1 && slot.round <= rounds, label);
        assert.ok(
          slot.photoIndex >= 0 && slot.photoIndex < layout.photoCount,
          label,
        );
        const paper = layout.decoration === "polaroid";
        const left = -slot.width / 2 - (paper ? 22 : 0);
        const right = slot.width / 2 + (paper ? 22 : 0);
        const top = -slot.height / 2 - (paper ? 22 : 0);
        const bottom = slot.height / 2 + (paper ? 73 : 0);
        const angle = (slot.rotation * Math.PI) / 180;
        for (const [x, y] of [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom],
        ]) {
          const rotatedX =
            slot.x + slot.width / 2 + x * Math.cos(angle) - y * Math.sin(angle);
          const rotatedY =
            slot.y +
            slot.height / 2 +
            x * Math.sin(angle) +
            y * Math.cos(angle);
          assert.ok(
            rotatedX >= 0 && rotatedX <= layout.width,
            `${label}: rotated horizontal bound`,
          );
          assert.ok(
            rotatedY >= 0 && rotatedY <= layout.height * 0.85,
            `${label}: preserve caption space`,
          );
        }
      }
    }
  }
});

test("photo mapping uses stable participant IDs and rounds regardless of fetch or drawing order", () => {
  const layout = buildRemoteLayout("remote-group-collage", roster(4), 2);
  const rows = [
    {
      participant_id: "participant-2",
      round: 2,
      src: "blob:second-round-third-person",
      approved: true,
    },
    {
      participant_id: "participant-0",
      round: 1,
      src: "blob:first-round-first-person",
      approved: false,
    },
    {
      participant_id: "participant-1",
      round: 1,
      image_url: "https://storage.invalid/no-local-src",
    },
    { participant_id: "another-room-person", round: 1, src: "blob:other" },
    { participant_id: "participant-2", round: 9, src: "blob:another-round" },
  ];
  const photos = getRemotePhotos(layout, rows);
  assert.equal(photos.length, 8);
  assert.equal(photos[0].src, rows[1].src);
  assert.equal(photos[0].fit, "cover");
  assert.equal(photos[6].src, rows[0].src);
  assert.equal(photos.filter(Boolean).length, 2);
  assert.equal(photos[1], null);
  assert.deepEqual(getRemotePhotos(layout), Array(8).fill(null));
});

test("remote layout validation prevents roster drift and unreasonable canvas requests", () => {
  assert.throws(
    () => buildRemoteLayout("unknown", roster(2), 4),
    /valid Booth Together layout/,
  );
  assert.throws(
    () => buildRemoteLayout("remote-duo-grid", roster(3), 4),
    /needs 2 participants/,
  );
  assert.throws(
    () =>
      buildRemoteLayout(
        "remote-duo-grid",
        [{ participant_id: "same" }, { participant_id: "same" }],
        4,
      ),
    /unique ID/,
  );
  assert.throws(
    () => buildRemoteLayout("remote-duo-grid", [{}, {}], 4),
    /unique ID/,
  );
  for (const rounds of [0, -1, 1.5, 10, 1000, NaN, Infinity, "4"]) {
    assert.throws(
      () => buildRemoteLayout("remote-duo-grid", roster(2), rounds),
      /1 and 9/,
    );
  }
});
