export function sessionId() {
  let id = sessionStorage.getItem("photobooth_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("photobooth_session_id", id);
  }
  return id;
}
