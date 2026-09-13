import { useEffect, useRef, useState } from "react";
import { countdownTiming } from "../utils/clockSync";

export function useSynchronizedCountdown({ captureAt, captureId, clockOffset = 0, enabled = true, onCapture }) {
  const [state, setState] = useState({ remaining: null, phase: "idle", error: "" });
  const completed = useRef(new Set());
  const callback = useRef(onCapture);
  callback.current = onCapture;

  useEffect(() => {
    if (!enabled || !captureAt || !captureId) {
      setState({ remaining: null, phase: "idle", error: "" });
      return;
    }
    if (completed.current.has(captureId)) return;
    let timer;
    let disposed = false;
    const tick = () => {
      if (disposed) return;
      const timing = countdownTiming(captureAt, clockOffset);
      if (!Number.isFinite(timing.target)) {
        setState({ remaining: null, phase: "error", error: "Countdown synchronization failed. Ask the host to retake this photo." });
        return;
      }
      if (timing.difference > 0) {
        setState((old) => old.remaining === timing.remaining && old.phase === "countdown" ? old : { remaining: timing.remaining, phase: "countdown", error: "" });
        timer = setTimeout(tick, Math.min(50, timing.difference));
        return;
      }
      completed.current.add(captureId);
      if (timing.late > 2000 || document.visibilityState === "hidden") {
        setState({ remaining: 0, phase: "missed", error: "This device missed the capture time. Keep this tab open and retake your photo." });
        return;
      }
      setState({ remaining: 0, phase: "captured", error: "" });
      Promise.resolve().then(() => callback.current?.({ captureId, capturedAt: new Date(Date.now() + clockOffset).toISOString(), lateness: timing.late })).catch((e) => {
        if (!disposed) setState({ remaining: 0, phase: "error", error: e.message || "We couldn't capture your photo. Please retake it." });
      });
    };
    tick();
    return () => { disposed = true; clearTimeout(timer); };
  }, [captureAt, captureId, clockOffset, enabled]);

  return state;
}
export default useSynchronizedCountdown;
