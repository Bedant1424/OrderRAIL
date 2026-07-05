// Anonymous customer session id (uuid), stored in localStorage per browser.
const KEY = "orderrail.session_id";

export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
