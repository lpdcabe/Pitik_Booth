import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Copy } from "lucide-react";
export default function QRCodeModal({ url, onClose }) {
  const [src, setSrc] = useState(""),
    [copied, setCopied] = useState(false),
    ref = useRef();
  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#354b38", light: "#ffffff" },
    }).then(setSrc);
    ref.current?.showModal();
  }, [url]);
  return (
    <dialog
      ref={ref}
      className="qr-modal"
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button
        className="icon-button close"
        aria-label="Close QR code"
        onClick={onClose}
      >
        <X />
      </button>
      <span className="eyebrow">PASS THE MEMORY ON</span>
      <h2>Scan to download</h2>
      <p>A little moment, ready to share.</p>
      {src && <img src={src} alt="QR code linking to this photobooth" />}
      <input readOnly aria-label="Share link" value={url} />
      <button
        className="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={16} />
        {copied ? "Link copied" : "Copy link"}
      </button>
    </dialog>
  );
}
