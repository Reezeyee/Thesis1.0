/**
 * The ONE phone-number rule for the whole app: a Philippine mobile number is exactly 11 digits
 * (e.g. 09171234567) -- digits only, no letters, spaces, dashes, parentheses or "+". Every phone
 * input must run its value through `sanitizePhoneInput` as the user types and check
 * `isValidPhone11` before saving; do not write a separate phone check for a new form.
 * Do NOT set an HTML `maxLength` on phone inputs: it truncates pasted text like "0917-123-4567"
 * to 11 raw characters BEFORE sanitizing, silently dropping digits. `sanitizePhoneInput` already caps at 11.
 */
export const PHONE_LENGTH = 11;
export const PHONE_PLACEHOLDER = '09171234567';
export const PHONE_ERROR_MESSAGE = `Phone number must be exactly ${PHONE_LENGTH} digits starting with 09 (example: ${PHONE_PLACEHOLDER}), with no letters or symbols.`;

/** Strips everything but digits (so typing or pasting letters/symbols does nothing), turns a pasted +639… into 09…, and caps at 11 digits. */
export function sanitizePhoneInput(raw: string): string {
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('639')) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned.slice(0, PHONE_LENGTH);
}

export function isValidPhone11(phone: string): boolean {
  return /^09\d{9}$/.test(phone) && sanitizePhoneInput(phone) === phone;
}
