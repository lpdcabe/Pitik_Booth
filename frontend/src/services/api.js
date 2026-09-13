import { sessionId } from "../utils/session";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const imageURL = (photo) =>
  photo.image_url.startsWith("/") ? base + photo.image_url : photo.image_url;
async function request(path, options = {}) {
  const response = await fetch(`${base}/api/photobooths${path}`, {
    ...options,
    headers: { "X-Session-Id": sessionId(), ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return response.status === 204 ? null : response.json();
}
export const api = {
  save: (form) => request("", { method: "POST", body: form }),
  get: (id) => request(`/${id}`),
  list: () => request(`/session/${sessionId()}`),
  remove: (id) => request(`/${id}`, { method: "DELETE" }),
};
export async function downloadURL(url, extension = "png") {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to download this photo.");
  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectURL;
  a.download = `photobooth-${new Date().toISOString().slice(0, 10)}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
}
