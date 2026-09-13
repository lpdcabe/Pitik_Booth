import { createContext, useContext, useState } from "react";
import { defaultLayout } from "../utils/layouts";
import { frames } from "../utils/frames";
const Context = createContext(null);
const initialSettings = () => ({
  eventName: "Pitik Booth",
  message: "a little moment, a lasting memory.",
  date: new Date().toISOString().slice(0, 10),
  showEvent: true,
  showMessage: true,
  showDate: true,
  showHeader: true,
  showFooter: false,
  showLogo: true,
  footer: "made with Pitik Booth",
  spacing: 0,
  margin: 0,
  radius: 0,
  borderWidth: 0,
  textPlacement: "bottom",
});
export function PhotoboothProvider({ children }) {
  const [layout, setLayout] = useState(defaultLayout),
    [frame, setFrame] = useState(frames[0]),
    [photos, setPhotos] = useState([]),
    [settings, setSettings] = useState(initialSettings),
    [preset, setPreset] = useState("Original"),
    [toast, setToast] = useState("");
  const notify = (message) => {
    setToast(message);
    setTimeout(
      () => setToast((current) => (current === message ? "" : current)),
      4000,
    );
  };
  function reset() {
    setPhotos([]);
    setSettings(initialSettings());
    setLayout(defaultLayout);
    setFrame(frames[0]);
    setPreset("Original");
  }
  return (
    <Context.Provider
      value={{
        layout,
        setLayout,
        frame,
        setFrame,
        photos,
        setPhotos,
        settings,
        setSettings,
        preset,
        setPreset,
        notify,
        reset,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export const useBooth = () => useContext(Context);
