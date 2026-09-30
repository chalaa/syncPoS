/**
 * Standardize and normalize phone numbers for login and user management.
 * Converts formats like:
 *   "+251911223344" -> "0911223344"
 *   "251911223344" -> "0911223344"
 *   "09 11 22 33 44" -> "0911223344"
 *   "+251 7 12 34 56 78" -> "0712345678"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";

  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, "");

  if (cleaned.startsWith("+251")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("251") && cleaned.length === 12) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}
