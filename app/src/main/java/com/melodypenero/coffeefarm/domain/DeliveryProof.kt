package com.melodypenero.coffeefarm.domain

/**
 * Limits for the rider's proof-of-delivery photo. It is stored as a JPEG data URL in Firestore
 * (`delivery_proofs/{orderId}.photo`), and firestore.rules only accepts a JPEG data URL of at most
 * [PROOF_MAX_DATA_URL_CHARS] characters -- keep these two numbers in sync with the rules.
 */
const val PROOF_DATA_URL_PREFIX = "data:image/jpeg;base64,"
const val PROOF_MAX_DATA_URL_CHARS = 700_000

/** Target JPEG size. Base64 makes it ~4/3 bigger, so this leaves headroom under [PROOF_MAX_DATA_URL_CHARS]. */
const val PROOF_MAX_JPEG_BYTES = 480_000

/** Longest side of the stored photo, in pixels: readable detail (doorstep, package, house) without a huge upload. */
const val PROOF_MAX_SIDE_PX = 1280

/** Base64 text length for [byteCount] bytes (4 characters per 3 bytes, padded). */
fun base64Length(byteCount: Int): Int = ((byteCount + 2) / 3) * 4

/** True if a JPEG of [jpegByteCount] bytes, as a data URL, is small enough for firestore.rules. */
fun proofFitsLimit(jpegByteCount: Int): Boolean =
    PROOF_DATA_URL_PREFIX.length + base64Length(jpegByteCount) <= PROOF_MAX_DATA_URL_CHARS

/** True if [dataUrl] is a JPEG data URL within the size the rules allow. */
fun isValidProofDataUrl(dataUrl: String): Boolean =
    dataUrl.startsWith(PROOF_DATA_URL_PREFIX) && dataUrl.length <= PROOF_MAX_DATA_URL_CHARS

/** Scales (width, height) down so the longest side is at most [maxSide], keeping the aspect ratio. Never scales up. */
fun fitWithin(width: Int, height: Int, maxSide: Int = PROOF_MAX_SIDE_PX): Pair<Int, Int> {
    val longest = maxOf(width, height)
    if (longest <= maxSide || longest <= 0) return width to height
    val scale = maxSide.toDouble() / longest
    return maxOf(1, Math.round(width * scale).toInt()) to maxOf(1, Math.round(height * scale).toInt())
}
