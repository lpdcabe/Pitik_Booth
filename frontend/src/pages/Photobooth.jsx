import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera,
  SwitchCamera,
  Upload,
  Volume2,
  VolumeX,
  ArrowRight,
  X,
} from "lucide-react";
import useCamera from "../hooks/useCamera";
import { useBooth } from "../context/PhotoboothContext";
import { Steps } from "../components/Chrome";
import LayoutPreview from "../components/LayoutPreview";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export default function Photobooth() {
  const booth = useBooth(),
    { layout, photos, setPhotos, preset, notify } = booth;
  const camera = useCamera(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const requestedRetake = params.has("retake")
    ? Number(params.get("retake"))
    : null;
  const retake =
    Number.isInteger(requestedRetake) &&
    requestedRetake >= 0 &&
    requestedRetake < layout.photoCount
      ? requestedRetake
      : null;
  const [countdown, setCountdown] = useState(null),
    [busy, setBusy] = useState(false),
    [flash, setFlash] = useState(false),
    [sound, setSound] = useState(false),
    [mirror, setMirror] = useState(false),
    [current, setCurrent] = useState(0),
    [delay, setDelay] = useState(3);
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );
  async function start() {
    if (busy || camera.status !== "ready") return;
    const token = ++run.current;
    setBusy(true);
    const next = Array.from(
      { length: layout.photoCount },
      (_, i) => photos[i] || null,
    );
    const indices =
      retake !== null && retake >= 0 && retake < layout.photoCount
        ? [retake]
        : next.flatMap((p, i) => (p ? [] : [i]));
    try {
      for (const index of indices) {
        setCurrent(index);
        for (let n = delay; n > 0; n--) {
          setCountdown(n);
          await pause(1000);
          if (token !== run.current) return;
        }
        setCountdown("SMILE!");
        await pause(150);
        if (token !== run.current) return;
        const video = camera.videoRef.current;
        if (!video?.videoWidth)
          throw new Error("The camera is not ready. Please try again.");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        next[index] = {
          src: canvas.toDataURL("image/jpeg", 0.95),
          filter: preset,
          zoom: 1,
          panX: 0,
          panY: 0,
        };
        setPhotos([...next]);
        setFlash(true);
        setCountdown(null);
        if (sound) {
          try {
            const ac = new AudioContext(),
              o = ac.createOscillator(),
              g = ac.createGain();
            o.connect(g);
            g.connect(ac.destination);
            g.gain.value = 0.08;
            o.frequency.value = 700;
            o.start();
            o.stop(ac.currentTime + 0.08);
            o.onended = () => ac.close();
          } catch {
            /* Sound is optional. */
          }
        }
        await pause(180);
        if (token !== run.current) return;
        setFlash(false);
        await pause(650);
        if (token !== run.current) return;
      }
      notify("All captured. Let’s make them yours.");
      navigate("/edit");
    } catch (e) {
      notify(e.message);
    } finally {
      if (token === run.current) {
        setBusy(false);
        setCountdown(null);
        setFlash(false);
      }
    }
  }
  async function upload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const next = Array.from(
        { length: layout.photoCount },
        (_, i) => photos[i] || null,
      );
      let index = retake !== null ? retake : next.findIndex((p) => !p);
      if (index < 0) index = 0;
      for (const file of files) {
        if (index >= layout.photoCount) break;
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error("Choose PNG, JPG or WebP photos under 10 MB.");
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () =>
            reject(new Error("Could not read this photo."));
          reader.readAsDataURL(file);
        });
        next[index] = { src, filter: preset, zoom: 1, panX: 0, panY: 0 };
        if (retake !== null) break;
        index++;
      }
      setPhotos(next);
      if (next.every(Boolean)) navigate("/edit");
      else
        notify(
          `${next.filter(Boolean).length} of ${layout.photoCount} photos ready.`,
        );
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="section camera-page">
      <Steps current={3} />
      <div className="page-title">
        <span className="eyebrow">JUST BE YOURSELF</span>
        <h1>
          {retake !== null
            ? `One more try for photo ${retake + 1}.`
            : "Ready for your little moment?"}
        </h1>
        <p>Get comfortable. Find your light. We’ll count you in.</p>
      </div>
      <div className="capture-workspace">
        <div>
          <div className="camera-stage">
            <video
              ref={camera.videoRef}
              muted
              autoPlay
              playsInline
              style={{
                transform: camera.facing === "user" ? "scaleX(-1)" : "none",
              }}
            />
            <Link to="/setup" className="camera-exit" aria-label="Exit camera">
              <X size={20} />
            </Link>
            <span className="camera-label">
              <span className="live-dot" />
              {busy
                ? `PHOTO ${current + 1} OF ${layout.photoCount}`
                : "YOUR LITTLE STUDIO"}
            </span>
            {camera.status === "loading" && (
              <div className="camera-message">
                <span className="spinner" />
                <p>Opening your camera...</p>
              </div>
            )}
            {camera.error && (
              <div className="camera-message">
                <Camera size={40} />
                <h3>Let’s get your camera ready.</h3>
                <p>{camera.error}</p>
                <button className="button" onClick={camera.open}>
                  Try again
                </button>
              </div>
            )}
            {countdown !== null && (
              <div
                className={`countdown ${typeof countdown === "string" ? "smile" : ""}`}
                aria-live="assertive"
              >
                {countdown}
              </div>
            )}
            {flash && <div className="camera-flash" />}
            <span className="viewfinder tl" />
            <span className="viewfinder tr" />
            <span className="viewfinder bl" />
            <span className="viewfinder br" />
          </div>
          <div className="camera-tools">
            <button
              className="button secondary"
              disabled={busy}
              onClick={camera.switchCamera}
            >
              <SwitchCamera size={17} /> Switch camera
            </button>
            <button
              className="icon-button"
              onClick={() => setSound(!sound)}
              aria-label={sound ? "Turn sound off" : "Turn sound on"}
            >
              {sound ? <Volume2 /> : <VolumeX />}
            </button>
            <label>
              Countdown
              <select
                value={delay}
                disabled={busy}
                onChange={(e) => setDelay(Number(e.target.value))}
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}s
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={mirror}
                disabled={busy}
                onChange={(e) => setMirror(e.target.checked)}
              />{" "}
              Mirror final photo
            </label>
          </div>
          <button
            className="button capture-button"
            disabled={busy || camera.status !== "ready"}
            onClick={start}
          >
            <Camera size={20} />
            {busy
              ? "Making a little memory..."
              : retake !== null
                ? "Retake this photo"
                : "Start session"}
          </button>
          {busy && (
            <button
              className="button secondary"
              onClick={() => {
                run.current++;
                setBusy(false);
                setCountdown(null);
                setFlash(false);
              }}
            >
              Cancel countdown
            </button>
          )}
          <label className={`upload-alternative ${busy ? "disabled" : ""}`}>
            <Upload size={16} /> Or upload your own photos
            <input
              type="file"
              multiple={retake === null}
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={upload}
            />
          </label>
          <div className="capture-thumbnails">
            {Array.from({ length: layout.photoCount }, (_, i) => (
              <div key={i}>
                {photos[i] ? (
                  <img src={photos[i].src} alt={`Captured photo ${i + 1}`} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="preview-sidebar">
          <span className="eyebrow">YOUR FRAME IS WAITING</span>
          <div className="preview-stage">
            <LayoutPreview {...booth} />
          </div>
          <h3>{layout.name}</h3>
          <p>
            {photos.slice(0, layout.photoCount).filter(Boolean).length} /{" "}
            {layout.photoCount} photos ready
          </p>
          {photos.slice(0, layout.photoCount).filter(Boolean).length ===
            layout.photoCount && (
            <button
              className="button"
              disabled={busy}
              onClick={() => navigate("/edit")}
            >
              Edit photos <ArrowRight size={17} />
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
