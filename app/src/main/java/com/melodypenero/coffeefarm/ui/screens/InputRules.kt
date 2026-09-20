package com.melodypenero.coffeefarm.ui.screens

/**
 * Standing input rules for the whole app (mirrors the website's lib/phone.ts and lib/personName.ts).
 * Any new phone or person-name field must use these helpers instead of writing its own check.
 */

/** What kind of value a [RecordField] holds, so [SimpleRecordDialog] can enforce the matching rule. */
enum class FieldKind { TEXT, PHONE, PERSON_NAME }

const val PHONE_LENGTH = 11
const val PHONE_ERROR_MESSAGE = "Phone number must be exactly 11 digits starting with 09 (example: 09171234567), no letters or symbols."
const val NAME_ERROR_MESSAGE = "Name can only have letters (ñ and accents are fine), spaces, hyphens (-), apostrophes (') and periods (.) -- no numbers or symbols."

private fun Char.isAsciiDigit() = this in '0'..'9'

/** Keeps digits only, turns a pasted +639… into 09…, and caps at 11 digits. */
fun sanitizePhoneInput(raw: String): String {
    var cleaned = raw.filter { it.isAsciiDigit() }
    if (cleaned.startsWith("639")) cleaned = "0" + cleaned.drop(2)
    return cleaned.take(PHONE_LENGTH)
}

fun isValidPhone11(phone: String): Boolean =
    phone.length == PHONE_LENGTH && phone.startsWith("09") && phone.all { it.isAsciiDigit() }

private fun isAllowedNameChar(c: Char): Boolean =
    c.isLetter() ||
        Character.getType(c) == Character.NON_SPACING_MARK.toInt() ||
        c == ' ' || c == '\'' || c == '’' || c == '-' || c == '.'

/** Removes every character a name may not contain (digits, symbols) and squeezes runs of spaces. */
fun sanitizeNameInput(raw: String): String =
    raw.filter(::isAllowedNameChar).replace(Regex(" +"), " ").trimStart()

/** A usable name: only allowed characters and at least one real letter. */
fun isValidPersonName(name: String): Boolean {
    val t = name.trim()
    return t.isNotEmpty() && t.all(::isAllowedNameChar) && t.any { it.isLetter() }
}

/** Value to actually save for a field of the given kind. */
fun normalizeFieldValue(kind: FieldKind, raw: String): String = when (kind) {
    FieldKind.PHONE -> sanitizePhoneInput(raw)
    FieldKind.PERSON_NAME -> sanitizeNameInput(raw).trim()
    FieldKind.TEXT -> raw
}

fun isFieldValueValid(kind: FieldKind, value: String): Boolean = when (kind) {
    FieldKind.PHONE -> isValidPhone11(value)
    FieldKind.PERSON_NAME -> isValidPersonName(value)
    FieldKind.TEXT -> true
}
