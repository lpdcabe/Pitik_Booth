import { participantId, normalizeRoomCode, saveRoomSession } from "../utils/roomSession";

export const roomApiBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const roomPath = (code) => `/api/rooms/${encodeURIComponent(normalizeRoomCode(code))}`;

export function roomHeaders(credentials = {}) {
  return {
    ...(credentials.participantToken ? { Authorization: `Bearer ${credentials.participantToken}` } : {}),
    ...(credentials.participantId ? { "X-Participant-Id": credentials.participantId } : {}),
    ...(credentials.hostToken ? { "X-Host-Token": credentials.hostToken } : {}),
  };
}

async function checked(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || body.message || "We couldn't connect to the room. Please try again.");
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return response;
}

async function request(path, { credentials, signal, timeoutMs = 65000, ...options } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  // Allow a sleeping room server time to wake up, while always releasing the form.
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await checked(await fetch(roomApiBase + path, {
      ...options,
      signal: controller.signal,
      headers: { ...roomHeaders(credentials), ...options.headers },
    }));
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error("The room server returned an unexpected response. Please ask the site owner to check the backend connection.");
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new Error("The room server took too long to respond. It may still be waking up. Please try again.");
    if (error instanceof TypeError) throw new Error("We couldn't reach the room server. Check your connection and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function persist(result, displayName, invite) {
  const code = result.room?.room_code || result.snapshot?.room?.room_code;
  if (code && result.credentials) {
    const inviteUrl = result.inviteUrl || (invite ? `${location.origin}/room/${code}?invite=${encodeURIComponent(invite)}` : undefined);
    saveRoomSession(code, result.credentials, { displayName, ...(inviteUrl ? { inviteUrl } : {}) });
  }
  return result;
}

export const roomApi = {
  async createRoom(values) {
    const result = await request("/api/rooms", json({ ...values, participantId: values.participantId || participantId() }));
    return persist(result, values.displayName);
  },
  async joinRoom(code, values) {
    const result = await request(`${roomPath(code)}/join`, json({ ...values, participantId: values.participantId || participantId() }));
    return persist(result, values.displayName, values.invite);
  },
  getInfo: (code, invite) => request(`${roomPath(code)}/info${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`),
  getSnapshot: (code, credentials, signal) => request(roomPath(code), { credentials, signal }),
  time: (signal) => request("/api/time", { signal, cache: "no-store", timeoutMs: 10000 }),
  action: (code, credentials, action, payload = {}) => request(`${roomPath(code)}/actions`, { ...json({ ...payload, action }), credentials }),
  signal: (code, credentials, type, toParticipantId, payload = {}) => request(`${roomPath(code)}/signals`, { ...json({ type, toParticipantId, payload }), credentials }),
  uploadPhoto(code, credentials, blob, { round, captureId, capturedAt }) {
    const form = new FormData();
    form.append("image", blob, `round-${round}.${blob.type === "image/png" ? "png" : "jpg"}`);
    form.append("round", String(round));
    form.append("captureId", captureId);
    form.append("capturedAt", capturedAt);
    return request(`${roomPath(code)}/photos`, { method: "POST", credentials, body: form, timeoutMs: 120000 });
  },
  saveResult(code, credentials, blob, { sessionId }) {
    const form = new FormData();
    form.append("image", blob, `pitik-together.${blob.type === "image/png" ? "png" : "jpg"}`);
    form.append("sessionId", sessionId);
    return request(`${roomPath(code)}/result`, { method: "POST", credentials, body: form, timeoutMs: 120000 });
  },
  async getPhotoBlob(photo, credentials, signal) {
    const value = typeof photo === "string" ? photo : photo.image_url;
    const apiOrigin = new URL(roomApiBase || location.origin, location.origin).origin;
    const url = new URL(value, roomApiBase || location.origin);
    // Signed storage URLs may be external. Never send room credentials off-origin.
    const headers = url.origin === apiOrigin ? roomHeaders(credentials) : {};
    const response = await checked(await fetch(url.href, { headers, signal }));
    return response.blob();
  },
};

/** SSE over fetch keeps bearer tokens out of URLs, browser history and access logs. */
export async function streamRoomEvents(code, credentials, { signal, onEvent, onOpen }) {
  const response = await checked(await fetch(`${roomApiBase}${roomPath(code)}/events`, {
    headers: { ...roomHeaders(credentials), Accept: "text/event-stream" }, signal, cache: "no-store",
  }));
  if (!response.body) throw new Error("Your browser cannot stream room updates. Try a current browser.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  onOpen?.();
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (data) {
          let event;
          try { event = JSON.parse(data); } catch { continue; }
          onEvent(event);
        }
      }
      if (buffer.length > 1024 * 1024) throw new Error("Room updates were interrupted. Reconnecting...");
    }
    if (!signal.aborted) throw new Error("Room connection was interrupted. Reconnecting...");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
