import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, QrCode, ArrowRight, ArrowLeft } from "lucide-react";
import { roomApi } from "../services/roomApi";
import { getParticipantId, getDisplayName } from "../utils/roomSession";
import { getRemoteTemplates } from "../utils/remoteLayouts";
import QRCodeModal from "../components/QRCodeModal";
import { useBooth } from "../context/PhotoboothContext";
export default function CreateRoom() {
  const navigate = useNavigate(),
    { notify } = useBooth();
  const [name, setName] = useState(getDisplayName),
    [settings, setSettings] = useState({
      maxParticipants: 2,
      photoCount: 4,
      layout: "remote-duo-grid",
      frame: "classic-white",
      countdownSeconds: 3,
      autoContinue: false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState(null),
    [qr, setQr] = useState(false);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await roomApi.createRoom({
        ...settings,
        participantId: getParticipantId(),
        displayName: name.trim(),
      });
      setCreated(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const url = created?.inviteUrl;
  return (
    <main className="section">
      <div className="page-title">
        <span className="eyebrow">BOOTH TOGETHER</span>
        <h1>
          {created
            ? "A little room. A lot of memories."
            : "Make a little space for your people."}
        </h1>
        <p>
          {created
            ? "Send the invitation, then step inside."
            : "Create the room, invite your friends, then choose the shared look together."}
        </p>
      </div>
      {created ? (
        <div className="room-created">
          <span className="pill">ROOM CREATED</span>
          <h2>Your room code</h2>
          <strong className="room-code-large">{created.room.room_code}</strong>
          <label>
            Invite link
            <input
              value={url || ""}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="download-buttons">
            <button
              className="button secondary"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => notify("Invite link copied!"))
                  .catch(() =>
                    notify("Select the invite link above and copy it."),
                  )
              }
            >
              <Copy size={17} /> Copy link
            </button>
            <button className="button secondary" onClick={() => setQr(true)}>
              <QrCode size={17} /> QR code
            </button>
          </div>
          <button
            className="button full"
            onClick={() => navigate(`/room/${created.room.room_code}`)}
          >
            Enter room <ArrowRight size={18} />
          </button>
          <p className="help-text">
            Rooms expire after two hours. Keep this tab open to keep your host
            controls.
          </p>
        </div>
      ) : (
        <form className="create-room-form" onSubmit={create}>
          <Link to="/together" className="text-link">
            <ArrowLeft size={15} /> Back
          </Link>
          <label>
            Your display name
            <input
              required
              maxLength={40}
              autoComplete="nickname"
              placeholder="What should your friends call you?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Maximum participants
            <select
              value={settings.maxParticipants}
              disabled={busy}
              onChange={(e) => {
                const maxParticipants = Number(e.target.value);
                setSettings({
                  ...settings,
                  maxParticipants,
                  layout: getRemoteTemplates(maxParticipants)[0].id,
                });
              }}
            >
              {[2, 3, 4].map((number) => (
                <option key={number} value={number}>
                  {number} people
                </option>
              ))}
            </select>
          </label>
          <p className="help-text">
            Everyone can choose the frame, layout, photo count, and countdown
            together inside the room.
          </p>
          {error && (
            <p className="room-error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy || !name.trim()}>
            {busy ? (
              <>
                <span className="spinner" />
                Creating your room...
              </>
            ) : (
              <>
                Create room <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}
      {qr && url && <QRCodeModal url={url} onClose={() => setQr(false)} />}
    </main>
  );
}
