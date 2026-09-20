package com.melodypenero.coffeefarm.ui.screens

import android.graphics.Bitmap
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melodypenero.coffeefarm.domain.MAX_FIX_NOTE_CHARS
import com.melodypenero.coffeefarm.domain.PartUsed
import com.melodypenero.coffeefarm.domain.RepairJob
import com.melodypenero.coffeefarm.domain.RepairKind
import com.melodypenero.coffeefarm.domain.RepairStatus
import com.melodypenero.coffeefarm.ui.theme.CoffeeFarmTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** The Maintenance worker's screen on a real phone, with sample jobs (no login, no Firebase). */
@RunWith(AndroidJUnit4::class)
class MaintenanceJobsScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private var started: RepairJob? = null
    private var fixedJob: RepairJob? = null
    private var fixedNote: String? = null
    private var fixedParts: List<PartUsed>? = null

    private fun job(
        id: String, kind: String = RepairKind.EQUIPMENT, title: String = "Tractor", subtitle: String = "Broken / wrecked",
        details: String = "Engine will not start", status: String = RepairStatus.ASSIGNED, fixNote: String = "",
        assignedAt: String = "2026-09-21T01:00:00Z"
    ) = RepairJob(
        jobId = id, kind = kind, reportId = "r-$id", title = title, subtitle = subtitle, details = details,
        reportedBy = "Pia Picker", reportedAt = "2026-09-20", assignedToName = "Miguel", assignedAt = assignedAt,
        status = status, startedAt = "", fixedAt = if (status == RepairStatus.FIXED) "2026-09-21T05:00:00Z" else "", fixNote = fixNote
    )

    private fun show(jobs: List<RepairJob>, loading: Boolean = false, error: String? = null) {
        rule.setContent {
            CoffeeFarmTheme {
                MaintenanceJobsContent(
                    workerName = "Miguel Mech", jobs = jobs, loading = loading, error = error,
                    onStart = { started = it }, onFixed = { j, n, p -> fixedJob = j; fixedNote = n; fixedParts = p }
                )
            }
        }
    }

    private fun screenshot(name: String) {
        val inst = InstrumentationRegistry.getInstrumentation()
        val bmp = inst.uiAutomation.takeScreenshot() ?: return
        val dir = File(inst.targetContext.getExternalFilesDir(null), "rider-test").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    fun showsWhichEquipmentIsBroken_andWhatWasReported() {
        show(listOf(job("j1")))
        rule.onNodeWithText("My Repair Jobs").assertIsDisplayed()
        rule.onNodeWithText("Hi Miguel — 1 to repair").assertIsDisplayed()
        rule.onNodeWithText("Tractor").assertIsDisplayed()
        rule.onNodeWithText("Equipment · Broken / wrecked").assertIsDisplayed()
        rule.onNodeWithText("What's wrong").assertIsDisplayed()
        rule.onNodeWithText("Engine will not start").assertIsDisplayed()
        rule.onNodeWithText("Reported by Pia Picker · 2026-09-20").assertIsDisplayed()
        rule.onNodeWithText("To do").assertIsDisplayed()
        screenshot("7-maintenance-job")
    }

    @Test
    fun aSprinklerJobSaysSprinklerAndTheZone() {
        show(listOf(job("s1", kind = RepairKind.SPRINKLER, title = "Sprinkler #12", subtitle = "Zone: Zone B", details = "Head is cracked")))
        rule.onNodeWithText("Sprinkler #12").assertIsDisplayed()
        rule.onNodeWithText("Sprinkler · Zone: Zone B").assertIsDisplayed()
        rule.onNodeWithText("Head is cracked").assertIsDisplayed()
    }

    @Test
    fun startRepair_reportsTheJob() {
        show(listOf(job("j2")))
        rule.onNodeWithText("Start repair").performScrollTo().performClick()
        assertEquals("j2", started?.jobId)
    }

    @Test
    fun markFixed_needsANote_thenSendsItWithThePartsUsed() {
        show(listOf(job("j3", status = RepairStatus.IN_PROGRESS)))
        rule.onNodeWithText("Repairing").assertIsDisplayed()
        rule.onNodeWithText("Mark fixed").performScrollTo().performClick()
        rule.onNodeWithText("Tell the admin what you did and which parts you used. They'll be notified right away.").assertIsDisplayed()
        rule.onNodeWithTag("confirm-fixed").assertIsNotEnabled()
        screenshot("8-fix-note-required")
        rule.onNodeWithTag("fix-note").performTextInput("   ")
        rule.onNodeWithTag("confirm-fixed").assertIsNotEnabled()          // spaces alone are not a note
        rule.onNodeWithTag("fix-note").performTextInput("Replaced the spark plug and tightened the housing.  ")
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled()             // parts are optional
        rule.onNodeWithTag("part-name-0").performTextInput("Screw")
        rule.onNodeWithTag("confirm-fixed").assertIsNotEnabled()          // a part with no quantity is unfinished
        rule.onNodeWithTag("part-qty-0").performTextInput("abc")          // letters are dropped
        rule.onNodeWithTag("confirm-fixed").assertIsNotEnabled()
        rule.onNodeWithTag("part-qty-0").performTextInput("4")
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled()
        rule.onNodeWithTag("add-part").performClick()
        rule.onNodeWithTag("part-name-1").performTextInput("Spark plug")
        rule.onNodeWithTag("part-qty-1").performTextInput("1")
        screenshot("9-fix-note-filled")
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled().performClick()
        assertEquals("j3", fixedJob?.jobId)
        assertEquals("Replaced the spark plug and tightened the housing.", fixedNote)   // trimmed
        assertEquals(listOf(PartUsed("Screw", 4.0), PartUsed("Spark plug", 1.0)), fixedParts)
    }

    @Test
    fun noPartsUsed_isFine_andSendsAnEmptyList() {
        show(listOf(job("j6", status = RepairStatus.IN_PROGRESS)))
        rule.onNodeWithText("Mark fixed").performScrollTo().performClick()
        rule.onNodeWithTag("fix-note").performTextInput("Tightened the loose hose clamp.")
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled().performClick()
        assertEquals(emptyList<PartUsed>(), fixedParts)
    }

    @Test
    fun aPartRowCanBeRemoved() {
        show(listOf(job("j7", status = RepairStatus.IN_PROGRESS)))
        rule.onNodeWithText("Mark fixed").performScrollTo().performClick()
        rule.onNodeWithTag("fix-note").performTextInput("Done")
        rule.onNodeWithTag("part-name-0").performTextInput("Screw")     // unfinished row blocks sending...
        rule.onNodeWithTag("confirm-fixed").assertIsNotEnabled()
        rule.onNodeWithTag("add-part").performClick()
        rule.onNodeWithTag("part-remove-0").performClick()              // ...until it is removed
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled()
    }

    @Test
    fun cancellingTheFixDialogSendsNothing() {
        show(listOf(job("j4", status = RepairStatus.IN_PROGRESS)))
        rule.onNodeWithText("Mark fixed").performScrollTo().performClick()
        rule.onNodeWithTag("fix-note").performTextInput("half written")
        rule.onNodeWithText("Not yet").performClick()
        assertNull(fixedJob)
        rule.onNodeWithText("Repairing").assertIsDisplayed()
    }

    @Test
    fun theNoteIsLimitedToWhatTheServerAccepts() {
        show(listOf(job("j5", status = RepairStatus.IN_PROGRESS)))
        rule.onNodeWithText("Mark fixed").performScrollTo().performClick()
        rule.onNodeWithTag("fix-note").performTextInput("x".repeat(MAX_FIX_NOTE_CHARS + 100))
        rule.onNodeWithText("$MAX_FIX_NOTE_CHARS / $MAX_FIX_NOTE_CHARS").assertExists()
        rule.onNodeWithTag("confirm-fixed").assertIsEnabled().performClick()
        assertEquals(MAX_FIX_NOTE_CHARS, fixedNote?.length)
    }

    @Test
    fun fixedJobsAreListedSeparately_showTheNote_andHaveNoButtons() {
        show(listOf(job("todo1", title = "Mower"), job("done1", title = "Pump", status = RepairStatus.FIXED, fixNote = "Changed the seal")))
        rule.onNodeWithText("To repair (1)").assertIsDisplayed()
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Fixed (1)"))
        rule.onNodeWithText("Fixed (1)").assertIsDisplayed()
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("You fixed it: Changed the seal"))
        rule.onNodeWithText("You fixed it: Changed the seal").assertExists()
        rule.onAllNodesWithText("Start repair").assertCountEquals(1)   // only the open job has an action
        rule.onAllNodesWithText("Mark fixed").assertCountEquals(0)
    }

    @Test
    fun emptyAndErrorStates() {
        show(emptyList())
        rule.onNodeWithText("No repair jobs").assertIsDisplayed()
        rule.onNodeWithText("Hi Miguel, nothing to repair right now.").assertIsDisplayed()
    }

    @Test
    fun errorBannerShows() {
        show(emptyList(), error = "Couldn't load your repair jobs. Check your connection and try again.")
        rule.onNodeWithText("Couldn't load your repair jobs. Check your connection and try again.").assertIsDisplayed()
    }
}
