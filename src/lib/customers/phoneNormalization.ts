/**
 * Centralized Phone Normalization Utility
 * Normalizes user-entered phone numbers to a single canonical representation
 * for cafe-scoped customer deduplication.
 */

/**
 * Normalizes phone number to a clean, canonical string.
 * Strips all non-digit characters, removes leading +91 / 91 / 0 country codes for 10-digit Indian numbers.
 * Examples:
 *  - "98765 43210" -> "9876543210"
 *  - "+91 98765 43210" -> "9876543210"
 *  - "919876543210" -> "9876543210"
 *  - "09876543210" -> "9876543210"
 */
export function normalizePhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Remove all non-digit characters
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return null;

  // Handle 12-digit numbers starting with country code 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return digitsOnly.slice(2);
  }

  // Handle 11-digit numbers starting with trunk prefix 0
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return digitsOnly.slice(1);
  }

  return digitsOnly;
}

/**
 * Formats a normalized 10-digit phone number for clean UI display.
 */
export function formatDisplayPhone(phone?: string | null): string {
  if (!phone) return "—";
  const norm = normalizePhoneNumber(phone);
  if (!norm) return phone || "—";

  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }

  return norm;
}
