import { generateUUID } from "./uuid";

// Anonymous customer session id (uuid), stored in localStorage per browser.
const KEY = "orderrail.session_id";

export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(KEY, id);
    if (import.meta.env.DEV) {
      console.log("[SESSION] Generated new browser session ID:", id);
    }
  } else {
    if (import.meta.env.DEV) {
      console.log("[SESSION] Reusing existing browser session ID:", id);
    }
  }
  return id;
}
