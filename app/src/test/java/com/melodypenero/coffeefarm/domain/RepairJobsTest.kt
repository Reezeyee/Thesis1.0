package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.WorkerRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RepairJobsTest {
    private val full = mapOf<String, Any?>(
        "kind" to "sprinkler", "reportId" to "S1", "title" to "Sprinkler #12", "subtitle" to "Zone: Zone B",
        "details" to "Head is cracked", "reportedBy" to "Pia", "reportedAt" to "2026-09-20",
        "assignedToName" to "Miguel", "assignedAt" to "2026-09-21T01:00:00Z", "status" to "assigned"
    )

    @Test
    fun parse_readsEverythingTheWorkerNeeds() {
        val j = parseRepairJob("sprinkler-S1", full)
        assertEquals("Sprinkler #12", j.title)
        assertEquals("Zone: Zone B", j.subtitle)
        assertEquals("Head is cracked", j.details)
        assertEquals("Pia", j.reportedBy)
        assertEquals("Sprinkler", j.kindLabel)
        assertFalse(j.isFixed)
    }

    @Test
    fun parse_toleratesMissingFields() {
        val j = parseRepairJob("x", emptyMap())
        assertEquals("Repair job", j.title)
        assertEquals(RepairStatus.ASSIGNED, j.status)
        assertEquals("Equipment", j.kindLabel)
        assertEquals("", j.fixNote)
    }

    @Test
    fun sort_startedFirst_thenOldestAssignment_thenFixedNewestFirst() {
        fun job(id: String, status: String, assigned: String, fixed: String = "") =
            parseRepairJob(id, full + mapOf("status" to status, "assignedAt" to assigned, "fixedAt" to fixed))
        val a = job("a", "assigned", "2026-09-21T03:00:00Z")
        val b = job("b", "assigned", "2026-09-21T01:00:00Z")
        val c = job("c", "in_progress", "2026-09-21T05:00:00Z")
        val d = job("d", "fixed", "2026-09-20T01:00:00Z", fixed = "2026-09-21T06:00:00Z")
        val e = job("e", "fixed", "2026-09-19T01:00:00Z", fixed = "2026-09-21T09:00:00Z")
        assertEquals(listOf("c", "b", "a", "e", "d"), sortRepairJobs(listOf(a, b, c, d, e)).map { it.jobId })
    }

    @Test
    fun fixNote_needsAtLeastOneCharacter_andNoMoreThan500() {
        assertTrue(isValidFixNote("Replaced the nozzle"))
        assertTrue(isValidFixNote("  ok  "))
        assertFalse(isValidFixNote(""))
        assertFalse(isValidFixNote("     "))
        assertTrue(isValidFixNote("a".repeat(MAX_FIX_NOTE_CHARS)))
        assertFalse(isValidFixNote("a".repeat(MAX_FIX_NOTE_CHARS + 1)))
    }

    @Test
    fun partQuantity_keepsOnlyDigitsAndOneDecimalPoint_withTwoDecimals() {
        assertEquals("1250.50", sanitizePartQuantity("₱1,250.505"))
        assertEquals("", sanitizePartQuantity("abc"))
        assertEquals("12.5", sanitizePartQuantity("1a2.5"))
        assertEquals("1.23", sanitizePartQuantity("1.2.3"))
        assertEquals("123456", sanitizePartQuantity("1234567"))
        assertEquals("5", sanitizePartQuantity("-5"))
    }

    @Test
    fun partQuantity_mustBeMoreThanZero_andNotAbsurd() {
        assertEquals(4.0, parsePartQuantity("4")!!, 0.0)
        assertEquals(0.5, parsePartQuantity(" 0.5 ")!!, 0.0)
        assertNull(parsePartQuantity("0"))
        assertNull(parsePartQuantity("0.00"))
        assertNull(parsePartQuantity(""))
        assertNull(parsePartQuantity("."))
        assertNull(parsePartQuantity("100000.01"))
    }

    @Test
    fun partsUsed_blankRowsAreIgnored_incompleteRowsBlockSending() {
        assertEquals(emptyList<PartUsed>(), parsePartsUsed(listOf("" to "")))          // no parts is fine
        assertEquals(listOf(PartUsed("Screw", 4.0)), parsePartsUsed(listOf("  Screw " to "4", "" to "")))
        assertEquals(listOf(PartUsed("Hose clamp", 2.0)), parsePartsUsed(listOf("Hose   clamp" to "2")))   // spaces collapsed
        assertNull(parsePartsUsed(listOf("Screw" to "")))                   // name without a quantity
        assertNull(parsePartsUsed(listOf("" to "3")))                       // quantity without a name
        assertNull(parsePartsUsed(listOf("Screw" to "0")))
        assertNull(parsePartsUsed(listOf("x".repeat(MAX_PART_NAME_CHARS + 1) to "1")))
        assertNull(parsePartsUsed(List(MAX_PARTS_PER_JOB + 1) { "Screw$it" to "1" }))
        assertEquals(MAX_PARTS_PER_JOB, parsePartsUsed(List(MAX_PARTS_PER_JOB) { "Screw$it" to "1" })!!.size)
    }

    @Test
    fun partsSummary_readsNaturally() {
        assertEquals("4 × Screw, 0.5 × Tape", partsSummary(listOf(PartUsed("Screw", 4.0), PartUsed("Tape", 0.5))))
    }

    @Test
    fun parse_readsThePartsUsed_ignoringJunkEntries() {
        val j = parseRepairJob("a", full + mapOf("partsUsed" to listOf(
            mapOf("name" to "Screw", "quantity" to 4L), mapOf("name" to "", "quantity" to 2L), mapOf("name" to "Nozzle", "quantity" to -1L), "junk"
        )))
        assertEquals(listOf(PartUsed("Screw", 4.0)), j.partsUsed)
        assertEquals(emptyList<PartUsed>(), parseRepairJob("a", full).partsUsed)
    }

    @Test
    fun maintenanceRole_isDetected() {
        assertTrue(FarmFinance.isMaintenanceRole("Maintenance"))
        assertTrue(FarmFinance.isMaintenanceRole("  maintenance crew "))
        assertFalse(FarmFinance.isMaintenanceRole("Picker"))
        assertFalse(FarmFinance.isMaintenanceRole("Farm Manager"))
        assertFalse(FarmFinance.isMaintenanceRole("Farm Assist"))
    }

    @Test
    fun maintenanceRecognition_byUidOrEmail_onlyForActiveMaintenanceWorkers() {
        val m = WorkerRecord(name = "Miguel", roleRate = "Maintenance", authUid = "uid-m", accountEmail = "miguel@acojidofarm.local")
        val picker = WorkerRecord(name = "Pia", roleRate = "Picker", authUid = "uid-p", accountEmail = "pia@acojidofarm.local")
        val manager = WorkerRecord(name = "Rico", roleRate = "Farm Manager", authUid = "uid-r", accountEmail = "rico@acojidofarm.local")
        val off = WorkerRecord(name = "Old", roleRate = "Maintenance", authUid = "uid-o", accountEmail = "old@acojidofarm.local", details = "{\"status\":\"inactive\"}")
        val all = listOf(picker, manager, m, off)
        assertEquals("Miguel", findMaintenanceWorker("uid-m", "x@y.com", all)?.name)
        assertEquals("Miguel", findMaintenanceWorker("other", "MIGUEL@acojidofarm.local", all)?.name)
        assertNull(findMaintenanceWorker("uid-p", "pia@acojidofarm.local", all))   // picker
        assertNull(findMaintenanceWorker("uid-r", "rico@acojidofarm.local", all))  // farm manager is not maintenance
        assertNull(findMaintenanceWorker("uid-o", "old@acojidofarm.local", all))   // inactive
        assertNull(findMaintenanceWorker("", "", listOf(WorkerRecord(name = "NoLogin", roleRate = "Maintenance"))))
    }
}
