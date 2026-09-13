const prefix = "photobooth_room_";
const fallback = new Map();

function read(key) {
  try { return sessionStorage.getItem(key) ?? fallback.get(key) ?? null; }
  catch { return fallback.get(key) ?? null; }
}
function write(key, value) {
  fallback.set(key, value);
  try { sessionStorage.setItem(key, value); } catch { /* Memory keeps this tab usable. */ }
}

export function participantId() {
  let id = read("photobooth_participant_id");
  if (!id) {
    id = crypto.randomUUID();
    write("photobooth_participant_id", id);
  }
  return id;
}
export const getParticipantId = participantId;
export const getDisplayName = () => read("photobooth_display_name") || "";
export const normalizeRoomCode = (code = "") => String(code).trim().toUpperCase();

export function getRoomSession(code) {
  try { return JSON.parse(read(prefix + normalizeRoomCode(code)) || "null"); }
  catch { return null; }
}

export function saveRoomSession(code, credentials, extra = {}) {
  const normalized = normalizeRoomCode(code);
  const previous = getRoomSession(normalized) || {};
  const value = { ...previous, ...extra, ...credentials, roomCode: normalized };
  write(prefix + normalized, JSON.stringify(value));
  write("photobooth_room_code", normalized);
  if (value.displayName) write("photobooth_display_name", value.displayName);
  return value;
}

export function clearRoomSession(code) {
  const key = prefix + normalizeRoomCode(code);
  fallback.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}
