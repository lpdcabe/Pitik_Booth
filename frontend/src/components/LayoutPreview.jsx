import { useEffect, useRef, useState } from "react";
import { generateCanvas } from "../utils/canvasGenerator";
import { frames } from "../utils/frames";
export default function LayoutPreview({
  layout,
  frame = frames[0],
  photos = [],
  settings = {},
  preset = "Original",
  className = "",
}) {
  const ref = useRef(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    generateCanvas(
      { layout, frame, photos, settings, preset },
      Math.min(1, 650 / layout.width, 1000 / layout.height),
    )
      .then((canvas) => {
        if (active && ref.current) {
          ref.current.replaceChildren(canvas);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [layout, frame, photos, settings, preset]);
  return (
    <div
      className={`layout-preview ${className}`}
      role="img"
      aria-label={`${layout.name}, ${layout.photoCount} photos`}
    >
      <div ref={ref} />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
