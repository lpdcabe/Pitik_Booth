import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Execute the production functions against embedded PostgreSQL. Only Supabase's
// storage catalog and roles are stubbed; transaction/state/auth logic is real SQL.
const db = new PGlite();
const migration = async (file) =>
  (
    await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8")
  ).replace(/create extension if not exists pgcrypto;/gi, "");
let roomMigration;
before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `);
  await db.exec(await migration("migration.sql"));
  roomMigration = await migration("booth-together.sql");
  await db.exec(roomMigration);
});
after(async () => db.close());

const person = () => ({
  id: randomUUID(),
  token: randomUUID(),
  host: randomUUID(),
});
const settings = {
  photoCount: 2,
  layout: "remote-duo-grid",
  frame: "classic-white",
  maxParticipants: 2,
  countdownSeconds: 3,
  autoContinue: false,
  displayName: "Host",
};
let codeCounter = 0;
async function create(options = {}) {
  const host = person();
  const code = `TEST${String.fromCharCode(65 + Math.floor(codeCounter / 26))}${String.fromCharCode(65 + (codeCounter++ % 26))}`;
  const { rows } = await db.query(
    "select public.booth_room_create($1,$2,$3,$4,$5,$6::jsonb) as snapshot",
    [
      code,
      host.id,
      host.token,
      host.host,
      "invite-hash",
      JSON.stringify({ ...settings, ...options }),
    ],
  );
  return { code, host, snapshot: rows[0].snapshot };
}
async function command(room, actor, action, data = {}) {
  const { rows } = await db.query(
    "select public.booth_room_command($1,$2,$3,$4,$5,$6::jsonb) as snapshot",
    [
      room.code,
      actor.id,
      actor.token,
      actor.host,
      action,
      JSON.stringify(data),
    ],
  );
  return rows[0].snapshot;
}
async function join(room, guest = person(), data = {}) {
  await command(room, guest, "join", {
    displayName: "Guest",
    hostHash: guest.host,
    ...data,
  });
  return guest;
}
async function ready(room, actor) {
  return command(room, actor, "ready", { ready: true, cameraEnabled: true });
}
async function start(room, guest) {
  await ready(room, room.host);
  await ready(room, guest);
  return command(room, room.host, "start");
}
async function elapseCountdown(room) {
  // Advance only the fixture timestamps rather than slowing every test with a timer.
  await db.query(
    "update public.room_participants set capture_at=now()-interval '2 seconds' where room_id=$1",
    [room.snapshot.room.id],
  );
  await db.query(
    "update public.rooms set capture_at=now()-interval '2 seconds' where id=$1",
    [room.snapshot.room.id],
  );
}
async function upload(room, actor) {
  const snapshot = await command(room, actor, "snapshot");
  const member = snapshot.participants.find(
    (p) => p.participant_id === actor.id,
  );
  const id = randomUUID();
  return command(room, actor, "store-photo", {
    id,
    round: snapshot.room.current_round,
    captureId: member.capture_id,
    imageUrl: `/api/rooms/${room.code}/photos/${id}/image`,
    storagePath: `${snapshot.room.id}/${id}.png`,
    capturedAt: new Date().toISOString(),
  });
}
async function accept(room, actor) {
  const snapshot = await command(room, actor, "snapshot");
  const member = snapshot.participants.find(
    (p) => p.participant_id === actor.id,
  );
  return command(room, actor, "accept", {
    round: snapshot.room.current_round,
    captureId: member.capture_id,
  });
}

test("room migration is repeatable and private; creation returns sanitized settings and host", async () => {
  await db.exec(roomMigration);
  const room = await create();
  assert.equal(room.snapshot.room.room_code, room.code);
  assert.equal(room.snapshot.room.status, "lobby");
  assert.equal(room.snapshot.room.photo_count, 2);
  assert.equal(room.snapshot.room.max_participants, 2);
  assert.equal(room.snapshot.room.auto_continue, false);
  assert.equal(room.snapshot.participants.length, 1);
  assert.equal(room.snapshot.participants[0].is_host, true);
  assert.equal(room.snapshot.participants[0].participant_id, room.host.id);
  for (const secret of ["invite_token_hash", "token_hash", "host_token_hash"]) {
    assert.equal(
      JSON.stringify(room.snapshot).includes(`\"${secret}\"`),
      false,
    );
  }
  const { rows } = await db.query(`
    select has_function_privilege('anon','public.booth_room_create(text,uuid,text,text,text,jsonb)','EXECUTE') as anon_create,
      has_function_privilege('authenticated','public.booth_room_command(text,uuid,text,text,text,jsonb)','EXECUTE') as user_command,
      has_function_privilege('service_role','public.booth_room_command(text,uuid,text,text,text,jsonb)','EXECUTE') as server_command,
      (select public from storage.buckets where id='room-photos') as bucket_public,
      (select bool_and(relrowsecurity) from pg_class where relname in ('rooms','room_participants','room_photos')) as rls;
  `);
  assert.deepEqual(rows[0], {
    anon_create: false,
    user_command: false,
    server_command: true,
    bucket_public: false,
    rls: true,
  });
  await assert.rejects(create({ displayName: "" }), /display_name/);
  const { rows: orphans } = await db.query(
    "select id from public.rooms r where not exists(select 1 from public.room_participants p where p.room_id=r.id)",
  );
  assert.equal(
    orphans.length,
    0,
    "A failed participant insert rolls back room creation.",
  );
});

