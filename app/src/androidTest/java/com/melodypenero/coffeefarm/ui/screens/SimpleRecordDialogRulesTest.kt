package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.melodypenero.coffeefarm.ui.theme.CoffeeFarmTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The Add Worker dialog on a real device: the shared phone (11 digits) and person-name rules. */
@RunWith(AndroidJUnit4::class)
class SimpleRecordDialogRulesTest {
    @get:Rule
    val rule = createComposeRule()

    private var saved: List<String>? = null

    private fun show() {
        rule.setContent {
            CoffeeFarmTheme {
                SimpleRecordDialog(
                    title = "Add Worker",
                    fields = listOf(
                        RecordField("Worker Name", kind = FieldKind.PERSON_NAME),
                        RecordField("Phone Number", kind = FieldKind.PHONE)
                    ),
                    onDismiss = {},
                    onSave = { saved = it }
                )
            }
        }
    }

    @Test
    fun typingLettersAndSymbolsIsCleanedAndGoodValuesSave() {
        show()
        val fields = rule.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("Ni2ño @Pe#ña")
        fields[1].performTextInput("09ab17-123 4567xyz99")
        rule.onNodeWithText("Niño Peña").assertExists()
        rule.onNodeWithText("09171234567").assertExists()
        rule.onNodeWithText("Save").assertIsEnabled().performClick()
        assertEquals(listOf("Niño Peña", "09171234567"), saved)
    }

    @Test
    fun shortPhoneShowsErrorAndBlocksSave() {
        show()
        val fields = rule.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("Juan Dela Cruz")
        fields[1].performTextInput("0917")
        rule.onNodeWithText(PHONE_ERROR_MESSAGE).assertExists()
        rule.onNodeWithText("Save").assertIsNotEnabled()
        assertNull(saved)
    }

    @Test
    fun pastedInternationalNumberBecomesLocalFormat() {
        show()
        val fields = rule.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("José Ma. Santos Jr.")
        fields[1].performTextInput("+63 917 123 4567")
        rule.onNodeWithText("09171234567").assertExists()
        rule.onNodeWithText("Save").assertIsEnabled()
    }

    @Test
    fun nameWithOnlyDigitsAndSymbolsIsEmptyAndBlocksSave() {
        show()
        val fields = rule.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("1234 !!!")
        fields[1].performTextInput("09171234567")
        rule.onNodeWithText("Save").assertIsNotEnabled()
    }
}
