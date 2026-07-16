package com.melodypenero.coffeefarm.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.PrecisionManufacturing
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.Forum
import androidx.compose.ui.graphics.vector.ImageVector

/** Mobile app routes — field tools only. Farm management and sales live on the web admin portal. */
sealed class AppDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : AppDestination("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object Cherry : AppDestination("cherry", "Cherry scanner", Icons.Default.Grass)
    data object HarvestReadiness : AppDestination("harvest_readiness", "Harvest Reports", Icons.Default.AssignmentTurnedIn)
    data object Equipment : AppDestination("equipment", "Equipment", Icons.Default.PrecisionManufacturing)
    data object Supplies : AppDestination("supplies", "Supplies", Icons.Default.Inventory2)
    data object Irrigation : AppDestination("irrigation", "Irrigation", Icons.Default.WaterDrop)
    /** Worker-only: clock in/out. HR and payroll are managed on the website. */
    data object StaffAttendance : AppDestination("staff_attendance", "My Attendance", Icons.Default.Schedule)
    data object Sms : AppDestination("sms", "SMS Communication", Icons.Default.Forum)
    data object Settings : AppDestination("settings", "Settings", Icons.Default.Settings)
}

/** Worker mobile drawer: attendance, CNN scanner, equipment. */
val farmStaffMobileDestinations = listOf(
    AppDestination.Dashboard,
    AppDestination.StaffAttendance,
    AppDestination.Cherry,
    AppDestination.HarvestReadiness,
    AppDestination.Equipment,
    AppDestination.Supplies,
    AppDestination.Irrigation,
    AppDestination.Sms,
    AppDestination.Settings
)

/** Admin mobile drawer: same field tools (no attendance); management on web. */
val administratorMobileDestinations = listOf(
    AppDestination.Dashboard,
    AppDestination.Cherry,
    AppDestination.Equipment,
    AppDestination.Supplies,
    AppDestination.Irrigation,
    AppDestination.Sms,
    AppDestination.Settings
)
