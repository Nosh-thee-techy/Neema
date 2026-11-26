/**
 * Phone number helpers for alert contacts.
 * An alert that goes to a wrong or placeholder number reaches nobody, so numbers
 * are checked when saved and placeholders are flagged before any real use.
 */

/**
 * Normalises a phone number to E.164.
 * Kenyan forms (0712 345 678, 712345678, 254712345678, +254 712 345 678, 0110…) become +254…;
 * other numbers must already start with + and have 8–15 digits.
 * Returns null when the number cannot be a real mobile number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');

  // Kenya: mobile numbers are 9 digits after the country code, starting 7 or 1.
  let kenyan: string | null = null;
  if (plus && digits.startsWith('254')) kenyan = digits.slice(3);
  else if (!plus && digits.startsWith('254') && digits.length === 12) kenyan = digits.slice(3);
  else if (!plus && digits.startsWith('0') && digits.length === 10) kenyan = digits.slice(1);
  else if (!plus && digits.length === 9) kenyan = digits;

  if (kenyan !== null) {
    return /^[17]\d{8}$/.test(kenyan) ? `+254${kenyan}` : null;
  }
  if (plus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * True for obviously fake numbers (all one digit after the network prefix, or the
 * demo numbers older builds created), which must be replaced before real use.
 */
export function isPlaceholderPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  if (!normalized) return true;
  const local = normalized.startsWith('+254') ? normalized.slice(4) : normalized.slice(1);
  const subscriber = local.slice(2); // after e.g. "70"
  return /^(\d)\1+$/.test(subscriber) || /^(\d)\1+$/.test(local);
}
