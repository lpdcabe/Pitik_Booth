import { frames } from "../utils/frames";

export default function FramePicker({ value, onChange, className = "" }) {
  const selectedId = typeof value === "string" ? value : value?.id;

  return (
    <div className={`frame-grid ${className}`.trim()}>
      {frames.map((frame) => (
        <button
          type="button"
          className={frame.id === selectedId ? "selected" : ""}
          key={frame.id}
          aria-label={frame.name}
          aria-pressed={frame.id === selectedId}
          onClick={() => onChange(frame)}
        >
          <span
            style={{
              background: frame.backgroundColor,
              color: frame.textColor,
            }}
          >
            a little
            <br />
            <em>moment</em>
            {frame.decoration && <i>✧</i>}
          </span>
          {frame.name}
        </button>
      ))}
    </div>
  );
}
