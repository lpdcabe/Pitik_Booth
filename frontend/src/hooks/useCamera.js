import { useCallback, useEffect, useRef, useState } from "react";
const messages = {
  NotAllowedError:
    "Camera permission was denied. Allow camera access in your browser settings, then try again.",
  NotFoundError:
    "No camera was found. Connect a camera or upload your photos below.",
  NotReadableError:
    "Your camera may be in use by another app. Close that app and try again.",
  OverconstrainedError:
    "This camera does not support the requested settings. Try another camera.",
};
export default function useCamera() {
  const videoRef = useRef(null),
    streamRef = useRef(null),
    generation = useRef(0);
  const [facing, setFacing] = useState("user"),
    [status, setStatus] = useState("idle"),
    [error, setError] = useState("");
  const stop = useCallback(() => {
    generation.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const open = useCallback(async () => {
    stop();
    const token = generation.current;
    setStatus("loading");
    setError("");
    if (!window.isSecureContext) {
      setError(
        "Camera access requires HTTPS or localhost. Open a secure link, or upload photos.",
      );
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support camera access. Try a current browser or upload photos.",
      );
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (token === generation.current) setStatus("ready");
    } catch (e) {
      if (token === generation.current) {
        setError(
          messages[e.name] ||
            "We couldn’t start your camera. Please check your camera and try again.",
        );
        setStatus("error");
      }
    }
  }, [facing, stop]);
  useEffect(() => {
    open();
    return stop;
  }, [open, stop]);
  return {
    videoRef,
    facing,
    status,
    error,
    open,
    stop,
    switchCamera: () =>
      setFacing((f) => (f === "user" ? "environment" : "user")),
  };
}
