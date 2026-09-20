package com.melodypenero.coffeefarm.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FarmFinanceRolesTest {
    @Test
    fun roleList_hasDeliveryRider_andNoOther() {
        assertEquals(
            listOf("Picker", "Maintenance", "Farm Manager", "Farm Assist", "Delivery Rider"),
            FarmFinance.WORKER_ROLES
        )
        assertFalse(FarmFinance.WORKER_ROLES.any { it.contains("other", ignoreCase = true) })
    }

    @Test
    fun everyRole_hasAPayRate() {
        FarmFinance.WORKER_ROLES.forEach { role ->
            assertTrue("$role needs a rate", FarmFinance.hourlyRateForWorkerRole(role) > 0.0)
        }
    }

    @Test
    fun deliveryRider_isPaid120PerHour_andAliasesMatch() {
        assertEquals(120.0, FarmFinance.hourlyRateForWorkerRole("Delivery Rider"), 0.0)
        assertEquals(120.0, FarmFinance.hourlyRateForWorkerRole("  delivery rider "), 0.0)
        assertEquals(120.0, FarmFinance.hourlyRateForWorkerRole("Driver"), 0.0)
    }

    @Test
    fun existingRates_areUnchanged() {
        assertEquals(50.0, FarmFinance.hourlyRateForWorkerRole("Picker"), 0.0)
        assertEquals(150.0, FarmFinance.hourlyRateForWorkerRole("Farm Assist"), 0.0)
        assertEquals(180.0, FarmFinance.hourlyRateForWorkerRole("Maintenance"), 0.0)
        assertEquals(250.0, FarmFinance.hourlyRateForWorkerRole("Farm Manager"), 0.0)
        assertEquals(0.0, FarmFinance.hourlyRateForWorkerRole("Something else"), 0.0)
    }
}
