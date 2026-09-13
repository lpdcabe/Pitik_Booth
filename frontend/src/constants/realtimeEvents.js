export const ROOM_EVENTS = Object.freeze({
  UPDATED: "room_updated", SIGNAL: "signal", PRESENCE: "presence", CONNECTED: "connected",
});
export const SIGNAL_TYPES = Object.freeze([
  "peer-joined", "offer", "answer", "ice-candidate", "peer-left", "reconnect", "camera-state",
]);
export const ROOM_STATES = Object.freeze([
  "waiting", "lobby", "ready", "countdown", "capturing", "uploading", "reviewing",
  "round_complete", "generating", "completed", "ended",
]);
