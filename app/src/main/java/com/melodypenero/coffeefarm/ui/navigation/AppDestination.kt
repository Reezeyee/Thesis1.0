package com.melodypenero.coffeefarm.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.PrecisionManufacturing
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.ui.graphics.vector.ImageVector
import com.melodypenero.coffeefarm.ui.icons.CoffeeCherry

/** Mobile app routes — field tools only. Farm management and sales live on the web admin portal. */
sealed class AppDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : AppDestination("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object Cherry : AppDestination("cherry", "Cherry scanner", Icons.Default.CoffeeCherry)
    data object HarvestReadiness : AppDestination("harvest_readiness", "Harvest Reports", Icons.Default.AssignmentTurnedIn)
    data object PestDisease : AppDestination("pest_disease", "Pest & Disease", Icons.Default.BugReport)
    data object Equipment : AppDestination("equipment", "Equipment", Icons.Default.PrecisionManufacturing)
    data object Supplies : AppDestination("supplies", "Supplies", Icons.Default.Inventory2)
    data object Irrigation : AppDestination("irrigation", "Irrigation", Icons.Default.WaterDrop)
    /** Worker-only: clock in/out. HR and payroll are managed on the website. */
    data object StaffAttendance : AppDestination("staff_attendance", "My Attendance", Icons.Default.Schedule)
    /** Delivery Rider home: the buyer orders assigned to this rider, with map, address, and buyer contact. */
    data object RiderDeliveries : AppDestination("rider_deliveries", "My Deliveries", Icons.Default.LocalShipping)
    /** Maintenance home: the equipment / sprinkler repair jobs the admin assigned to this worker. */
    data object MaintenanceJobs : AppDestination("maintenance_jobs", "Repair Jobs", Icons.Default.Build)
    data object Sms : AppDestination("sms", "SMS Communication", Icons.Default.Forum)
    /** Buyer home: browse Admin-managed product listings, cart, checkout, and this buyer's own order history. */
    data object BuyerShop : AppDestination("buyer_shop", "Shop", Icons.Default.ShoppingCart)
    data object BuyerOrders : AppDestination("buyer_orders_screen", "My Orders", Icons.Default.ReceiptLong)
    data object Settings : AppDestination("settings", "Settings", Icons.Default.Settings)
}

/** Worker mobile drawer: attendance, CNN scanner, harvest reports, pest reports, equipment. */
val farmStaffMobileDestinations = listOf(
    AppDestination.Dashboard,
    AppDestination.StaffAttendance,
    AppDestination.Cherry,
    AppDestination.HarvestReadiness,
    AppDestination.PestDisease,
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
    AppDestination.HarvestReadiness,
    AppDestination.PestDisease,
    AppDestination.Equipment,
    AppDestination.Supplies,
    AppDestination.Irrigation,
    AppDestination.Sms,
    AppDestination.Settings
)

/** Delivery Rider drawer: their deliveries first, then attendance and messages. No farm field tools. */
val riderMobileDestinations = listOf(
    AppDestination.RiderDeliveries,
    AppDestination.StaffAttendance,
    AppDestination.Sms,
    AppDestination.Settings
)

/** Maintenance drawer: their repair jobs first, then attendance and messages. No farm field tools. */
val maintenanceMobileDestinations = listOf(
    AppDestination.MaintenanceJobs,
    AppDestination.StaffAttendance,
    AppDestination.Sms,
    AppDestination.Settings
)

/** Buyer drawer: shop the catalog, track their own orders. No farm field tools or internal comms. */
val buyerMobileDestinations = listOf(
    AppDestination.BuyerShop,
    AppDestination.BuyerOrders,
    AppDestination.Settings
)
