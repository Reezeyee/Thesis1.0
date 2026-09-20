package com.melodypenero.coffeefarm.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InputRulesTest {
    @Test
    fun phone_stripsEverythingButDigits_andCapsAt11() {
        assertEquals("09171234567", sanitizePhoneInput("09ab17-123 4567xyz99"))
        assertEquals("09171234567", sanitizePhoneInput("0917-123-4567"))
        assertEquals("09171234567", sanitizePhoneInput("+63 917 123 4567"))
        assertEquals("09171234567", sanitizePhoneInput("091712345678999"))
    }

    @Test
    fun phone_validOnlyWhenExactly11DigitsStartingWith09() {
        assertTrue(isValidPhone11("09171234567"))
        assertFalse(isValidPhone11("0917123456"))
        assertFalse(isValidPhone11("091712345678"))
        assertFalse(isValidPhone11("0917-1234567"))
        assertFalse(isValidPhone11("0917123456a"))
        assertFalse(isValidPhone11("12345678901"))
        assertFalse(isValidPhone11(""))
    }

    @Test
    fun name_allowsLettersNTildeAccentsSpacesHyphenApostrophePeriod() {
        listOf("Juan Dela Cruz", "Niño Peña", "Mary-Ann O'Brien", "José Ma. Santos Jr.", "Zoë Müller", "D’Angelo")
            .forEach { assertTrue("should accept $it", isValidPersonName(it)) }
    }

    @Test
    fun name_rejectsDigitsAndSymbols() {
        listOf("Juan2", "J0se", "Maria@Cruz", "Juan_Cruz", "123", "...", "---", "", "   ", "Cruz/Reyes")
            .forEach { assertFalse("should reject '$it'", isValidPersonName(it)) }
    }

    @Test
    fun name_sanitizeKeepsGoodCharsAndSqueezesSpaces() {
        assertEquals("Niño Peña", sanitizeNameInput("Ni2ño @Pe#ña!"))
        assertEquals("Mary-Ann O'Brien Jr.", sanitizeNameInput("Mary-Ann O'Brien Jr."))
        assertEquals("Juan Cruz", sanitizeNameInput("Juan    Cruz"))
        assertEquals("Juan Cruz", normalizeFieldValue(FieldKind.PERSON_NAME, "  Juan   Cruz  "))
    }
}