test("joining enforces capacity and invite validity; identities and host controls are authenticated", async () => {
  const room = await create();
  await assert.rejects(
    join(room, person(), { inviteHash: "wrong" }),
    /invite link is invalid/,
  );
  const guest = await join(room, person(), { inviteHash: "invite-hash" });
  await assert.rejects(join(room, guest), /already joined/);
  await assert.rejects(join(room), /room is full/);
  await assert.rejects(
    command(room, person(), "snapshot"),
    /session is invalid/,
  );
  await assert.rejects(
    command(room, { ...guest, token: "wrong" }, "snapshot"),
    /session is invalid/,
  );
  await assert.rejects(
    command(room, guest, "configure", settings),
    /Only the current host/,
  );
  await assert.rejects(
    command(room, { ...room.host, host: null }, "end"),
    /Only the current host/,
  );
  await assert.rejects(
    command(room, room.host, "ready", { ready: true, cameraEnabled: false }),
    /Turn on your camera/,
  );
  await assert.rejects(
    command(room, room.host, "start"),
    /Everyone needs a camera/,
  );
  await ready(room, room.host);
  await assert.rejects(
    command(room, room.host, "start"),
    /Everyone needs a camera/,
  );
  await ready(room, guest);
  const configured = await command(room, room.host, "configure", {
    ...settings,
    photoCount: 3,
  });
  assert.equal(configured.room.photo_count, 3);
  assert.ok(configured.participants.every((p) => !p.ready));
  await start(room, guest);
  await assert.rejects(join(room), /already started/);
  await assert.rejects(
    command(room, room.host, "configure", settings),
    /Settings are locked/,
  );
});

test("real captures, individual and group retakes, approvals, next round and final result are transactional", async () => {
  const room = await create();
  const guest = await join(room);
  const started = await start(room, guest);
  assert.equal(started.room.current_round, 1);
  assert.equal(started.room.status, "countdown");
  assert.equal(started.room.roster.length, 2);
  assert.ok(
    started.participants.every((p) => p.capture_id === started.room.capture_id),
  );
  await assert.rejects(
    upload(room, room.host),
    /Wait for the scheduled capture/,
  );
  await elapseCountdown(room);
  await upload(room, room.host);
  await assert.rejects(upload(room, room.host), /already uploaded/);
  await upload(room, guest);
  await assert.rejects(
    command(room, guest, "retake", { participantId: room.host.id }),
    /only retake your own/,
  );
  await assert.rejects(
    command(room, guest, "retake", { all: true }),
    /Only the current host/,
  );
  const retaken = await command(room, guest, "retake");
  assert.equal(retaken.photos.length, 1);
  assert.equal(retaken.photos[0].participant_id, room.host.id);
  assert.equal(retaken.photos[0].storage_path, undefined);
  const guestAttempt = retaken.participants.find(
    (p) => p.participant_id === guest.id,
  ).capture_id;
  assert.notEqual(guestAttempt, started.room.capture_id);
  await assert.rejects(
    command(room, guest, "accept", {
      round: 1,
      captureId: started.room.capture_id,
    }),
    /no longer current/,
  );
  await elapseCountdown(room);
  await upload(room, guest);
  await accept(room, room.host);
  await assert.rejects(
    command(room, room.host, "next"),
    /everyone has approved/,
  );
  const complete = await accept(room, guest);
  assert.equal(complete.room.status, "round_complete");
  const groupRetake = await command(room, room.host, "retake", { all: true });
  assert.equal(groupRetake.photos.length, 0);
  assert.equal(groupRetake.room.status, "countdown");
  await elapseCountdown(room);
  await upload(room, room.host);
  await upload(room, guest);
  await accept(room, room.host);
  await accept(room, guest);
  const next = await command(room, room.host, "next");
  assert.equal(next.room.current_round, 2);
  assert.equal(next.room.status, "countdown");
  await elapseCountdown(room);
  await upload(room, room.host);
  await upload(room, guest);
  await accept(room, room.host);
  const final = await accept(room, guest);
  assert.equal(final.room.status, "generating");
  assert.equal(final.photos.length, 4);
  assert.ok(final.photos.every((p) => p.approved));
  const id = randomUUID();
  const result = await command(room, room.host, "store-result", {
    id,
    sessionId: randomUUID(),
    imageUrl: `/api/photobooths/${id}/image`,
    storagePath: `photobooths/${id}.png`,
    expiresAt: null,
  });
  assert.equal(result.room.status, "completed");
  assert.equal(result.room.result_id, id);
  const retried = await command(room, room.host, "store-result", {
    id: randomUUID(),
  });
  assert.equal(retried.room.result_id, id);
});

