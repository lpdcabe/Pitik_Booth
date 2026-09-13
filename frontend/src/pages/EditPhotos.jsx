import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RotateCcw, ArrowLeft, ArrowRight, Upload, Trash2 } from "lucide-react";
import { useBooth } from "../context/PhotoboothContext";
import LayoutPreview from "../components/LayoutPreview";
import { filters, filterCSS, defaultAdjustments } from "../utils/filters";
import { Steps } from "../components/Chrome";
export default function EditPhotos() {
  const booth = useBooth(),
    { photos, setPhotos, layout, preset, notify } = booth;
  const [selected, setSelected] = useState(0),
    [all, setAll] = useState(false);
  const navigate = useNavigate();
  const photo = photos[selected];
  function update(patch) {
    setPhotos((old) =>
      old.map((p, i) =>
        p && (all || i === selected) ? { ...p, ...patch } : p,
      ),
    );
  }
  function swap(delta) {
    const j = selected + delta;
    if (j < 0 || j >= layout.photoCount) return;
    setPhotos((old) => {
      const next = [...old];
      [next[selected], next[j]] = [next[j], next[selected]];
      return next;
    });
    setSelected(j);
  }
  async function replace(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
      f.size > 10 * 1024 * 1024
    )
      return notify("Choose an image under 10 MB.");
    const reader = new FileReader();
    reader.onload = () =>
      setPhotos((old) => {
        const next = [...old];
        next[selected] = {
          src: reader.result,
          filter: preset,
          zoom: 1,
          panX: 0,
          panY: 0,
        };
        return next;
      });
    reader.readAsDataURL(f);
    e.target.value = "";
  }
  const complete = Array.from(
    { length: layout.photoCount },
    (_, i) => photos[i],
  ).every(Boolean);
  return (
    <main className="section">
      <Steps current={3} />
      <div className="page-title">
        <span className="eyebrow">A LITTLE FINISHING TOUCH</span>
        <h1>Looking good. Feeling like you.</h1>
        <p>Pick your favorites, find your filter, and make every photo fit.</p>
      </div>
      <div className="layout-workspace">
        <div className="editor-panel">
          <div className="edit-thumbnails">
            {Array.from({ length: layout.photoCount }, (_, i) => (
              <button
                key={i}
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
              >
                {photos[i] ? (
                  <img src={photos[i].src} alt={`Select photo ${i + 1}`} />
                ) : (
                  <span>
                    Photo {i + 1}
                    <br />
                    Add photo
                  </span>
                )}
                <small>{i + 1}</small>
              </button>
            ))}
          </div>
          {photo ? (
            <div className="edit-photo">
              <img
                src={photo.src}
                alt={`Editing photo ${selected + 1}`}
                style={{ filter: filterCSS(photo, preset) }}
              />
            </div>
          ) : (
            <div className="empty-state">
              <h3>This spot is waiting for a memory.</h3>
              <Link className="button" to={`/photobooth?retake=${selected}`}>
                Take photo {selected + 1}
              </Link>
            </div>
          )}
          <div className="edit-actions">
            <Link
              className="button secondary"
              to={`/photobooth?retake=${selected}`}
            >
              <RotateCcw size={16} /> Retake
            </Link>
            <label className="button secondary">
              <Upload size={16} /> Replace
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                onChange={replace}
              />
            </label>
            <button
              className="icon-button"
              aria-label="Move photo left"
              disabled={selected === 0}
              onClick={() => swap(-1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Move photo right"
              disabled={selected === layout.photoCount - 1}
              onClick={() => swap(1)}
            >
              <ArrowRight size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Remove photo"
              onClick={() =>
                setPhotos((old) =>
                  old.map((p, i) => (i === selected ? null : p)),
                )
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
          {photo && (
            <>
              <div className="section-heading">
                <h3>Find your filter</h3>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) => setAll(e.target.checked)}
                  />{" "}
                  Apply edits to all photos
                </label>
              </div>
              <div className="filter-presets">
                {filters.map((f) => (
                  <button
                    key={f.name}
                    className={
                      (photo.filter || preset) === f.name ? "selected" : ""
                    }
                    onClick={() => update({ filter: f.name })}
                  >
                    <img src={photo.src} alt="" style={{ filter: f.css }} />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
              <details open>
                <summary>Crop & position</summary>
                <label>
                  Fit
                  <select
                    value={photo.fit || "cover"}
                    onChange={(e) => update({ fit: e.target.value })}
                  >
                    <option value="cover">Cover the frame</option>
                    <option value="contain">Show the whole photo</option>
                  </select>
                </label>
                <div className="field-grid">
                  {[
                    ["zoom", "Zoom", 1, 3, 0.05],
                    ["panX", "Horizontal position", -100, 100, 1],
                    ["panY", "Vertical position", -100, 100, 1],
                  ].map(([key, label, min, max, step]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={photo[key] ?? (key === "zoom" ? 1 : 0)}
                        onChange={(e) =>
                          update({ [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="help-text">
                  Your crop updates in the layout preview. Position controls
                  move photos within the available crop.
                </p>
              </details>
              <details>
                <summary>Fine-tune your photos</summary>
                <div className="field-grid">
                  {[
                    ["brightness", 50, 150],
                    ["contrast", 50, 150],
                    ["saturation", 0, 200],
                    ["exposure", -100, 100],
                    ["warmth", 0, 100],
                    ["grain", 0, 100],
                  ].map(([key, min, max]) => (
                    <label key={key} className="capitalize">
                      {key}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={
                          photo.adjustments?.[key] ?? defaultAdjustments[key]
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setPhotos((old) =>
                            old.map((p, i) =>
                              p && (all || i === selected)
                                ? {
                                    ...p,
                                    adjustments: {
                                      ...p.adjustments,
                                      [key]: value,
                                    },
                                  }
                                : p,
                            ),
                          );
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="text-link"
                  onClick={() =>
                    update({
                      adjustments: defaultAdjustments,
                      zoom: 1,
                      panX: 0,
                      panY: 0,
                      filter: "Original",
                    })
                  }
                >
                  Reset edits
                </button>
              </details>
            </>
          )}
        </div>
        <aside className="preview-sidebar">
          <span className="eyebrow">THE BIG PICTURE</span>
          <div className="preview-stage">
            <LayoutPreview {...booth} />
          </div>
          <h3>Made of your best moments.</h3>
          <p>
            {complete
              ? "Ready when you are."
              : `Fill all ${layout.photoCount} photo slots to continue.`}
          </p>
          <button
            className="button"
            disabled={!complete}
            onClick={() => navigate("/result")}
          >
            Create my photobooth <ArrowRight size={17} />
          </button>
          <Link className="text-link" to="/setup?step=frame">
            Change frame or layout
          </Link>
        </aside>
      </div>
    </main>
  );
}
