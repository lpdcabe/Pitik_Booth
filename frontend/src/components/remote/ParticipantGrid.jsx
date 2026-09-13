import { useEffect, useMemo, useRef } from "react";
import { RotateCcw, VideoOff, Wifi } from "lucide-react";

const labels = {
  connected: "Connected",
  not_ready: "Waiting",
  ready: "Ready",
  countdown: "Taking photo",
  capturing: "Taking photo",
  uploading: "Uploading",
  reviewing: "Reviewing",
  accepted: "Photo approved",
  retaking: "Retaking",
  disconnected: "Disconnected",
};

function placementFor(layout, round) {
  const activeRound = Math.max(1, Number(round) || 1);
  const slots =
    layout?.slots?.filter((slot) => slot.round === activeRound) || [];
  if (!slots.length) return { slots: [], aspectRatio: "4 / 3" };

  const minX = Math.min(...slots.map((slot) => slot.x));
  const minY = Math.min(...slots.map((slot) => slot.y));
  const maxX = Math.max(...slots.map((slot) => slot.x + slot.width));
  const maxY = Math.max(...slots.map((slot) => slot.y + slot.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const paddingX = Math.max(20, contentWidth * 0.045);
  const paddingY = Math.max(20, contentHeight * 0.045);
  const width = contentWidth + paddingX * 2;
  const height = contentHeight + paddingY * 2;

  return {
    aspectRatio: `${width} / ${height}`,
    slots: slots.map((slot) => ({
      ...slot,
      style: {
        left: `${((slot.x - minX + paddingX) / width) * 100}%`,
        top: `${((slot.y - minY + paddingY) / height) * 100}%`,
        width: `${(slot.width / width) * 100}%`,
        height: `${(slot.height / height) * 100}%`,
        transform: `rotate(${slot.rotation || 0}deg)`,
      },
    })),
  };
}

export function ParticipantVideo({
  participant,
  stream,
  self,
  mirror,
  peerState,
  onReconnect,
  slot,
  polaroid,
}) {
  const ref = useRef();
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream || null;
    if (stream) video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const cameraOff = participant.camera_enabled === false;
  const mask = slot?.mask ? ` slot-${slot.mask}` : "";
  return (
    <article
      className={`participant-video live-layout-slot${mask}${polaroid ? " slot-polaroid" : ""} ${participant.ready ? "participant-ready" : ""}`}
      style={slot?.style}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        style={{ transform: self && mirror ? "scaleX(-1)" : "none" }}
        aria-label={`${participant.display_name}${self ? " (you)" : ""} live camera`}
      />
      {(!stream || cameraOff) && (
        <div className="participant-video-placeholder">
          <VideoOff size={29} />
          <span>
            {cameraOff
              ? "Camera off"
              : self
                ? "Opening camera…"
                : participant.status === "disconnected"
                  ? "Reconnecting…"
                  : "Connecting to your friend…"}
          </span>
          {!self && onReconnect && (
            <button className="text-link" onClick={onReconnect}>
              <RotateCcw size={14} /> Retry connection
            </button>
          )}
        </div>
      )}
      <div className="participant-caption">
        <strong>
          {participant.display_name}
          {self ? " (you)" : ""}
        </strong>
        <span
          className={
            participant.ready || participant.status === "accepted"
              ? "status-ready"
              : ""
          }
        >
          <i />
          {cameraOff ? "Camera off" : labels[participant.status] || "Waiting"}
        </span>
      </div>
      {!self && peerState && (
        <span className="peer-quality">
          <Wifi size={11} />
          {peerState.quality || peerState.state || "Connecting"}
        </span>
      )}
    </article>
  );
}

export default function ParticipantGrid({
  participants,
  participantId,
  localStream,
  remoteStreams,
  peerStates,
  mirror,
  onReconnect,
  layout,
  frame,
  round,
}) {
  const placement = useMemo(() => placementFor(layout, round), [layout, round]);
  const participantsById = new Map(
    participants.map((participant) => [
      participant.participant_id,
      participant,
    ]),
  );

  return (
    <div
      className="live-layout-shell"
      style={{
        background: frame?.backgroundColor,
        color: frame?.textColor,
        borderColor: frame?.borderColor,
      }}
      data-layout={layout?.id}
    >
      <span className="live-layout-label">
        Photo {Math.max(1, Number(round) || 1)} · together
      </span>
      <div
        className={`participant-grid live-layout-canvas people-${participants.length}`}
        style={{ "--live-layout-ratio": placement.aspectRatio }}
      >
        {placement.slots.map((slot) => {
          const participant = participantsById.get(slot.participantId);
          if (!participant) {
            return (
              <div
                className={`live-layout-slot live-empty-slot${slot.mask ? ` slot-${slot.mask}` : ""}${layout?.decoration === "polaroid" ? " slot-polaroid" : ""}`}
                style={slot.style}
                key={slot.participantId}
              >
                <VideoOff size={24} />
                <span>Waiting for a friend</span>
              </div>
            );
          }
          const self = participant.participant_id === participantId;
          return (
            <ParticipantVideo
              key={participant.participant_id}
              participant={participant}
              self={self}
              stream={
                self ? localStream : remoteStreams[participant.participant_id]
              }
              mirror={mirror}
              peerState={peerStates[participant.participant_id]}
              onReconnect={() => onReconnect(participant.participant_id)}
              slot={slot}
              polaroid={layout?.decoration === "polaroid"}
            />
          );
        })}
      </div>
      <span className="live-layout-footer">
        {layout?.name} · {frame?.name}
      </span>
    </div>
  );
}
