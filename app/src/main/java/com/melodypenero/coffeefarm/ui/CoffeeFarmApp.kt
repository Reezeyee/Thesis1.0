package com.melodypenero.coffeefarm.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.auth.AuthManager
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.AppStore
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.dashboard.DashboardScreen
import com.melodypenero.coffeefarm.ui.navigation.AppDestination
import com.melodypenero.coffeefarm.ui.navigation.administratorMobileDestinations
import com.melodypenero.coffeefarm.ui.navigation.farmStaffMobileDestinations
import com.melodypenero.coffeefarm.ui.screens.CoffeeCherryScreen
import com.melodypenero.coffeefarm.ui.screens.EquipmentScreen
import com.melodypenero.coffeefarm.ui.screens.HarvestReadinessScreen
import com.melodypenero.coffeefarm.ui.screens.IrrigationScreen
import com.melodypenero.coffeefarm.ui.screens.LoginScreen
import com.melodypenero.coffeefarm.ui.screens.SettingsScreen
import com.melodypenero.coffeefarm.ui.screens.StaffAttendanceScreen
import com.melodypenero.coffeefarm.ui.screens.SuppliesScreen
import com.melodypenero.coffeefarm.ui.screens.SmsScreen
import com.melodypenero.coffeefarm.ui.components.farmPalette
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CoffeeFarmApp() {
    val context = LocalContext.current
    val store = remember { AppStore(context.applicationContext) }
    var session by remember { mutableStateOf<AuthSession?>(null) }
    var authReady by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            AuthManager.clearStaleSessionIfSignedOut(context)
            val restored = AuthManager.refreshSessionFromFirebase(context)
            withContext(Dispatchers.Main) {
                session = restored
                authReady = true
            }
        }
    }

    LaunchedEffect(session?.userId) {
        val s = session
        if (s != null) {
            store.setActiveUserId(s.userId)
            store.initializeIfNeeded()
        } else {
            store.setActiveUserId(null)
        }
    }

    if (!authReady) {
        val palette = farmPalette()
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(palette.pageGradient),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                color = palette.accent
            )
        }
        return
    }

    if (session == null) {
        LoginScreen(
            onAuthSuccess = { newSession ->
                session = newSession
            }
        )
        return
    }

    val currentSession = session ?: return
    val allowedDestinations = remember(currentSession.role) {
        destinationsForRole(currentSession.role)
    }

    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val dateLabel = remember {
        LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd", Locale.getDefault()))
    }
    val navigateToDestination: (AppDestination) -> Unit = { destination ->
        if (allowedDestinations.any { it.route == destination.route }) {
            navController.navigate(destination.route) {
                popUpTo(navController.graph.startDestinationId) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        } else {
            Toast.makeText(
                context,
                "Access denied: ${roleLabel(currentSession.role)} cannot open ${destination.title}.",
                Toast.LENGTH_SHORT
            ).show()
        }
    }
    val palette = farmPalette()

    LaunchedEffect(currentRoute, currentSession.role) {
        if (currentRoute != null && allowedDestinations.none { it.route == currentRoute }) {
            navController.navigate(AppDestination.Dashboard.route) {
                popUpTo(navController.graph.startDestinationId) {
                    inclusive = false
                }
                launchSingleTop = true
            }
        }
    }

    CompositionLocalProvider(
        LocalAppStore provides store,
        LocalUserRole provides currentSession.role
    ) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(
                    drawerContainerColor = palette.drawerSurface
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(palette.accentContainer)
                            .padding(horizontal = 20.dp, vertical = 24.dp)
                    ) {
                        Text(
                            text = "Acojido Farm",
                            color = palette.accent,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Field app",
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                        Text(
                            text = "${currentSession.displayName} · ${roleLabel(currentSession.role)}",
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                    allowedDestinations.forEach { destination ->
                        val selected = backStackEntry?.destination?.hierarchy?.any {
                            it.route == destination.route
                        } == true

                        NavigationDrawerItem(
                            label = {
                                Text(
                                    destination.title,
                                    color = if (selected) palette.accent else palette.textPrimary,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
                                )
                            },
                            selected = selected,
                            onClick = {
                                navigateToDestination(destination)
                                scope.launch { drawerState.close() }
                            },
                            icon = {
                                Icon(
                                    destination.icon,
                                    contentDescription = destination.title,
                                    tint = if (selected) palette.accent else palette.textSecondary
                                )
                            },
                            modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                            colors = NavigationDrawerItemDefaults.colors(
                                selectedContainerColor = palette.drawerSelected,
                                unselectedContainerColor = Color.Transparent
                            )
                        )
                    }
                }
            }
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(palette.pageGradient)
            ) {
                Scaffold(
                    containerColor = Color.Transparent,
                    modifier = Modifier.fillMaxSize(),
                    topBar = {
                        CenterAlignedTopAppBar(
                            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                                containerColor = Color.Transparent
                            ),
                            title = {
                                Text(
                                    text = allowedDestinations.firstOrNull { it.route == currentRoute }?.title
                                        ?: "Dashboard",
                                    color = palette.textPrimary,
                                    fontWeight = FontWeight.SemiBold
                                )
                            },
                            navigationIcon = {
                                IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                    Icon(
                                        Icons.Default.Menu,
                                        contentDescription = "Open navigation",
                                        tint = palette.textPrimary
                                    )
                                }
                            },
                            actions = {
                                Text(
                                    text = dateLabel,
                                    modifier = Modifier.padding(end = 12.dp),
                                    color = palette.textSecondary
                                )
                            }
                        )
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = AppDestination.Dashboard.route,
                        modifier = Modifier
                            .padding(innerPadding)
                            .padding(horizontal = 4.dp)
                    ) {
                        composable(AppDestination.Dashboard.route) {
                            DashboardScreen(
                                onNavigateToModule = navigateToDestination
                            )
                        }
                        composable(AppDestination.StaffAttendance.route) {
                            StaffAttendanceScreen(session = currentSession)
                        }
                        composable(AppDestination.Cherry.route) {
                            CoffeeCherryScreen(session = currentSession)
                        }
                        composable(AppDestination.HarvestReadiness.route) {
                            HarvestReadinessScreen(reporterDisplayName = currentSession.displayName)
                        }
                        composable(AppDestination.Equipment.route) {
                            EquipmentScreen(reporterDisplayName = currentSession.displayName)
                        }
                        composable(AppDestination.Supplies.route) {
                            SuppliesScreen(reporterDisplayName = currentSession.displayName)
                        }
                        composable(AppDestination.Irrigation.route) { IrrigationScreen() }
                        composable(AppDestination.Sms.route) {
                            SmsScreen(session = currentSession)
                        }
                        composable(AppDestination.Settings.route) {
                            SettingsScreen(
                                onLogout = {
                                    store.setActiveUserId(null)
                                    AuthManager.clearSession(context)
                                    session = null
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Mobile app focuses on CNN cherry scanning and worker field tools (attendance, irrigation, equipment, settings).
 * Workers & operations HR and sales/finance screens live on the `Website/` React admin portal for administrators.
 */
private fun destinationsForRole(role: UserRole): List<AppDestination> = when (role) {
    UserRole.ADMINISTRATOR -> administratorMobileDestinations
    UserRole.FARM_STAFF -> farmStaffMobileDestinations
}

private fun roleLabel(role: UserRole): String = when (role) {
    UserRole.ADMINISTRATOR -> "Admin"
    UserRole.FARM_STAFF -> "Worker"
}
