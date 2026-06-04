// ─── INPUT SANITIZATION ──────────────────────────────────────
// Defense-in-depth: sanitize all user input before it reaches Supabase.
// Supabase uses parameterized queries (no SQL injection risk), but
// stored XSS is still possible if we render unsanitized data.

/**
 * Strip HTML tags and script content from a string.
 * Prevents stored XSS if the value is later rendered.
 */
export function stripHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Validate and clamp a monetary amount.
 * Returns the number if valid, or null if not.
 */
export function validateAmount(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  if (num > 999999.99) return null;
  // Round to 2 decimal places to prevent floating point issues
  return Math.round(num * 100) / 100;
}

/**
 * Validate an ISO date string (YYYY-MM-DD).
 * Rejects dates more than 1 year in the future or before 2020.
 */
export function validateDate(dateStr) {
  if (typeof dateStr !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const earliest = new Date("2020-01-01");

  if (date > oneYearFromNow || date < earliest) return null;
  return dateStr;
}

/**
 * Sanitize a MoMo transaction reference.
 * Only allows alphanumeric characters.
 */
export function sanitizeMomoRef(ref) {
  if (typeof ref !== "string") return "";
  return ref.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(str, maxLen) {
  if (typeof str !== "string") return "";
  return str.slice(0, maxLen);
}

/**
 * Sanitize an entire transaction object before saving.
 * Returns a new object with all fields cleaned.
 */
export function sanitizeTransaction(tx) {
  const clean = { ...tx };

  // Sanitize strings
  if (clean.description) clean.description = truncate(stripHtml(clean.description), 500);
  if (clean.category)    clean.category    = truncate(stripHtml(clean.category), 100);
  if (clean.method)      clean.method      = truncate(stripHtml(clean.method), 100);
  if (clean.momoRef)     clean.momoRef     = sanitizeMomoRef(clean.momoRef);

  // Validate amount
  const amt = validateAmount(clean.amount);
  if (amt === null) throw new Error("Invalid amount. Please enter a positive number under GH₵ 1,000,000.");
  clean.amount = amt;

  // Validate date
  const date = validateDate(clean.date);
  if (date === null) throw new Error("Invalid date. Please enter a valid date between 2020 and next year.");
  clean.date = date;

  // Validate type
  if (!["income", "expense"].includes(clean.type)) {
    clean.type = "income";
  }

  return clean;
}

/**
 * Sanitize a plain text input (for names, wallet names, etc.)
 */
export function sanitizeText(str, maxLen = 200) {
  return truncate(stripHtml(str), maxLen);
}
