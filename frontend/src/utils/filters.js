export const filters = [
  ["Original", "none"],
  ["Black & White", "grayscale(1) contrast(1.2)"],
  ["Grayscale", "grayscale(1)"],
  ["Sepia", "sepia(1)"],
  ["Vintage", "sepia(.35) contrast(.88) saturate(.8)"],
  ["Warm", "sepia(.2) saturate(1.2)"],
  ["Cool", "hue-rotate(15deg) saturate(.85)"],
  ["High Contrast", "contrast(1.45)"],
  ["Soft", "contrast(.85) brightness(1.1)"],
  ["Film", "sepia(.15) contrast(1.15) saturate(.8)"],
  ["Retro", "sepia(.4) saturate(1.3)"],
  ["Bright", "brightness(1.2)"],
  ["Disposable Camera", "sepia(.2) contrast(1.25) saturate(1.15)"],
  ["Faded", "contrast(.75) saturate(.8) brightness(1.1)"],
  ["Cinematic", "contrast(1.2) saturate(.65)"],
].map(([name, css]) => ({ name, css }));
export const defaultAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  warmth: 0,
  grain: 0,
};
export function filterCSS(photo = {}, preset = "Original") {
  const a = { ...defaultAdjustments, ...photo.adjustments };
  return `${filters.find((f) => f.name === (photo.filter || preset))?.css.replace("none", "") || ""} brightness(${(a.brightness / 100) * 2 ** (a.exposure / 100)}) contrast(${a.contrast / 100}) saturate(${a.saturation / 100}) sepia(${a.warmth / 200})`;
}
