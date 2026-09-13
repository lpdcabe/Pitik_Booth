import { useCallback, useEffect, useRef, useState } from "react";
import { roomApi } from "../services/roomApi";
import { bestClockSample, clockSample } from "../utils/clockSync";

export function useClockSync(enabled = true) {
  const [state, setState] = useState({ clockOffset: 0, offset: 0, synced: false, error: "", latency: null });
  const running = useRef(null);
  const lastSuccess = useRef(0);
  const sync = useCallback(async () => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const samples = [];
      for (let i = 0; i < 5; i++) {
        if (controller.signal.aborted) return;
        const startedAt = Date.now();
        const monotonic = performance.now();
        try {
          const result = await roomApi.time(controller.signal);
          samples.push(clockSample(result.serverTime, startedAt, Date.now(), performance.now() - monotonic));
        } catch (e) { if (controller.signal.aborted) throw e; }
      }
      const sample = bestClockSample(samples);
      if (running.current !== controller) return;
      lastSuccess.current = Date.now();
      setState({ clockOffset: sample.offset, offset: sample.offset, latency: sample.latency, synced: true, error: "" });
    } catch (e) {
      if (running.current !== controller) return;
      setState((old) => ({ ...old, synced: !!lastSuccess.current && Date.now() - lastSuccess.current < 180000, error: "Clock synchronization failed. Check your connection and try again." }));
    } finally { clearTimeout(timeout); }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    sync();
    const interval = setInterval(sync, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      const controller = running.current;
      running.current = null;
      controller?.abort();
    };
  }, [enabled, sync]);
  return { ...state, sync };
}
export default useClockSync;
