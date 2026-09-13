import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import sharp from "sharp";
import { supabase, bucket } from "../services/supabase.js";
import {
  actionSchemas, command, createRoom, createSchema, createToken, databaseError, fail,
  hashToken, hostTokenFor, inviteUrl, joinSchema, normalizeCode, parse, photoSchema,
  roomBucket, withHostCredentials,
} from "../services/roomService.js";
import { publishSignal, publishSnapshot } from "../services/roomRealtime.js";

export async function create(req, res) {
  const result = await createRoom(parse(createSchema, req.body));
  res.status(201).json(result);
}
export async function info(req, res) {
  const code = normalizeCode(req.params.code);
  const { data, error } = await supabase.from("rooms").select("room_code,status,photo_count,layout,frame,max_participants,countdown_seconds,expires_at").eq("room_code", code).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw fail(404, "Room not found. Check your invitation or room code.");
  if (new Date(data.expires_at).getTime() <= Date.now() || data.status === "ended") throw fail(410, "This room has expired or ended.");
  const { count, error: countError } = await supabase.from("room_participants").select("id", { count: "exact", head: true }).eq("room_id", (await supabase.from("rooms").select("id").eq("room_code", code).single()).data?.id).not("status", "in", '("left","removed")');
  if (countError) throw countError;
  res.set("Cache-Control", "no-store").json({ room: { ...data, participant_count: count, full: count >= data.max_participants } });
}
export async function join(req, res) {
  const data = parse(joinSchema, req.body);
  const participantToken = createToken();
  const credentials = { participantId: data.participantId, participantToken };
  const snapshot = await command(req.params.code, credentials, "join", {
    displayName: data.displayName, hostHash: hashToken(hostTokenFor(participantToken)),
    ...(data.invite ? { inviteHash: hashToken(data.invite) } : {}),
  });
  await publishSnapshot(snapshot);
  res.status(201).json({ ...snapshot, credentials, inviteUrl: inviteUrl(snapshot.room.room_code, data.invite) });
}
export async function snapshot(req, res) {
  res.json(withHostCredentials(req.roomSnapshot, req.roomCredentials));
}
export async function action(req, res) {
  const action = req.body?.action;
  if (!Object.hasOwn(actionSchemas, action)) throw fail(400, "Unknown room control.");
  const data = parse(actionSchemas[action], req.body);
  let obsoletePaths = [];
  if (action === "retake") {
    let query = supabase.from("room_photos").select("storage_path").eq("room_id", req.roomSnapshot.room.id).eq("round", req.roomSnapshot.room.current_round);
    if (!data.all) query = query.eq("participant_id", req.roomCredentials.participantId);
    const { data: rows, error } = await query;
    if (error) throw error;
    obsoletePaths = rows.map((p) => p.storage_path);
  }
  const result = await command(req.params.code, req.roomCredentials, action, data);
  if (obsoletePaths.length) {
    const { error } = await supabase.storage.from(roomBucket).remove(obsoletePaths);
    if (error) console.warn("Retake cleanup deferred until expiry.");
  }
  // A plain heartbeat refreshes Presence, but needn't fan out persisted room
  // snapshots unless a connection/state changed. It also repairs missed events
  // for the caller through the response below.
  if (action !== "heartbeat" || req.roomSnapshot.participants.some((p) => p.participant_id === req.roomCredentials.participantId && (["left", "disconnected"].includes(p.status) || p.camera_enabled !== data.cameraEnabled))) {
    await publishSnapshot(result);
  }
  res.json(withHostCredentials(result, req.roomCredentials));
}
async function decodeUpload(file) {
  if (!file) throw fail(400, "Choose a PNG or JPG image.");
  let metadata;
  try { metadata = await sharp(file.buffer, { limitInputPixels: 40000000 }).metadata(); }
  catch { throw fail(400, "This image could not be read."); }
  if (!["png", "jpeg"].includes(metadata.format) || `image/${metadata.format}` !== file.mimetype) throw fail(400, "The image contents must match PNG or JPEG.");
  const image = await sharp(file.buffer, { limitInputPixels: 40000000 }).rotate().png().toBuffer();
  if (image.byteLength > 10 * 1024 * 1024) throw fail(413, "Please use a photo smaller than 10 MB.");
  return image;
}
export async function uploadPhoto(req, res) {
  const data = parse(photoSchema, req.body);
  const actor = req.roomSnapshot.participants.find((p) => p.participant_id === req.roomCredentials.participantId);
  if (actor.capture_id !== data.captureId || req.roomSnapshot.room.current_round !== data.round || !req.roomSnapshot.room.roster.includes(actor.participant_id)) throw fail(409, "This capture has been replaced. Use the current photo.");
  // Idempotent upload retry after a lost HTTP response.
  if (req.roomSnapshot.photos.some((p) => p.participant_id === actor.participant_id && p.round === data.round && p.capture_id === data.captureId)) return res.json(req.roomSnapshot);
  const capturedAt = new Date(data.capturedAt).getTime();
  if (capturedAt < new Date(actor.capture_at).getTime() - 2000 || capturedAt > Date.now() + 10000) throw fail(400, "The capture time is invalid. Synchronize your clock and retake.");
  const image = await decodeUpload(req.file);
  const id = randomUUID();
  const storagePath = `${req.roomSnapshot.room.id}/${id}.png`;
  const { error: uploadError } = await supabase.storage.from(roomBucket).upload(storagePath, image, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  let result;
  try {
    result = await command(req.params.code, req.roomCredentials, "store-photo", {
      ...data, id, storagePath, imageUrl: `/api/rooms/${req.roomSnapshot.room.room_code}/photos/${id}/image`,
    });
  } catch (error) {
    await supabase.storage.from(roomBucket).remove([storagePath]);
    throw error;
  }
  await publishSnapshot(result);
  res.status(201).json(result);
}
export async function photoImage(req, res) {
  if (!z.string().uuid().safeParse(req.params.photoId).success) throw fail(400, "Invalid photo.");
  const { data, error } = await supabase.from("room_photos").select("storage_path").eq("id", req.params.photoId).eq("room_id", req.roomSnapshot.room.id).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, "This photo was retaken or is no longer available.");
  const { data: blob, error: downloadError } = await supabase.storage.from(roomBucket).download(data.storage_path);
  if (downloadError) throw downloadError;
  res.set({ "Content-Type": "image/png", "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "cross-origin" }).send(Buffer.from(await blob.arrayBuffer()));
}
export async function uploadResult(req, res) {
  const { participantId, participantToken, hostToken } = req.roomCredentials;
  const expected = hostTokenFor(participantToken);
  if (req.roomSnapshot.room.host_participant_id !== participantId || !hostToken || !timingSafeEqual(Buffer.from(hostToken), Buffer.from(expected))) throw fail(403, "Only the current host can save the final photobooth.");
  if (req.roomSnapshot.room.result_id) return res.json(req.roomSnapshot);
  if (req.roomSnapshot.room.status !== "generating") throw fail(409, "Everyone must approve every round first.");
  const { sessionId } = parse(z.object({ sessionId: z.string().uuid() }), req.body);
  const image = await decodeUpload(req.file);
  const id = randomUUID(), storagePath = `photobooths/${id}.png`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, image, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  const days = Number(process.env.PHOTO_RETENTION_DAYS ?? 7);
  let result;
  try {
    result = await command(req.params.code, req.roomCredentials, "store-result", {
      id, sessionId, storagePath, imageUrl: `/api/photobooths/${id}/image`,
      expiresAt: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    });
  } catch (error) { await supabase.storage.from(bucket).remove([storagePath]); throw error; }
  // Concurrent host retries may have completed the room while this uploaded.
  if (result.room.result_id !== id) await supabase.storage.from(bucket).remove([storagePath]);
  await publishSnapshot(result);
  res.status(201).json(result);
}
const signalSchema = z.object({
  type: z.enum(["peer-joined", "offer", "answer", "ice-candidate", "peer-left", "reconnect", "camera-state"]),
  toParticipantId: z.string().uuid().optional(), payload: z.record(z.unknown()).default({}),
});
export async function signal(req, res) {
  const data = parse(signalSchema, req.body);
  const member = req.roomSnapshot.participants.find((p) => p.participant_id === req.roomCredentials.participantId);
  if (["left", "removed"].includes(member.status) || req.roomSnapshot.room.status === "ended") throw fail(403, "Reconnect to this room first.");
  if (["offer", "answer", "ice-candidate"].includes(data.type) && !data.toParticipantId) throw fail(400, "A recipient is required for this camera signal.");
  if (data.toParticipantId && !req.roomSnapshot.participants.some((p) => p.participant_id === data.toParticipantId && !["removed", "left"].includes(p.status))) throw fail(404, "That participant is no longer connected.");
  await publishSignal(req.roomSnapshot.room.id, { ...data, roomId: req.roomSnapshot.room.id, fromParticipantId: req.roomCredentials.participantId });
  res.status(202).json({ ok: true });
}
