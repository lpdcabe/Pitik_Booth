const localFrontendOrigin = "http://localhost:5173";

export function getFrontendOrigin() {
  const configured = process.env.FRONTEND_URL?.trim() || localFrontendOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return localFrontendOrigin;
  }
}
