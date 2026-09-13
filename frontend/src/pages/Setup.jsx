import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { Steps } from "../components/Chrome";
import LayoutSelector from "../components/LayoutSelector";
import LayoutPreview from "../components/LayoutPreview";
import { useBooth } from "../context/PhotoboothContext";
import { frames } from "../utils/frames";
import { filters } from "../utils/filters";
export default function Setup({ library = false }) {
  const [params] = useSearchParams();
  const [step, setStep] = useState(params.get("step") === "frame" ? 2 : 1);
  const navigate = useNavigate();
  const booth = useBooth();
  const {
    layout,
    frame,
    setFrame,
    settings,
    setSettings,
    preset,
    setPreset,
    photos,
    notify,
  } = booth;
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  async function logo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg"].includes(f.type) ||
      f.size > 2 * 1024 * 1024
    )
      return notify("Choose a PNG or JPG logo under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => change("logo", reader.result);
    reader.readAsDataURL(f);
  }
  return (
    <main className="section setup-page">
      <Steps current={step} />
      <div className="page-title">
        <span className="eyebrow">
          {step === 1
            ? "A LITTLE SPACE FOR YOUR MEMORIES"
            : "THE DETAILS MAKE IT YOURS"}
        </span>
        <h1>
          {step === 1
            ? library
              ? "Find your perfect layout."
              : "Every memory starts with a frame."
            : "Add a little personality."}
        </h1>
        <p>
          {step === 1
            ? "Pick a layout that feels like you. We’ll take care of the rest."
            : "Choose a color, leave a message, make it unmistakably you."}
        </p>
      </div>
      {step === 1 ? (
        <LayoutSelector
          onContinue={() => {
            setStep(2);
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <div className="layout-workspace">
          <div className="settings-panel">
            <button className="text-link" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back to layouts
            </button>
            <h2>Find your feeling</h2>
            <div className="frame-grid">
              {frames.map((f) => (
                <button
                  className={f.id === frame.id ? "selected" : ""}
                  key={f.id}
                  aria-label={f.name}
                  onClick={() => setFrame(f)}
                >
                  <span
                    style={{
                      background: f.backgroundColor,
                      color: f.textColor,
                    }}
                  >
                    a little
                    <br />
                    <em>moment</em>
                    {f.decoration && <i>✧</i>}
                  </span>
                  {f.name}
                </button>
              ))}
            </div>
            <h2>A few words to remember</h2>
            <label>
              Event name
              <input
                maxLength={100}
                value={settings.eventName}
                onChange={(e) => change("eventName", e.target.value)}
                placeholder="Best day ever"
              />
            </label>
            <label>
              Your message
              <input
                maxLength={240}
                value={settings.message}
                onChange={(e) => change("message", e.target.value)}
              />
            </label>
            <div className="field-grid">
              <label>
                Date
                <input
                  type="date"
                  value={settings.date}
                  onChange={(e) => change("date", e.target.value)}
                />
              </label>
              <label>
                Filter preset
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                >
                  {filters.map((f) => (
                    <option key={f.name}>{f.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="checkbox-row">
              {[
                ["showEvent", "Event name"],
                ["showMessage", "Message"],
                ["showDate", "Date"],
                ["showLogo", "Logo"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => change(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="upload-label">
              <Upload size={16} />{" "}
              {settings.logo ? "Replace logo" : "Add your logo"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={logo}
              />
            </label>
            {settings.logo && (
              <button
                className="text-link"
                onClick={() => change("logo", null)}
              >
                Remove logo
              </button>
            )}
            <details>
              <summary>Customize layout</summary>
              <label>
                QR destination (optional)
                <input
                  type="url"
                  maxLength={1000}
                  placeholder="https://example.com/event"
                  value={settings.qrURL || ""}
                  onChange={(e) => change("qrURL", e.target.value)}
                />
              </label>
              {layout.category === "Magazine" && (
                <label>
                  Magazine title
                  <input
                    maxLength={40}
                    value={settings.magazineTitle || "MEMORIES"}
                    onChange={(e) => change("magazineTitle", e.target.value)}
                  />
                </label>
              )}
              <div className="field-grid">
                {[
                  ["spacing", "Photo spacing", 0, 120],
                  ["margin", "Outer margin", 0, 150],
                  ["radius", "Corner radius", 0, 180],
                  ["borderWidth", "Border width", 0, 30],
                ].map(([key, label, min, max]) => (
                  <label key={key}>
                    {label} <span>{settings[key]} px</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={settings[key]}
                      onChange={(e) => change(key, Number(e.target.value))}
                    />
                  </label>
                ))}
                <label>
                  Background
                  <input
                    type="color"
                    value={
                      settings.background ||
                      layout.background ||
                      frame.backgroundColor
                    }
                    onChange={(e) => change("background", e.target.value)}
                  />
                </label>
                <label>
                  Border color
                  <input
                    type="color"
                    value={settings.borderColor || frame.borderColor}
                    onChange={(e) => change("borderColor", e.target.value)}
                  />
                </label>
                <label>
                  Text placement
                  <select
                    value={settings.textPlacement}
                    onChange={(e) => change("textPlacement", e.target.value)}
                  >
                    <option value="bottom">Bottom</option>
                    <option value="top">Top overlay</option>
                  </select>
                </label>
                <label>
                  Footer text
                  <input
                    maxLength={80}
                    value={settings.footer}
                    onChange={(e) => change("footer", e.target.value)}
                  />
                </label>
              </div>
              <div className="checkbox-row">
                {[
                  ["showHeader", "Show title"],
                  ["showFooter", "Show footer"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => change(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                className="text-link"
                onClick={() => change("background", undefined)}
              >
                Use frame background
              </button>
            </details>
          </div>
          <aside className="preview-sidebar">
            <span className="eyebrow">LOOKING GOOD ALREADY</span>
            <div className="preview-stage">
              <LayoutPreview {...{ layout, frame, settings, preset, photos }} />
            </div>
            <h3>{layout.name}</h3>
            <p>
              {frame.name} · {layout.photoCount} photos
            </p>
            <button
              className="button"
              onClick={() =>
                navigate(
                  photos.slice(0, layout.photoCount).filter(Boolean).length ===
                    layout.photoCount
                    ? "/edit"
                    : "/photobooth",
                )
              }
            >
              {photos.length
                ? "Continue with photos"
                : "Let’s take some photos"}{" "}
              <ArrowRight size={17} />
            </button>
            <small>Your camera opens on the next step.</small>
          </aside>
        </div>
      )}
    </main>
  );
}
