const env = import.meta.env || {};
const debug = (...args) => { if (env.VITE_DEBUG_WEBRTC === "true") console.debug("[Booth Together]", ...args); };

export function peerConnectionConfig(values = env) {
  const split = (value) => String(value || "").split(",").map((url) => url.trim()).filter(Boolean);
  const stun = split(values.VITE_STUN_URL || "stun:stun.l.google.com:19302").filter((url) => /^stuns?:/i.test(url));
  const turn = split(values.VITE_TURN_URL).filter((url) => /^turns?:/i.test(url));
  return {
    iceServers: [
      ...(stun.length ? [{ urls: stun }] : []),
      ...(turn.length ? [{ urls: turn, username: values.VITE_TURN_USERNAME || "", credential: values.VITE_TURN_CREDENTIAL || "" }] : []),
    ],
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 2,
  };
}

/** A mesh peer with deterministic initial offers and perfect negotiation on changes. */
export function createPeerConnection({ localParticipantId, remoteParticipantId, stream, sendSignal, onStream, onState, configuration = peerConnectionConfig() }) {
  const pc = new RTCPeerConnection(configuration);
  const polite = localParticipantId > remoteParticipantId;
  const initiator = !polite;
  let makingOffer = false;
  let ignoreOffer = false;
  let settingRemoteAnswer = false;
  let closed = false;
  let restarting = false;
  let attempts = 0;
  let reconnectTimer;
  let negotiationTimer;
  let queue = Promise.resolve();
  let pendingCandidates = [];
  let previousInbound = null;
  let activeStream = stream;
  let videoSender;
  const remoteStream = new MediaStream();
  const report = (state, quality, error = "") => { if (!closed) onState?.({ state, quality, error }); };
  const send = (type, payload = {}) => closed ? Promise.resolve() : sendSignal(type, remoteParticipantId, payload);

  async function negotiate() {
    if (closed || makingOffer || pc.signalingState !== "stable") return;
    if (!initiator && !pc.remoteDescription) return;
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      if (!closed) await send(pc.localDescription.type, { type: pc.localDescription.type, sdp: pc.localDescription.sdp });
    } catch (e) {
      if (!closed) { debug("Negotiation interrupted", e.name); report("connecting", "Reconnecting", "We're having trouble connecting to your friend. Trying again..."); }
    } finally { makingOffer = false; }
  }

  function scheduleRecovery(delay = 7000) {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (closed || pc.connectionState === "connected") return;
      if (attempts >= 3) {
        report("failed", "Poor", "Your friend's camera couldn't connect. Try reconnecting or use another network.");
        return;
      }
      attempts++;
      report("reconnecting", "Reconnecting", "We're having trouble connecting to your friend. Trying again...");
      try { await reconnect(); } catch { /* Another timed attempt may recover the signal transport. */ }
      scheduleRecovery(10000);
    }, delay);
  }

  async function reconnect() {
    if (closed || restarting) return;
    restarting = true;
    try {
      await send("reconnect");
      if (closed) return;
      // The lower ID restarts ICE; the other peer responds to its offer.
      if (initiator) {
        pc.restartIce();
        if (pc.signalingState !== "stable") {
          await pc.setLocalDescription({ type: "rollback" });
        }
        await negotiate();
      }
      scheduleRecovery();
    } finally { restarting = false; }
  }

  pc.onnegotiationneeded = () => { negotiate(); };
  pc.onicecandidate = ({ candidate }) => {
    if (candidate && !closed) send("ice-candidate", { candidate: candidate.toJSON() }).catch(() => scheduleRecovery());
  };
  pc.ontrack = ({ track, streams }) => {
    if (closed || track.kind !== "video") return;
    const next = streams[0] || remoteStream;
    if (!streams[0] && !remoteStream.getTracks().some((item) => item.id === track.id)) remoteStream.addTrack(track);
    onStream?.(next);
    track.onunmute = () => { if (!closed) onStream?.(next); };
  };
  pc.onconnectionstatechange = () => {
    debug("Peer state", pc.connectionState);
    if (pc.connectionState === "connected") {
      attempts = 0;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      report("connected", "Good");
    } else if (["failed", "disconnected"].includes(pc.connectionState)) {
      report("reconnecting", "Reconnecting", "We're having trouble connecting to your friend. Trying again...");
      scheduleRecovery(pc.connectionState === "failed" ? 1000 : 6000);
    } else report(pc.connectionState, "Connecting");
  };
  pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === "failed") scheduleRecovery(1000); };

  const initialTrack = stream?.getVideoTracks().find((track) => track.readyState === "live");
  if (initialTrack) videoSender = pc.addTrack(initialTrack, stream);
  else videoSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;

  async function receiveNow(signal) {
    if (closed) return;
    const payload = signal.payload || {};
    if (signal.type === "offer" || signal.type === "answer") {
      const description = { type: signal.type, sdp: payload.sdp || payload.description?.sdp };
      if (typeof description.sdp !== "string") return;
      const readyForOffer = !makingOffer && (pc.signalingState === "stable" || settingRemoteAnswer);
      const collision = description.type === "offer" && !readyForOffer;
      ignoreOffer = !polite && collision;
      if (ignoreOffer) { pendingCandidates = []; return; }
      // A delayed answer from a previous ICE negotiation can be ignored.
      if (description.type === "answer" && pc.signalingState !== "have-local-offer") return;
      settingRemoteAnswer = description.type === "answer";
      try {
        await pc.setRemoteDescription(description);
      } finally { settingRemoteAnswer = false; }
      for (const candidate of pendingCandidates.splice(0)) {
        await pc.addIceCandidate(candidate).catch((e) => debug("Buffered candidate expired", e.name));
      }
      if (description.type === "offer") {
        await pc.setLocalDescription();
        await send("answer", { type: "answer", sdp: pc.localDescription.sdp });
      }
    } else if (signal.type === "ice-candidate") {
      if (ignoreOffer) return;
      const candidate = payload.candidate;
      if (!candidate) return;
      if (!pc.remoteDescription) {
        if (pendingCandidates.length < 100) pendingCandidates.push(candidate);
      } else {
        await pc.addIceCandidate(candidate).catch((e) => debug("Candidate expired", e.name));
      }
    } else if (signal.type === "reconnect" || signal.type === "peer-joined") {
      if (initiator) {
        pc.restartIce();
        if (pc.signalingState !== "stable" && !makingOffer) await pc.setLocalDescription({ type: "rollback" });
        await negotiate();
      }
    }
  }

  function receive(signal) {
    queue = queue.then(() => receiveNow(signal)).catch((e) => {
      if (!closed) { debug("Signal could not be applied", e.name); scheduleRecovery(); }
    });
    return queue;
  }

  async function replaceStream(nextStream) {
    if (closed || activeStream === nextStream) return;
    activeStream = nextStream;
    const nextTrack = nextStream?.getVideoTracks().find((track) => track.readyState === "live") || null;
    try {
      await videoSender.replaceTrack(nextTrack);
      if (nextStream && videoSender.setStreams) videoSender.setStreams(nextStream);
    } catch (e) {
      if (closed) return;
      if (nextTrack && e.name === "InvalidModificationError") {
        pc.removeTrack(videoSender);
        videoSender = pc.addTrack(nextTrack, nextStream);
      } else throw e;
    }
    await send("camera-state", { cameraEnabled: !!nextTrack?.enabled });
  }

  const statsTimer = setInterval(async () => {
    if (closed || pc.connectionState !== "connected") return;
    try {
      const reports = await pc.getStats();
      let latency = 0;
      let loss = 0;
      reports.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) latency = report.currentRoundTripTime || 0;
        if (report.type === "inbound-rtp" && report.kind === "video") {
          if (previousInbound) {
            const lost = Math.max(0, (report.packetsLost || 0) - previousInbound.lost);
            const received = Math.max(0, (report.packetsReceived || 0) - previousInbound.received);
            loss = lost / Math.max(1, lost + received);
          }
          previousInbound = { lost: report.packetsLost || 0, received: report.packetsReceived || 0 };
        }
      });
      report("connected", latency < 0.15 && loss < 0.02 ? "Excellent" : latency < 0.5 && loss < 0.08 ? "Good" : "Poor");
    } catch { /* Browsers may stop stats briefly during a network handover. */ }
  }, 5000);

  negotiationTimer = setTimeout(() => negotiate(), 0);
  scheduleRecovery(12000);
  return {
    pc, receive, replaceStream,
    reconnect: async () => { attempts = 0; return reconnect(); },
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(negotiationTimer);
      clearInterval(statsTimer);
      pendingCandidates = [];
      pc.onnegotiationneeded = pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = pc.oniceconnectionstatechange = null;
      pc.close();
    },
  };
}
