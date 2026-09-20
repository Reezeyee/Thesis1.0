/**
 * The ONE rule for person-name fields (full name, first/last name, nickname, emergency contact
 * name...): letters from any alphabet -- including ñ/Ñ and accented letters like é, ü, ç -- plus
 * spaces, hyphens (-), apostrophes (' or ’) and periods (.) for initials like "J." or "Jr.".
 * Digits and every other symbol are rejected. Every name input must run its value through
 * `sanitizeNameInput` as the user types and check `isValidPersonName` before saving; do not write
 * a separate name check for a new form.
 */
export const ACCEPTED_NAME_CHARS_DESCRIPTION =
  "Letters (including ñ and accented letters), spaces, hyphens (-), apostrophes ('), and periods (.)";
export const NAME_ERROR_MESSAGE =
  "Name can only have letters (ñ and accents are fine), spaces, hyphens (-), apostrophes (') and periods (.) -- no numbers or other symbols.";

// \p{L} = any letter, \p{M} = combining accent marks (so "é" typed as e + ◌́ still counts).
const DISALLOWED_NAME_CHARS = /[^\p{L}\p{M}\s'’.\-]/gu;
const VALID_NAME = /^[\p{L}\p{M}\s'’.\-]+$/u;

/** Removes every character a name may not contain (typing or pasting digits/symbols does nothing) and squeezes runs of spaces. */
export function sanitizeNameInput(raw: string): string {
  return raw.replace(DISALLOWED_NAME_CHARS, '').replace(/\s+/g, ' ').replace(/^\s+/, '');
}

/** Trim + collapse spaces; use on the value that is actually saved. */
export function normalizeName(raw: string): string {
  return sanitizeNameInput(raw).trim();
}

/**
 * A usable name: only allowed characters and at least one real letter (so "..." or "-" alone is
 * not a name). `allowPeriod: false` is for parts that never hold initials (e.g. last name).
 */
export function isValidPersonName(name: string, allowPeriod = true): boolean {
  const trimmed = name.trim();
  if (!trimmed || !VALID_NAME.test(trimmed) || !/\p{L}/u.test(trimmed)) return false;
  return allowPeriod || !trimmed.includes('.');
}
