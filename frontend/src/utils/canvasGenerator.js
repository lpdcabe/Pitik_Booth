import { filterCSS } from "./filters";
import QRCode from "qrcode";
import { filteredBitmap } from "./filterFallback";
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("A photo could not be loaded. Please replace it."));
    img.src = src;
  });
export function resolveSlots(layout, settings = {}) {
  const inset = Number(settings.margin || 0);
  const spacing = Number(settings.spacing || 0);
  return layout.slots.map((s) => ({
    ...s,
    x: s.x + inset * (1 - (2 * s.x) / layout.width) + spacing / 2,
    y: s.y + inset * (1 - (2 * s.y) / layout.height) + spacing / 2,
    width: Math.max(20, s.width * (1 - (2 * inset) / layout.width) - spacing),
    height: Math.max(
      20,
      s.height * (1 - (2 * inset) / layout.height) - spacing,
    ),
  }));
}
function clip(ctx, s, radius) {
  const { width: w, height: h } = s;
  ctx.beginPath();
  if (s.mask === "circle") ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
  else if (s.mask === "heart") {
    ctx.moveTo(0, h / 2);
    ctx.bezierCurveTo(-w, -h / 8, -w / 3, -h * 0.85, 0, -h * 0.25);
    ctx.bezierCurveTo(w / 3, -h * 0.85, w, -h / 8, 0, h / 2);
  } else if (s.mask === "arch") {
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.bezierCurveTo(-w / 2, -h * 0.67, w / 2, -h * 0.67, w / 2, 0);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
  } else
    ctx.roundRect(
      -w / 2,
      -h / 2,
      w,
      h,
      s.mask === "rounded"
        ? Math.min(w, h) * 0.18
        : Math.min(radius, w / 2, h / 2),
    );
}
export async function generateCanvas(
  { layout, frame, photos = [], settings = {}, preset = "Original" },
  scale = 1,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  const canvasFilterSupported = "filter" in ctx;
  if (layout.duplicate) {
    const strip = await generateCanvas(
      {
        layout: {
          ...layout,
          width: layout.width / 2,
          slots: layout.slots.slice(0, layout.photoCount),
          duplicate: false,
        },
        frame,
        photos,
        settings,
        preset,
      },
      scale,
    );
    ctx.drawImage(strip, 0, 0);
    ctx.drawImage(strip, strip.width, 0);
    return canvas;
  }
  ctx.scale(scale, scale);
  const w = layout.width,
    h = layout.height,
    bg =
      settings.background ||
      (frame.id === "classic-white" && layout.background) ||
      frame.backgroundColor,
    ink = (frame.id === "classic-white" && layout.textColor) || frame.textColor;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const decoration = frame.decoration || layout.decoration;
  if (layout.name.includes("Y2K")) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bg);
    g.addColorStop(1, "#b8dcf1");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  for (const [i, s] of resolveSlots(layout, settings).entries()) {
    const p = photos[s.photoIndex ?? i],
      // Decode only the photo being drawn. A four-person, nine-round room
      // should not retain 36 full-resolution decoded camera images at once.
      img = p ? await loadImage(p.src) : null;
    ctx.save();
    ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    if (["polaroid", "tape", "pins"].includes(decoration)) {
      ctx.shadowColor = "#00000025";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(
        -s.width / 2 - 22,
        -s.height / 2 - 22,
        s.width + 44,
        s.height + 95,
      );
      ctx.shadowColor = "transparent";
    }
    clip(ctx, s, Number(settings.radius || 0));
    ctx.save();
    ctx.clip();
    if (img) {
      const css = filterCSS(p, preset);
      const bitmap = canvasFilterSupported ? img : filteredBitmap(img, css);
      if (canvasFilterSupported) ctx.filter = css;
      const zoom = p.zoom || 1;
      const ratio =
        (p.fit === "contain"
          ? Math.min(s.width / img.width, s.height / img.height)
          : Math.max(s.width / img.width, s.height / img.height)) * zoom;
      const dw = img.width * ratio,
        dh = img.height * ratio;
      ctx.fillStyle = bg;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.drawImage(
        bitmap,
        -dw / 2 + (((p.panX || 0) / 100) * Math.abs(dw - s.width)) / 2,
        -dh / 2 + (((p.panY || 0) / 100) * Math.abs(dh - s.height)) / 2,
        dw,
        dh,
      );
      if (!canvasFilterSupported) {
        // Safari's filter fallback uses a temporary full-size Canvas.
        bitmap.width = 0;
        bitmap.height = 0;
      }
      ctx.filter = "none";
      const grain = p.adjustments?.grain || 0;
      if (grain) {
        ctx.fillStyle = `rgba(35,29,21,${grain / 550})`;
        let seed = i + 1;
        for (let n = 0; n < grain * 75; n++) {
          seed = (seed * 16807) % 2147483647;
          const x = (seed / 2147483647) * s.width - s.width / 2;
          seed = (seed * 16807) % 2147483647;
          ctx.fillRect(x, (seed / 2147483647) * s.height - s.height / 2, 2, 2);
        }
      }
    } else {
      const g = ctx.createLinearGradient(
        -s.width / 2,
        -s.height / 2,
        s.width / 2,
        s.height / 2,
      );
      g.addColorStop(0, ["#b5c1a5", "#d9c7ad", "#c8cec5", "#d9b8ad"][i % 4]);
      g.addColorStop(1, "#e6e8da");
      ctx.fillStyle = g;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.fillStyle = "#ffffffaa";
      ctx.beginPath();
      ctx.arc(
        s.width * 0.19,
        -s.height * 0.16,
        Math.min(s.width, s.height) * 0.12,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#66775c35";
      ctx.beginPath();
      ctx.moveTo(-s.width / 2, s.height / 2);
      ctx.lineTo(-s.width * 0.15, -s.height * 0.05);
      ctx.lineTo(s.width * 0.12, s.height * 0.2);
      ctx.lineTo(s.width * 0.35, -s.height * 0.15);
      ctx.lineTo(s.width / 2, s.height / 2);
      ctx.fill();
      ctx.fillStyle = "#3e503c";
      ctx.textAlign = "center";
      ctx.font = `500 ${Math.min(s.width, s.height) * 0.07}px sans-serif`;
      ctx.fillText(`PHOTO ${(s.photoIndex ?? i) + 1}`, 0, s.height * 0.3);
    }
    ctx.restore();
    if (settings.borderWidth) {
      clip(ctx, s, Number(settings.radius || 0));
      ctx.lineWidth = Number(settings.borderWidth);
      ctx.strokeStyle = settings.borderColor || frame.borderColor;
      ctx.stroke();
    }
    if (decoration === "tape") {
      ctx.fillStyle = "#d3b98ebb";
      ctx.fillRect(-s.width * 0.2, -s.height / 2 - 38, s.width * 0.4, 65);
    }
    if (decoration === "pins") {
      ctx.fillStyle = "#b45543";
      ctx.beginPath();
      ctx.arc(0, -s.height / 2 - 10, 19, 0, Math.PI * 2);
      ctx.fill();
    }
    if (decoration === "film") {
      ctx.fillStyle = ink;
      ctx.font = "22px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `FRAME ${String((s.photoIndex ?? i) + 1).padStart(2, "0")}  •  35mm`,
        -s.width / 2,
        s.height / 2 + 35,
      );
    }
    if (["timestamp", "vhs"].includes(decoration)) {
      ctx.fillStyle = "#ffad55";
      ctx.font = `${w * 0.016}px monospace`;
      ctx.fillText(
        `${decoration === "vhs" ? "● REC  " : ""}${settings.date || new Date().toISOString().slice(0, 10)}`,
        -s.width * 0.44,
        s.height * 0.43,
      );
    }
    ctx.restore();
    if (img) img.removeAttribute("src");
  }
  if (decoration === "film") {
    ctx.fillStyle = "#eee8d6";
    if (w < h) {
      for (let y = 50; y < h - 40; y += 140) {
        ctx.beginPath();
        ctx.roundRect(22, y, 38, 65, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(w - 60, y, 38, 65, 6);
        ctx.fill();
        ctx.beginPath();
      }
    } else {
      for (let x = 50; x < w - 40; x += 140) {
        ctx.fillRect(x, 22, 65, 35);
        ctx.fillRect(x, h - 60, 65, 35);
      }
    }
  }
  const glyph = {
    hearts: "♥",
    floral: "❀",
    stars: "✦",
    snow: "❄",
    confetti: "✧",
    halloween: "✦",
    arcade: "▣",
  }[decoration];
  if (glyph) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.55;
    ctx.font = `${w * 0.045}px serif`;
    for (let n = 0; n < 8; n++) {
      ctx.fillText(
        glyph,
        n % 2 ? w * 0.94 : w * 0.025,
        h * (0.08 + Math.floor(n / 2) * 0.23),
      );
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  if (layout.category === "Magazine" && settings.showHeader !== false) {
    ctx.font = `bold ${w * 0.115}px Georgia`;
    ctx.fillText(
      settings.magazineTitle || "MEMORIES",
      w / 2,
      h * 0.1,
      w * 0.88,
    );
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText("THE GOOD TIMES ISSUE", w / 2, h * 0.135, w * 0.8);
  }
  const title =
    settings.showEvent === false
      ? ""
      : settings.eventName || layout.header || "Pitik Booth";
  const titleY = layout.centerText
    ? h * 0.49
    : settings.textPlacement === "top"
      ? h * 0.06
      : h * 0.91;
  const titleSize = Math.min(w * 0.052, 110);
  ctx.font = `${decoration === "editorial" ? "bold" : "500"} ${titleSize}px Georgia`;
  if (settings.showHeader !== false && title)
    ctx.fillText(title, w / 2, titleY, w * (layout.centerText ? 0.26 : 0.8));
  ctx.font = `${Math.min(w * 0.024, 46)}px sans-serif`;
  if (settings.showMessage !== false && settings.message)
    ctx.fillText(
      settings.message,
      w / 2,
      layout.centerText ? h * 0.53 : h * 0.947,
      w * (layout.centerText ? 0.26 : 0.8),
    );
  if (settings.showDate !== false)
    ctx.fillText(
      settings.date || new Date().toISOString().slice(0, 10),
      w / 2,
      layout.centerText ? h * 0.57 : h * 0.975,
      w * (layout.centerText ? 0.26 : 0.8),
    );
  if (settings.showFooter && settings.footer) {
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText(settings.footer, w / 2, h * 0.995, w * 0.8);
  }
  if (settings.logo && settings.showLogo !== false) {
    const logo = await loadImage(settings.logo);
    const size = w * 0.09;
    const ratio = Math.min(size / logo.width, size / logo.height);
    ctx.drawImage(
      logo,
      w * 0.85,
      h * 0.9,
      logo.width * ratio,
      logo.height * ratio,
    );
  }
  if (settings.qrURL && /^https?:\/\//i.test(settings.qrURL)) {
    const qr = await loadImage(
      await QRCode.toDataURL(settings.qrURL, { width: 240, margin: 1 }),
    );
    const size = Math.min(w * 0.12, h * 0.12);
    ctx.drawImage(qr, w * 0.025, h - size - h * 0.025, size, size);
  }
  return canvas;
}
export const canvasBlob = (canvas, type = "image/png") =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Unable to export image.")),
      type,
      0.95,
    ),
  );
