import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  CloudUpload,
  Share2,
  QrCode,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useBooth } from "../context/PhotoboothContext";
import { generateCanvas, canvasBlob } from "../utils/canvasGenerator";
import { sessionId } from "../utils/session";
import { api, downloadURL } from "../services/api";
import QRCodeModal from "../components/QRCodeModal";
import { Steps } from "../components/Chrome";
export default function Result() {
  const booth = useBooth(),
    { layout, frame, photos, settings, preset, notify, reset } = booth;
  const [preview, setPreview] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(null),
    [qr, setQr] = useState(false);
  const canvasRef = useRef(null),
    savePromise = useRef(null);
  const complete = Array.from(
    { length: layout.photoCount },
    (_, i) => photos[i],
  ).every(Boolean);
  useEffect(() => {
    let active = true,
      url;
    setSaved(null);
    if (!complete) {
      setLoading(false);
      return;
    }
    setLoading(true);
    generateCanvas({ layout, frame, photos, settings, preset })
      .then(async (canvas) => {
        const blob = await canvasBlob(canvas);
        url = URL.createObjectURL(blob);
        if (active) {
          canvasRef.current = canvas;
          setPreview(url);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [layout, frame, photos, settings, preset, complete]);
  async function download(ext) {
    try {
      const blob = await canvasBlob(
        canvasRef.current,
        ext === "jpg" ? "image/jpeg" : "image/png",
      );
      const url = URL.createObjectURL(blob);
      await downloadURL(url, ext);
      URL.revokeObjectURL(url);
      notify("Photobooth downloaded!");
    } catch (e) {
      notify(e.message);
    }
  }
  async function save() {
    if (saved) return saved;
    if (savePromise.current) return savePromise.current;
    setSaving(true);
    savePromise.current = (async () => {
      const blob = await canvasBlob(canvasRef.current);
      if (blob.size > 10 * 1024 * 1024)
        throw new Error(
          "This image exceeds the 10 MB cloud limit. Download it instead, or choose a smaller layout.",
        );
      const form = new FormData();
      form.append("image", blob, "photobooth.png");
      Object.entries({
        session_id: sessionId(),
        layout: layout.id,
        frame: frame.id,
        photo_count: layout.photoCount,
        event_name: settings.showEvent ? settings.eventName : "",
        custom_text: settings.showMessage ? settings.message : "",
      }).forEach(([k, v]) => form.append(k, v));
      const result = await api.save(form);
      setSaved(result);
      notify("Photo saved successfully!");
      return result;
    })();
    try {
      return await savePromise.current;
    } finally {
      savePromise.current = null;
      setSaving(false);
    }
  }
  async function share(showQR = false) {
    try {
      const photo = await save();
      const url = photo.share_url || `${location.origin}/photo/${photo.id}`;
      if (showQR) {
        setQr(url);
        return;
      }
      if (navigator.share) {
        try {
          await navigator.share({
            title: settings.eventName || "A little moment",
            url,
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        notify("Share link copied!");
      } catch {
        setQr(url);
      }
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <main className="section result-page">
      <Steps current={4} />
      <div className="page-title">
        <span className="eyebrow">A MOMENT WORTH KEEPING</span>
        <h1>And just like that, a memory.</h1>
        <p>
          Made by you. Ready for your camera roll, your wall, or someone
          special.
        </p>
      </div>
      {!complete ? (
        <div className="empty-state">
          <h3>Your photos are waiting.</h3>
          <p>Take or upload photos to create your photobooth.</p>
          <Link to="/photobooth" className="button">
            Open photobooth
          </Link>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <Link to="/edit" className="button">
            Back to editor
          </Link>
        </div>
      ) : (
        <div className="result-workspace">
          <div className="result-art">
            {loading ? (
              <div className="loading">
                <span className="spinner" />
                Generating high-resolution image...
              </div>
            ) : (
              <img src={preview} alt="Your finished photobooth" />
            )}
            <span className="result-spark">✧</span>
          </div>
          <div className="result-controls">
            <span className="pill">
              <Check size={14} /> ONE OF A KIND. JUST LIKE YOU.
            </span>
            <h2>{settings.eventName || "Your little masterpiece"}</h2>
            <p>
              {layout.name} · {frame.name}
              <br />
              {layout.width} × {layout.height} pixels
            </p>
            <div className="download-buttons">
              <button
                className="button"
                disabled={loading}
                onClick={() => download("png")}
              >
                <Download size={18} /> Download PNG
              </button>
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => download("jpg")}
              >
                JPG
              </button>
            </div>
            <button
              className="button secondary full"
              disabled={loading || saving || !!saved}
              onClick={() => save().catch((e) => notify(e.message))}
            >
              {saving ? (
                <span className="spinner" />
              ) : (
                <CloudUpload size={18} />
              )}{" "}
              {saving
                ? "Saving your memory..."
                : saved
                  ? "Saved to your gallery"
                  : "Save to my gallery"}
            </button>
            <div className="download-buttons">
              <button
                className="button secondary"
                disabled={loading || saving}
                onClick={() => share()}
              >
                <Share2 size={17} /> Share link
              </button>
              <button
                className="button secondary"
                disabled={loading || saving}
                onClick={() => share(true)}
              >
                <QrCode size={17} /> QR code
              </button>
            </div>
            <p className="help-text">
              Save creates a shareable link. Anyone with that link can view your
              memory.
              {saved?.expires_at &&
                ` Available until ${new Date(saved.expires_at).toLocaleDateString()}.`}
            </p>
            <hr />
            <div className="result-edit-links">
              <Link to="/edit">Edit photos</Link>
              <Link to="/setup?step=frame">Change frame</Link>
              <Link to="/setup">Change layout</Link>
              <Link to="/photobooth" onClick={() => booth.setPhotos([])}>
                Retake all
              </Link>
            </div>
            <Link className="text-link" to="/setup" onClick={reset}>
              Make another little moment <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      )}
      {qr && <QRCodeModal url={qr} onClose={() => setQr(false)} />}
    </main>
  );
}
