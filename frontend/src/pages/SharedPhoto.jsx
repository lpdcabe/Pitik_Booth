import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Share2, QrCode } from "lucide-react";
import { api, imageURL, downloadURL } from "../services/api";
import { useBooth } from "../context/PhotoboothContext";
import QRCodeModal from "../components/QRCodeModal";
export default function SharedPhoto() {
  const { id } = useParams(),
    { notify } = useBooth();
  const [photo, setPhoto] = useState(null),
    [error, setError] = useState(""),
    [qr, setQr] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    setError("");
    api
      .get(id)
      .then((p) => active && setPhoto(p))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: photo.event_name || "A little moment",
          url: location.href,
        });
      else {
        await navigator.clipboard.writeText(location.href);
        notify("Share link copied!");
      }
    } catch (e) {
      if (e.name !== "AbortError") setQr(true);
    }
  }
  return (
    <main className="section shared-page">
      {error ? (
        <div className="empty-state">
          <h1>This moment isn’t here.</h1>
          <p role="alert">{error}</p>
          <Link className="button" to="/setup">
            Make your own memory
          </Link>
        </div>
      ) : !photo ? (
        <div className="loading">
          <span className="spinner" />
          Opening a little memory...
        </div>
      ) : (
        <>
          <div className="page-title">
            <span className="eyebrow">SOME MOMENTS ARE MEANT TO BE SHARED</span>
            <h1>{photo.event_name || "A little moment, just for you."}</h1>
            <p>
              {new Date(photo.created_at).toLocaleDateString()}
              {photo.expires_at &&
                ` · Available until ${new Date(photo.expires_at).toLocaleDateString()}`}
            </p>
          </div>
          <div className="shared-image">
            <img
              src={imageURL(photo)}
              alt={photo.event_name || "Shared photobooth"}
            />
          </div>
          <div className="shared-actions">
            <button
              className="button"
              onClick={() =>
                downloadURL(imageURL(photo)).catch((e) => notify(e.message))
              }
            >
              <Download size={18} /> Download
            </button>
            <button className="button secondary" onClick={share}>
              <Share2 size={18} /> Share
            </button>
            <button className="button secondary" onClick={() => setQr(true)}>
              <QrCode size={18} /> QR code
            </button>
          </div>
          <Link to="/setup" className="text-link">
            Make your own little moment →
          </Link>
        </>
      )}
      {qr && <QRCodeModal url={location.href} onClose={() => setQr(false)} />}
    </main>
  );
}
