package com.melodypenero.coffeefarm.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Agriculture
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.PrecisionManufacturing
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class AppDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : AppDestination("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object FarmOps : AppDestination("farm_ops", "Workers & Operations", Icons.Default.Agriculture)
    data object Cherry : AppDestination("cherry", "Coffee Cherry", Icons.Default.Grass)
    data object Equipment : AppDestination(
        "equipment",
        "Equipment",
        Icons.Default.PrecisionManufacturing
    )
    data object Profit : AppDestination("profit", "Sales Management", Icons.Default.AttachMoney)
    /** Worker-only: log clock in/out (mirrored under admin Farm Ops → Attendance). */
    data object StaffAttendance : AppDestination("staff_attendance", "My Attendance", Icons.Default.Schedule)
    data object Settings : AppDestination("settings", "Settings", Icons.Default.Settings)
}

val appDestinations = listOf(
    AppDestination.Dashboard,
    AppDestination.FarmOps,
    AppDestination.Cherry,
    AppDestination.Equipment,
    AppDestination.Profit,
    AppDestination.Settings
)
