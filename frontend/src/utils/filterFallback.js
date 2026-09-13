// Pixel fallback for browsers without CanvasRenderingContext2D.filter.
// Compose CSS color operations once, then transform each pixel in a single pass.
export function filteredBitmap(image, css) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  let matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const compose = (next) => {
    const out = Array(12).fill(0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++)
        for (let k = 0; k < 3; k++)
          out[r * 4 + c] += next[r * 4 + k] * matrix[k * 4 + c];
      out[r * 4 + 3] = next[r * 4 + 3];
      for (let k = 0; k < 3; k++)
        out[r * 4 + 3] += next[r * 4 + k] * matrix[k * 4 + 3];
    }
    matrix = out;
  };
  for (const match of css.matchAll(/([a-z-]+)\(([-.\d]+)(deg|%)?\)/g)) {
    const name = match[1],
      a = Number(match[2]) / (match[3] === "%" ? 100 : 1);
    let m;
    if (name === "brightness") m = [a, 0, 0, 0, 0, a, 0, 0, 0, 0, a, 0];
    if (name === "contrast") {
      const offset = 127.5 * (1 - a);
      m = [a, 0, 0, offset, 0, a, 0, offset, 0, 0, a, offset];
    }
    if (name === "saturate" || name === "grayscale") {
      const s = name === "grayscale" ? 1 - a : a;
      const r = 0.2126 * (1 - s),
        g = 0.7152 * (1 - s),
        b = 0.0722 * (1 - s);
      m = [r + s, g, b, 0, r, g + s, b, 0, r, g, b + s, 0];
    }
    if (name === "sepia")
      m = [
        1 - 0.607 * a,
        0.769 * a,
        0.189 * a,
        0,
        0.349 * a,
        1 - 0.314 * a,
        0.168 * a,
        0,
        0.272 * a,
        0.534 * a,
        1 - 0.869 * a,
        0,
      ];
    if (name === "hue-rotate") {
      const c = Math.cos((a * Math.PI) / 180),
        s = Math.sin((a * Math.PI) / 180);
      m = [
        0.213 + c * 0.787 - s * 0.213,
        0.715 - c * 0.715 - s * 0.715,
        0.072 - c * 0.072 + s * 0.928,
        0,
        0.213 - c * 0.213 + s * 0.143,
        0.715 + c * 0.285 + s * 0.14,
        0.072 - c * 0.072 - s * 0.283,
        0,
        0.213 - c * 0.213 - s * 0.787,
        0.715 - c * 0.715 + s * 0.715,
        0.072 + c * 0.928 + s * 0.072,
        0,
      ];
    }
    if (m) compose(m);
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height),
    pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    pixels[i] = matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[3];
    pixels[i + 1] = matrix[4] * r + matrix[5] * g + matrix[6] * b + matrix[7];
    pixels[i + 2] = matrix[8] * r + matrix[9] * g + matrix[10] * b + matrix[11];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
