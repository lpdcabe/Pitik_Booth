import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Download, Share2, QrCode, Trash2 } from "lucide-react";
import { api, imageURL, downloadURL } from "../services/api";
import { useBooth } from "../context/PhotoboothContext";
import QRCodeModal from "../components/QRCodeModal";
export default function Gallery() {
  const [photos, setPhotos] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false);
  const { notify } = useBooth();
  async function load() {
    setLoading(true);
    setError("");
    try {
      setPhotos(await api.list());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function share(p) {
    const url = `${location.origin}/photo/${p.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: p.event_name || "A little moment",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        notify("Share link copied!");
      }
    } catch (e) {
      if (e.name !== "AbortError") setQr(url);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api.remove(deleting.id);
      setPhotos((old) => old.filter((p) => p.id !== deleting.id));
      setDeleting(null);
      notify("Memory deleted.");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="section gallery-page">
      <div className="page-title">
        <span className="eyebrow">YOUR OWN LITTLE COLLECTION</span>
        <h1>A gallery of good feelings.</h1>
        <p>
          Memories saved in this browser session. A little happiness to come
          back to.
        </p>
      </div>
      {loading ? (
        <div className="loading">
          <span className="spinner" />
          Gathering your memories...
        </div>
      ) : error ? (
        <div className="empty-state">
          <Camera size={40} />
          <h3>Your gallery isn’t available yet.</h3>
          <p role="alert">{error}</p>
          <button className="button secondary" onClick={load}>
            Try again
          </button>
          <Link className="text-link" to="/setup">
            Create a photobooth
          </Link>
        </div>
      ) : !photos.length ? (
        <div className="empty-state">
          <Camera size={44} />
          <h2>Your first memory starts here.</h2>
          <p>Create a photobooth and save it to see it in your gallery.</p>
          <Link to="/setup" className="button">
            Make a little moment
          </Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((p) => (
            <article className="gallery-card" key={p.id}>
              <Link to={`/photo/${p.id}`}>
                <div className="gallery-image">
                  <img
                    src={imageURL(p)}
                    alt={p.event_name || "Saved photobooth"}
                  />
                </div>
                <h3>{p.event_name || "A little moment"}</h3>
              </Link>
              <p>{new Date(p.created_at).toLocaleDateString()}</p>
              <div className="gallery-actions">
                <button
                  className="icon-button"
                  aria-label="Download photo"
                  onClick={() =>
                    downloadURL(imageURL(p)).catch((e) => notify(e.message))
                  }
                >
                  <Download size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Share photo"
                  onClick={() => share(p)}
                >
                  <Share2 size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Show QR code"
                  onClick={() => setQr(`${location.origin}/photo/${p.id}`)}
                >
                  <QrCode size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete photo"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {qr && <QRCodeModal url={qr} onClose={() => setQr("")} />}
      {deleting && (
        <div className="modal-backdrop">
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this memory?</h2>
            <p>The image and its share link will be permanently removed.</p>
            <div className="download-buttons">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Keep it
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Deleting..." : "Delete memory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
