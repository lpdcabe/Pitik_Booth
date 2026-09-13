import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { supabase } from "./supabase.js";

export const roomBucket = "room-photos";
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export const createToken = () => randomBytes(32).toString("base64url");
export const hostTokenFor = (participantToken) => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY).update(`booth-host:${participantToken}`).digest("base64url");
export const createRoomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("");
export const fail = (status, message) => Object.assign(new Error(message), { status });
export const roomSettings = z.object({
  photoCount: z.number().int().refine((n) => [1, 2, 3, 4, 6, 8, 9].includes(n)),
  layout: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  frame: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  maxParticipants: z.number().int().min(2).max(4).default(4),
  countdownSeconds: z.number().int().min(3).max(10).default(3),
  autoContinue: z.boolean().default(true),
});
export const identity = z.object({ participantId: z.string().uuid(), displayName: z.string().trim().min(1).max(40) });
export const createSchema = identity.merge(roomSettings);
export const joinSchema = identity.extend({ invite: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional() });
export const photoSchema = z.object({ round: z.coerce.number().int().min(1).max(9), captureId: z.string().uuid(), capturedAt: z.string().datetime({ offset: true }) });
export const actionSchemas = {
  ready: z.object({ ready: z.boolean(), cameraEnabled: z.boolean() }),
  heartbeat: z.object({ cameraEnabled: z.boolean(), currentState: z.string().max(30).optional() }),
  configure: roomSettings,
  captured: photoSchema.pick({ round: true, captureId: true }),
  accept: photoSchema.pick({ round: true, captureId: true }),
  retake: z.object({ participantId: z.string().uuid().optional(), all: z.boolean().default(false) }),
  remove: z.object({ participantId: z.string().uuid() }),
  start: z.object({}), next: z.object({}), leave: z.object({}), end: z.object({}),
  "claim-host": z.object({}), "retry-generation": z.object({}),
};
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw fail(400, "Please check the room details and try again.");
  return result.data;
}
export function normalizeCode(code) {
  const normalized = String(code || "").toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(normalized)) throw fail(400, "Enter a valid six-character room code.");
  return normalized;
}
export function readCredentials(req) {
  const participantId = req.get("X-Participant-Id");
  const participantToken = req.get("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!z.string().uuid().safeParse(participantId).success || !participantToken) throw fail(401, "Join this room to continue.");
  const hostToken = req.get("X-Host-Token");
  return { participantId, participantToken, hostToken: /^[A-Za-z0-9_-]{43}$/.test(hostToken || "") ? hostToken : undefined };
}
export function databaseError(error) {
  const status = { P0001: 409, P0002: 404, P0003: 403, P0010: 410 }[error.code];
  if (status) return fail(status, error.message);
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) return fail(503, "Booth Together needs its database migration. Please ask the site owner to finish setup.");
  return error;
}
export async function command(code, credentials, action, data = {}) {
  const { data: result, error } = await supabase.rpc("booth_room_command", {
    p_code: normalizeCode(code), p_actor: credentials.participantId,
    p_token_hash: hashToken(credentials.participantToken),
    p_host_hash: credentials.hostToken ? hashToken(credentials.hostToken) : null,
    p_action: action, p_data: data,
  });
  if (error) throw databaseError(error);
  return result;
}
export async function createRoom(data) {
  const participantToken = createToken(), inviteToken = createToken();
  const hostToken = hostTokenFor(participantToken);
  for (let i = 0; i < 5; i++) {
    const code = createRoomCode();
    const { data: result, error } = await supabase.rpc("booth_room_create", {
      p_code: code, p_actor: data.participantId, p_token_hash: hashToken(participantToken),
      p_host_hash: hashToken(hostToken), p_invite_hash: hashToken(inviteToken), p_data: data,
    });
    if (error?.code === "23505") continue;
    if (error) throw databaseError(error);
    return { ...result, credentials: { participantId: data.participantId, participantToken, hostToken, inviteToken }, inviteUrl: inviteUrl(code, inviteToken) };
  }
  throw fail(503, "Could not create a unique room. Please try again.");
}
export function inviteUrl(code, token) {
  const url = new URL(`/room/${code}`, process.env.FRONTEND_URL || "http://localhost:5173");
  if (token) url.searchParams.set("invite", token);
  return url.toString();
}
export function withHostCredentials(snapshot, credentials) {
  return snapshot.room.host_participant_id === credentials.participantId
    ? { ...snapshot, credentials: { participantId: credentials.participantId, hostToken: hostTokenFor(credentials.participantToken) } }
    : snapshot;
}
export async function requireMember(req, res, next) {
  try {
    req.roomCredentials = readCredentials(req);
    req.roomSnapshot = await command(req.params.code, req.roomCredentials, "snapshot");
    res.set("Cache-Control", "no-store");
    next();
  } catch (error) { next(error); }
}
