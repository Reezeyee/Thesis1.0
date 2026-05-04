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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
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
import com.melodypenero.coffeefarm.ui.navigation.appDestinations
import com.melodypenero.coffeefarm.ui.screens.CoffeeCherryScreen
import com.melodypenero.coffeefarm.ui.screens.EquipmentScreen
import com.melodypenero.coffeefarm.ui.screens.FarmOperationsScreen
import com.melodypenero.coffeefarm.ui.screens.LoginScreen
import com.melodypenero.coffeefarm.ui.screens.ProfitScreen
import com.melodypenero.coffeefarm.ui.screens.SettingsScreen
import com.melodypenero.coffeefarm.ui.screens.StaffAttendanceScreen
import com.melodypenero.coffeefarm.ui.theme.Leaf700
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(colors = listOf(Color(0xFF241710), Color(0xFF140C08)))
                ),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                color = Leaf700
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
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF1E9E1) else Color(0xFF3E2723)
    val shellBackground = if (isDarkPalette) {
        Brush.verticalGradient(colors = listOf(Color(0xFF241710), Color(0xFF140C08)))
    } else {
        Brush.verticalGradient(colors = listOf(Color(0xFFF5F5F5), Color(0xFFF5F5F5)))
    }
    val drawerContainer = if (isDarkPalette) Color(0xFF2B1E16) else Color(0xFFF5F5F5)
    val drawerText = if (isDarkPalette) Color(0xFFF1E9E1) else Color(0xFF3E2723)
    val dateColor = if (isDarkPalette) Color(0xFFBFAF9F) else Color(0xFF5D4037)

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
                    drawerContainerColor = drawerContainer
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 20.dp)
                    ) {
                        Text(
                            text = "Coffee Farm",
                            color = Leaf700,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${currentSession.displayName} · ${roleLabel(currentSession.role)}",
                            color = dateColor,
                            style = MaterialTheme.typography.bodySmall
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
                                    color = if (selected) Leaf700 else drawerText,
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
                                    tint = if (selected) Leaf700 else drawerText
                                )
                            },
                            modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                            colors = NavigationDrawerItemDefaults.colors(
                                selectedContainerColor = if (isDarkPalette) Color(0xFF4A372B) else Color(0xFFE7DED7),
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
                    .background(shellBackground)
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
                                    color = titleColor,
                                    fontWeight = FontWeight.SemiBold
                                )
                            },
                            navigationIcon = {
                                IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                    Icon(
                                        Icons.Default.Menu,
                                        contentDescription = "Open navigation",
                                        tint = titleColor
                                    )
                                }
                            },
                            actions = {
                                Text(
                                    text = dateLabel,
                                    modifier = Modifier.padding(end = 12.dp),
                                    color = dateColor
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
                        composable(AppDestination.StaffAttendance.route) { StaffAttendanceScreen() }
                        composable(AppDestination.FarmOps.route) { FarmOperationsScreen() }
                        composable(AppDestination.Cherry.route) { CoffeeCherryScreen() }
                        composable(AppDestination.Equipment.route) { EquipmentScreen() }
                        composable(AppDestination.Profit.route) { ProfitScreen() }
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
 * DFD alignment: **Admin** — auth, user accounts, cherry management, equipment, sales (5.0), employees (6.0).
 * **Worker** — auth, scan cherry (2.0), view/store results (3.0), equipment info (4.0); no sales or HR modules.
 */
private fun destinationsForRole(role: UserRole): List<AppDestination> = when (role) {
    UserRole.ADMINISTRATOR -> appDestinations
    UserRole.FARM_STAFF -> listOf(
        AppDestination.Dashboard,
        AppDestination.StaffAttendance,
        AppDestination.Cherry,
        AppDestination.Equipment,
        AppDestination.Settings
    )
}

private fun roleLabel(role: UserRole): String = when (role) {
    UserRole.ADMINISTRATOR -> "Admin"
    UserRole.FARM_STAFF -> "Worker"
}
