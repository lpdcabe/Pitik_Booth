import { useCallback, useEffect, useRef, useState } from "react";
import { createPeerConnection } from "../utils/peerConnection";
import { isPeerSignal } from "../services/webrtcSignaling";

export function useWebRTC({ participantId, participants = [], localStream, subscribeSignals, sendSignal, connected }) {
  const peers = useRef(new Map());
  const latest = useRef({ participants, localStream, sendSignal });
  latest.current = { participants, localStream, sendSignal };
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peerStates, setPeerStates] = useState({});
  const [error, setError] = useState("");
  const alive = useRef(true);
  const pending = useRef(new Map());

  const removePeer = useCallback((id) => {
    peers.current.get(id)?.close();
    peers.current.delete(id);
    pending.current.delete(id);
    if (!alive.current) return;
    setRemoteStreams((old) => { const next = { ...old }; delete next[id]; return next; });
    setPeerStates((old) => { const next = { ...old }; delete next[id]; return next; });
  }, []);

  const ensurePeer = useCallback((id) => {
    if (!participantId || !id || participantId === id || !alive.current) return null;
    if (peers.current.has(id)) return peers.current.get(id);
    if (!window.RTCPeerConnection) { setError("Live video isn't supported in this browser. Try a current browser."); return null; }
    try {
      const peer = createPeerConnection({
        localParticipantId: participantId,
        remoteParticipantId: id,
        stream: latest.current.localStream,
        sendSignal: (...args) => latest.current.sendSignal(...args),
        onStream: (stream) => { if (alive.current) setRemoteStreams((old) => ({ ...old, [id]: stream })); },
        onState: (state) => { if (alive.current) setPeerStates((old) => ({ ...old, [id]: state })); },
      });
      peers.current.set(id, peer);
      for (const signal of pending.current.get(id) || []) peer.receive(signal);
      pending.current.delete(id);
      return peer;
    } catch {
      setError("We couldn't start live video. Check the connection settings and try again.");
      return null;
    }
  }, [participantId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const peer of peers.current.values()) peer.close();
      peers.current.clear();
      pending.current.clear();
    };
  }, [participantId]);

  // Subscribe before creating peers so initial answers cannot outrun the listener.
  useEffect(() => {
    if (!participantId || !subscribeSignals) return;
    return subscribeSignals((signal) => {
      if (!isPeerSignal(signal, participantId)) return;
      const id = signal.fromParticipantId;
      if (signal.type === "peer-left") { removePeer(id); return; }
      const participant = latest.current.participants.find((p) => p.participant_id === id);
      if (!participant || ["left", "removed"].includes(participant.status)) {
        // A signal can arrive just before its corresponding room snapshot.
        if (!participant && pending.current.size < 4) {
          const buffered = pending.current.get(id) || [];
          if (buffered.length < 100) pending.current.set(id, [...buffered, signal]);
        }
        return;
      }
      ensurePeer(id)?.receive(signal);
    });
  }, [participantId, subscribeSignals, ensurePeer, removePeer]);

  const roster = participants.filter((p) => p.participant_id !== participantId && !["left", "removed"].includes(p.status)).map((p) => p.participant_id).sort().join(",");
  useEffect(() => {
    if (!participantId) return;
    const ids = new Set(roster.split(",").filter(Boolean));
    for (const id of peers.current.keys()) if (!ids.has(id)) removePeer(id);
    if (!connected) return;
    for (const id of ids) ensurePeer(id);
  }, [roster, participantId, connected, ensurePeer, removePeer]);

  useEffect(() => {
    for (const peer of peers.current.values()) peer.replaceStream(localStream).catch(() => {
      if (alive.current) setError("Camera switching failed. Retry your camera to restore live video.");
    });
  }, [localStream]);

  useEffect(() => {
    if (!connected || !participantId) return;
    setError("");
    for (const peer of peers.current.values()) peer.reconnect().catch(() => {});
  }, [connected, participantId]);

  const reconnect = useCallback(async (id) => {
    setError("");
    const selected = id ? [peers.current.get(id)].filter(Boolean) : [...peers.current.values()];
    await Promise.allSettled(selected.map((peer) => peer.reconnect()));
  }, []);
  return { remoteStreams, peerStates, error, reconnect };
}
export default useWebRTC;