test("disconnects freeze progress, reconnect restores review, and only the eligible participant can recover host", async () => {
  const room = await create({ maxParticipants: 3 });
  const guest = await join(room);
  const later = await join(room);
  await assert.rejects(
    command(room, guest, "claim-host"),
    /host is still connected/,
  );
  await ready(room, later);
  const started = await start(room, guest);
  await elapseCountdown(room);
  await upload(room, room.host);
  await upload(room, guest);
  await accept(room, room.host);
  await accept(room, guest);
  const disconnected = await command(room, later, "disconnect");
  assert.deepEqual(disconnected.room.roster, started.room.roster);
  assert.equal(disconnected.room.current_round, 1);
  assert.equal(disconnected.room.status, "uploading");
  const reconnected = await command(room, later, "heartbeat", {
    cameraEnabled: true,
  });
  assert.equal(
    reconnected.participants.find((p) => p.participant_id === later.id).status,
    "uploading",
  );
  await upload(room, later);
  await accept(room, later);
  await command(room, guest, "disconnect");
  const guestBack = await command(room, guest, "heartbeat", {
    cameraEnabled: true,
  });
  assert.equal(
    guestBack.participants.find((p) => p.participant_id === guest.id).status,
    "accepted",
  );
  await command(room, room.host, "leave");
  await assert.rejects(
    command(room, later, "claim-host"),
    /earliest connected participant/,
  );
  const recovered = await command(room, guest, "claim-host");
  assert.equal(recovered.room.host_participant_id, guest.id);
  assert.equal(recovered.participants.filter((p) => p.is_host).length, 1);
  await assert.rejects(command(room, room.host, "next"), /Reconnect before/);
  await command(room, room.host, "heartbeat", { cameraEnabled: true });
  await assert.rejects(
    command(room, room.host, "next"),
    /Only the current host/,
  );
  const next = await command(room, guest, "next");
  assert.equal(next.room.current_round, 2);
});

test("auto continue waits for every approval, explicit removal can advance, and ended/expired rooms reject actions", async () => {
  const room = await create({ autoContinue: true, countdownSeconds: 7 });
  const guest = await join(room);
  await start(room, guest);
  await elapseCountdown(room);
  await upload(room, room.host);
  await upload(room, guest);
  const waiting = await accept(room, room.host);
  assert.equal(waiting.room.current_round, 1);
  const advanced = await accept(room, guest);
  assert.equal(advanced.room.current_round, 2);
  const remainingCountdown =
    new Date(advanced.room.capture_at).getTime() - Date.now();
  assert.ok(
    remainingCountdown > 6500 && remainingCountdown <= 8500,
    "Every round must respect the chosen seven-second countdown plus scheduling buffer.",
  );
  await elapseCountdown(room);
  await upload(room, room.host);
  await accept(room, room.host);
  const removed = await command(room, room.host, "remove", {
    participantId: guest.id,
  });
  assert.deepEqual(removed.room.roster, [room.host.id]);
  assert.equal(removed.room.status, "generating");
  await assert.rejects(command(room, guest, "snapshot"), /session is invalid/);
  await command(room, room.host, "end");
  await assert.rejects(
    command(room, room.host, "heartbeat", { cameraEnabled: true }),
    /host ended this room/,
  );
  await assert.rejects(join(room), /already started/);
  await db.query(
    "update public.rooms set expires_at=now()-interval '1 second' where id=$1",
    [room.snapshot.room.id],
  );
  await assert.rejects(
    command(room, room.host, "snapshot"),
    /room has expired/,
  );
});
