import { useCallback, useEffect, useRef, useState } from "react";

const cameraErrors = {
  NotAllowedError: "Camera permission was denied. Allow camera access in your browser settings and try again.",
  NotFoundError: "No camera was found. Connect a camera and try again.",
  NotReadableError: "Your camera is being used by another app. Close that app and try again.",
  OverconstrainedError: "This camera does not support the requested settings. Try another camera.",
};

export function useRoomCamera({ autoStart = true } = {}) {
  const videoRef = useRef(null);
  const current = useRef(null);
  const generation = useRef(0);
  const facingRef = useRef("user");
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [facing, setFacing] = useState("user");
  const [mirror, setMirror] = useState(true);

  const release = useCallback(() => {
    generation.current++;
    for (const track of current.current?.getTracks() || []) { track.onended = null; track.stop(); }
    current.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setStream(null); setEnabled(false); setStatus("idle"); }, [release]);

  const open = useCallback(async (requestedFacing) => {
    const nextFacing = typeof requestedFacing === "string" ? requestedFacing : facingRef.current;
    release();
    const token = generation.current;
    setStatus("loading");
    setEnabled(false);
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Live camera requires HTTPS or localhost and a browser that supports camera access.");
      setStatus("error");
      setStream(null);
      return null;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (token !== generation.current) { next.getTracks().forEach((track) => track.stop()); return null; }
      current.current = next;
      facingRef.current = nextFacing;
      setFacing(nextFacing);
      setStream(next);
      setEnabled(true);
      setStatus("ready");
      for (const track of next.getVideoTracks()) track.onended = () => {
        if (token !== generation.current) return;
        setEnabled(false);
        setStatus("error");
        setError("Your camera stopped. Tap Retry camera to reconnect it.");
      };
      if (videoRef.current) {
        videoRef.current.srcObject = next;
        videoRef.current.play().catch(() => {});
      }
      return next;
    } catch (e) {
      if (token !== generation.current) return null;
      setStream(null);
      setStatus("error");
      setError(cameraErrors[e.name] || "We couldn't open your camera. Check your camera and try again.");
      return null;
    }
  }, [release]);

  const toggleCamera = useCallback(() => {
    const track = current.current?.getVideoTracks()[0];
    if (!track || track.readyState === "ended") return open();
    const nextEnabled = !track.enabled;
    for (const item of current.current.getVideoTracks()) item.enabled = nextEnabled;
    setEnabled(nextEnabled);
    setStatus(nextEnabled ? "ready" : "paused");
  }, [open]);
  const switchCamera = useCallback(() => {
    const nextFacing = facingRef.current === "user" ? "environment" : "user";
    setMirror(nextFacing === "user");
    return open(nextFacing);
  }, [open]);

  useEffect(() => { if (autoStart) open(); return release; }, [autoStart, open, release]);
  useEffect(() => {
    if (videoRef.current && stream) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
  }, [stream]);
  return { stream, videoRef, status, error, enabled, facing, mirror, setMirror, open, toggleCamera, switchCamera, stop };
}
export default useRoomCamera;
