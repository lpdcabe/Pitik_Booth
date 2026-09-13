import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { roomApi, streamRoomEvents } from "../services/roomApi";
import { createSignalBus } from "../services/webrtcSignaling";
import { clearRoomSession, getRoomSession, normalizeRoomCode, saveRoomSession } from "../utils/roomSession";

export function useRoom(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const [credentials, setCredentials] = useState(() => getRoomSession(code));
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(!!credentials);
  const [error, setError] = useState("");
  const credentialsRef = useRef(credentials);
  const snapshotRef = useRef(snapshot);
  const signalBus = useMemo(createSignalBus, [code]);
  const abortRef = useRef(null);
  credentialsRef.current = credentials;

  const applyResult = useCallback((result) => {
    if (!result) return;
    if (result.credentials) {
      const next = saveRoomSession(code, result.credentials, result.inviteUrl ? { inviteUrl: result.inviteUrl } : {});
      credentialsRef.current = next;
      setCredentials(next);
    }
    const next = result.snapshot || (result.room ? result : null);
    if (next && (!snapshotRef.current || next.room.version == null || snapshotRef.current.room.version <= next.room.version)) {
      const clean = { room: next.room, participants: next.participants || [], photos: next.photos || [] };
      snapshotRef.current = clean;
      setSnapshot(clean);
    }
  }, [code]);

  const refresh = useCallback(async () => {
    if (!credentialsRef.current?.participantToken) return null;
    const result = await roomApi.getSnapshot(code, credentialsRef.current);
    applyResult(result);
    return result;
  }, [code, applyResult]);

  useEffect(() => {
    const stored = getRoomSession(code);
    credentialsRef.current = stored;
    snapshotRef.current = null;
    setCredentials(stored);
    setSnapshot(null);
    setConnected(false);
    setError("");
    if (!stored?.participantToken) { setLoading(false); return; }
    setLoading(true);
    let disposed = false;
    let retryTimer;
    let retries = 0;
    const controller = new AbortController();
    abortRef.current = controller;
    const start = async () => {
      if (disposed) return;
      try {
        const initial = await roomApi.getSnapshot(code, credentialsRef.current, controller.signal);
        if (disposed) return;
        applyResult(initial);
        setLoading(false);
        await streamRoomEvents(code, credentialsRef.current, {
          signal: controller.signal,
          onOpen() { if (!disposed) { retries = 0; setConnected(true); setError(""); } },
          onEvent(event) {
            if (disposed) return;
            if (event.type === "room_updated") {
              const oldHost = snapshotRef.current?.room.host_participant_id;
              applyResult(event.snapshot);
              if (oldHost !== event.snapshot?.room?.host_participant_id && event.snapshot?.room?.host_participant_id === credentialsRef.current?.participantId) {
                refresh().catch(() => {});
              }
            } else if (event.type === "signal") signalBus.emit(event.signal);
            else if (event.type === "presence" && event.participants && snapshotRef.current) {
              const presence = new Map(event.participants.map((p) => [p.participant_id || p.participantId, p]));
              // Realtime availability complements, never replaces, persisted room state.
              const next = { ...snapshotRef.current, participants: snapshotRef.current.participants.map((p) => ({ ...p, online: presence.has(p.participant_id) })) };
              snapshotRef.current = next;
              setSnapshot(next);
            } else if (event.type === "connected") {
              setConnected(true);
              // Refresh once after subscription to close the snapshot/subscription race.
              refresh().catch(() => {});
            } else if (event.type === "error") {
              setError(event.message || "Room connection was interrupted. Reconnecting...");
            }
          },
        });
      } catch (e) {
        if (disposed || e.name === "AbortError") return;
        setConnected(false);
        setLoading(false);
        setError(e.message);
        if ([401, 403, 404, 410].includes(e.status)) return;
        retryTimer = setTimeout(start, Math.min(1000 * 2 ** retries++, 15000) + Math.random() * 500);
      }
    };
    start();
    return () => { disposed = true; controller.abort(); clearTimeout(retryTimer); };
  }, [code, applyResult, refresh, signalBus]);

  const action = useCallback(async (name, payload = {}) => {
    const result = await roomApi.action(code, credentialsRef.current, name, payload);
    applyResult(result);
    return result;
  }, [code, applyResult]);
  const uploadPhoto = useCallback(async (blob, metadata) => {
    const result = await roomApi.uploadPhoto(code, credentialsRef.current, blob, metadata);
    applyResult(result);
    return result;
  }, [code, applyResult]);
  const saveResult = useCallback(async (blob, metadata) => {
    const result = await roomApi.saveResult(code, credentialsRef.current, blob, metadata);
    applyResult(result);
    return result;
  }, [code, applyResult]);
  const leave = useCallback(async () => {
    await action("leave");
    abortRef.current?.abort();
    clearRoomSession(code);
    credentialsRef.current = null;
    setCredentials(null);
    setConnected(false);
  }, [code, action]);
  const sendSignal = useCallback((type, to, payload) => roomApi.signal(code, credentialsRef.current, type, to, payload), [code]);

  return {
    snapshot, room: snapshot?.room || null, participants: snapshot?.participants || [], photos: snapshot?.photos || [],
    credentials, connected, loading, error, inviteUrl: credentials?.inviteUrl || `${location.origin}/room/${code}`,
    action, uploadPhoto, saveResult, refresh, leave, subscribeSignals: signalBus.subscribe, sendSignal,
  };
}
export default useRoom;
