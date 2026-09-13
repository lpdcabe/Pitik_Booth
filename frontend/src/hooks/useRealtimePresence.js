import { useEffect, useRef, useState } from "react";

/** Heartbeats report availability only; PostgreSQL remains authoritative for capture state. */
export function useRealtimePresence({ action, connected, cameraEnabled, currentState, participants = [], participantId }) {
  const [notices, setNotices] = useState([]);
  const previous = useRef(null);
  const latest = useRef({ cameraEnabled, currentState });
  latest.current = { cameraEnabled, currentState };
  useEffect(() => {
    if (!connected) return;
    const heartbeat = () => action("heartbeat", { cameraEnabled: !!latest.current.cameraEnabled, currentState: latest.current.currentState }).catch(() => {});
    heartbeat();
    const interval = setInterval(heartbeat, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") heartbeat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [action, connected, cameraEnabled, currentState]);

  useEffect(() => {
    const current = new Map(participants.map((p) => [p.participant_id, p]));
    if (previous.current) {
      const messages = [];
      for (const [id, p] of current) {
        if (id === participantId) continue;
        const old = previous.current.get(id);
        const available = p.online !== false && !["disconnected", "left", "removed"].includes(p.status);
        const wasAvailable = old && old.online !== false && !["disconnected", "left", "removed"].includes(old.status);
        if (available && !wasAvailable) messages.push(`${p.display_name} ${old ? "reconnected" : "joined the room"}.`);
        else if (!available && wasAvailable) messages.push(`${p.display_name} disconnected.`);
      }
      for (const [id, p] of previous.current) {
        if (!current.has(id) && id !== participantId) messages.push(`${p.display_name} left the room.`);
      }
      if (messages.length) setNotices((old) => [...old, ...messages.map((message) => ({ id: crypto.randomUUID(), message }))].slice(-5));
    }
    previous.current = current;
  }, [participants, participantId]);

  return { participants, notices, connectedCount: participants.filter((p) => p.online !== false && !["disconnected", "left", "removed"].includes(p.status)).length };
}
export default useRealtimePresence;
