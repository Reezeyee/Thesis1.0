package com.melodypenero.coffeefarm.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliveryProofTest {
    @Test
    fun base64Length_matchesRealEncoding() {
        assertEquals(0, base64Length(0))
        assertEquals(4, base64Length(1))
        assertEquals(4, base64Length(3))
        assertEquals(8, base64Length(4))
        assertEquals(java.util.Base64.getEncoder().encodeToString(ByteArray(1000)).length, base64Length(1000))
        assertEquals(java.util.Base64.getEncoder().encodeToString(ByteArray(480_000)).length, base64Length(480_000))
    }

    @Test
    fun targetPhotoSizeAlwaysFitsUnderTheRulesLimit() {
        // The compressor aims for PROOF_MAX_JPEG_BYTES; that must always be accepted by firestore.rules (700,000 chars).
        assertTrue(proofFitsLimit(PROOF_MAX_JPEG_BYTES))
        assertTrue(proofFitsLimit(0))
    }

    @Test
    fun oversizedPhotosAreRejected() {
        assertFalse(proofFitsLimit(600_000))          // 600 KB of JPEG -> ~800,000 base64 chars > 700,000
        assertTrue(proofFitsLimit(520_000))           // ~693,000 chars: just under
        assertFalse(proofFitsLimit(525_000))          // ~700,000+ chars: just over
    }

    @Test
    fun dataUrlValidation_mirrorsTheRules() {
        assertTrue(isValidProofDataUrl(PROOF_DATA_URL_PREFIX + "AAAA"))
        assertFalse(isValidProofDataUrl("data:image/png;base64,AAAA"))
        assertFalse(isValidProofDataUrl("data:image/svg+xml;base64,AAAA"))
        assertFalse(isValidProofDataUrl("https://example.com/x.jpg"))
        assertFalse(isValidProofDataUrl(""))
        assertTrue(isValidProofDataUrl(PROOF_DATA_URL_PREFIX + "A".repeat(PROOF_MAX_DATA_URL_CHARS - PROOF_DATA_URL_PREFIX.length)))
        assertFalse(isValidProofDataUrl(PROOF_DATA_URL_PREFIX + "A".repeat(PROOF_MAX_DATA_URL_CHARS)))
    }

    @Test
    fun fitWithin_keepsAspectRatioAndNeverScalesUp() {
        assertEquals(1280 to 960, fitWithin(4000, 3000))
        assertEquals(960 to 1280, fitWithin(3000, 4000))
        assertEquals(1280 to 1280, fitWithin(5000, 5000))
        assertEquals(800 to 600, fitWithin(800, 600))          // already small: unchanged
        assertEquals(1280 to 1, fitWithin(20_000, 1))          // never collapses to 0
    }

    @Test
    fun riderOrder_readsTheProofFlag() {
        val base = mapOf<String, Any?>("buyerName" to "A", "totalAmount" to 10L)
        assertFalse(parseRiderOrder("x", base).hasDeliveryProof)
        assertTrue(parseRiderOrder("x", base + ("hasDeliveryProof" to true)).hasDeliveryProof)
        assertFalse(parseRiderOrder("x", base + ("hasDeliveryProof" to "yes")).hasDeliveryProof)
    }
}
