import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase.js";
import { command, fail } from "./roomService.js";

// Each SSE subscriber has a separate socket/channel so Supabase Presence tracks
// individual browsers. Private channel access and the service key stay on Express.
const streams = new Map();
const topic = (id) => `booth-room:${id}`;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const snapshotPayload = ({ room, participants, photos }) => ({ room, participants, photos });
function write(res, event) {
  if (!res.writableEnded && !res.destroyed) {
    if (res.writableLength > 512 * 1024) return res.end();
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
async function httpBroadcast(roomId, event, payload) {
  const channel = supabase.channel(topic(roomId), { config: { private: true } });
  try {
    const result = await channel.httpSend(event, payload);
    if (result?.success === false) throw new Error("Realtime broadcast failed.");
  } finally { await supabase.removeChannel(channel); }
}
export async function publishSnapshot(snapshot) {
  // Database writes have already committed. A transient broadcast failure must
  // not turn a successful upload into an apparent failure. Heartbeats/reconnects
  // return persisted snapshots and repair a missed notification.
  try { await httpBroadcast(snapshot.room.id, "room_updated", { snapshot: snapshotPayload(snapshot) }); }
  catch (error) { console.warn("Room state broadcast unavailable:", error.message); }
  await Promise.allSettled([...streams.values()].filter((s) => s.roomId === snapshot.room.id).map((s) => s.track(snapshot)));
}
export async function publishSignal(roomId, signal) {
  try { await httpBroadcast(roomId, "signal", signal); }
  catch { throw fail(503, "We're having trouble connecting to your friend. Please try again."); }
}
export async function openRoomEvents(req, res) {
  const credentials = req.roomCredentials;
  const code = req.params.code;
  const roomId = req.roomSnapshot.room.id;
  // A room session owns at most two streams during a reconnect overlap.
  const key = `${roomId}:${credentials.participantId}`;
  streams.get(key)?.close();
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, authOptions);
  const channel = client.channel(topic(roomId), { config: { private: true, broadcast: { self: false }, presence: { key: credentials.participantId } } });
  let closed = false, keepalive, expiryTimer, subscribed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepalive); clearTimeout(expiryTimer);
    if (streams.get(key)?.channel === channel) streams.delete(key);
    void client.removeAllChannels().finally(() => client.realtime.disconnect());
    if (!res.writableEnded) res.end();
  };
  const track = async (snapshot) => {
    const person = snapshot.participants.find((p) => p.participant_id === credentials.participantId);
    if (!person || ["removed", "left"].includes(person.status) || snapshot.room.status === "ended") {
      write(res, { type: "room_updated", snapshot: snapshotPayload(snapshot) }); close(); return;
    }
    if (subscribed) await channel.track({ participantId: person.participant_id, displayName: person.display_name, joinedAt: person.joined_at, ready: person.ready, cameraEnabled: person.camera_enabled, currentState: person.status });
  };
  channel.on("broadcast", { event: "room_updated" }, ({ payload }) => {
    if (!payload?.snapshot) return;
    const snapshot = payload.snapshot;
    write(res, { type: "room_updated", snapshot });
    const person = snapshot.participants.find((p) => p.participant_id === credentials.participantId);
    if (!person || ["removed", "left"].includes(person.status) || snapshot.room.status === "ended") close();
  });
  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    if (payload?.fromParticipantId !== credentials.participantId && (!payload?.toParticipantId || payload.toParticipantId === credentials.participantId)) write(res, { type: "signal", signal: payload });
  });
  channel.on("presence", { event: "sync" }, () => write(res, { type: "presence", participants: Object.values(channel.presenceState()).flat() }));
  req.on("close", close);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  streams.set(key, { roomId, channel, track, close });
  keepalive = setInterval(() => { if (!closed) res.write(": keepalive\n\n"); }, 20000);
  expiryTimer = setTimeout(() => { write(res, { type: "error", error: "This room has expired." }); close(); }, Math.max(1, new Date(req.roomSnapshot.room.expires_at).getTime() - Date.now()));
  const connectionTimer = setTimeout(() => { if (!subscribed) { write(res, { type: "error", error: "Live room connection timed out. Reconnecting…" }); close(); } }, 15000);
  channel.subscribe(async (status) => {
    if (closed) return;
    if (status === "SUBSCRIBED") {
      clearTimeout(connectionTimer); subscribed = true;
      try {
        // Subscribe FIRST, then read current persisted state, closing the lost-
        // event window between the original authorization check and subscription.
        const snapshot = await command(code, credentials, "snapshot");
        await track(snapshot);
        write(res, { type: "room_updated", snapshot: snapshotPayload(snapshot) });
        write(res, { type: "connected" });
      } catch { write(res, { type: "error", error: "Your room is no longer available." }); close(); }
    } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      clearTimeout(connectionTimer);
      write(res, { type: "error", error: "Live room connection interrupted. Reconnecting…" }); close();
    }
  });
}
