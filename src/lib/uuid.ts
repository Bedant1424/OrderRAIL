/**
 * Generates a standard RFC4122 v4 compliant UUID string.
 * Uses window.crypto.randomUUID() when available, falling back to a Math.random
 * based implementation in insecure contexts (such as accessing the app via HTTP on a network IP).
 */
export function generateUUID(): string {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  // Fallback RFC4122 version 4 compliant generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
