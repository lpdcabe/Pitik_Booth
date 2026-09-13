/** Fetch the saved still through the public image API and encode the chosen format. */
export async function photoDownloadBlob(url, format = "png") {
  if (!["png", "jpg"].includes(format)) throw new Error("Choose PNG or JPG.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to download this photo. Please try again.");
  const source = await response.blob();
  const type = format === "jpg" ? "image/jpeg" : "image/png";
  if (source.type === type) return source;

  // A same-origin object URL avoids cross-origin Canvas export restrictions.
  const objectURL = URL.createObjectURL(source);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("This photo could not be decoded."));
      image.src = objectURL;
    });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the download.");
    if (format === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to export this photo.")), type, 0.95);
    });
  } finally {
    image.removeAttribute("src");
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(objectURL);
  }
}

export async function downloadPhoto(url, format = "png") {
  const blob = await photoDownloadBlob(url, format);
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectURL;
  anchor.download = `pitik-booth-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Mobile browsers may consume the object URL after the click task ends.
  setTimeout(() => URL.revokeObjectURL(objectURL), 30000);
}
