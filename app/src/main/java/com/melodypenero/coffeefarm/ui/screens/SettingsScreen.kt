package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Storage
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import com.google.firebase.FirebaseApp
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.CloudSyncStatus
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private const val ThemeModeCoffee = "coffee"
private const val ThemeModeLightCoffee = "light_coffee"

private fun normalizeThemeMode(raw: String?, defaultMode: String): String {
    return when (raw) {
        ThemeModeCoffee,
        "dark" -> ThemeModeCoffee
        ThemeModeLightCoffee,
        "light" -> ThemeModeLightCoffee
        "system" -> defaultMode
        else -> defaultMode
    }
}

@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {}
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("coffee_farm_settings", android.content.Context.MODE_PRIVATE) }
    val defaultThemeMode = if (androidx.compose.foundation.isSystemInDarkTheme()) ThemeModeCoffee else ThemeModeLightCoffee

    val store = LocalAppStore.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val syncStatus by store.cloudSyncStatusState
    val lastSyncedAt by store.lastCloudSyncAtState
    val firebaseConfigured = FirebaseApp.getApps(context).isNotEmpty()

    var themeMode by remember {
        mutableStateOf(
            normalizeThemeMode(
                raw = prefs.getString("theme_mode", defaultThemeMode),
                defaultMode = defaultThemeMode
            )
        )
    }
    var fontScale by remember { mutableStateOf(prefs.getString("font_scale", "normal") ?: "normal") }
    var notificationsEnabled by remember { mutableStateOf(prefs.getBoolean("notifications_enabled", true)) }
    var harvestAlerts by remember { mutableStateOf(prefs.getBoolean("harvest_alerts", true)) }
    var maintenanceAlerts by remember { mutableStateOf(prefs.getBoolean("maintenance_alerts", true)) }
    var pinLockEnabled by remember { mutableStateOf(prefs.getBoolean("pin_lock_enabled", false)) }
    var mobileDataSync by remember { mutableStateOf(prefs.getBoolean("mobile_data_sync", true)) }
    var reminderTime by remember { mutableStateOf(prefs.getString("reminder_time", "07:00 AM") ?: "07:00 AM") }

    fun saveString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
    fun saveBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(key, value).apply()
    }
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) Color(0xFF1A120D) else Color(0xFFF5F5F5)
    val primaryText = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val secondaryText = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                text = "Settings",
                color = primaryText,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }
        item {
            Text(
                text = "Customize appearance, notifications, security, and sync behavior.",
                color = secondaryText,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        item {
            SettingsSectionCard(
                title = "Account",
                icon = Icons.Default.Person
            ) {
                Text(
                    text = "Manage your active session.",
                    color = secondaryText,
                    style = MaterialTheme.typography.bodySmall
                )
                Button(
                    onClick = onLogout,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF6A2C2C),
                        contentColor = Color(0xFFF4EDE6)
                    )
                ) {
                    Text("Log out")
                }
            }
        }

        if (isAdmin) {
            item {
                SettingsSectionCard(
                    title = "User accounts (DFD 1.1)",
                    icon = Icons.Default.Security
                ) {
                    Text(
                        text = "Admin accounts unlock Sales (Profit) and Workers & Operations. Worker accounts can use Dashboard, Coffee Cherry, Equipment, and Settings only—no sales or HR. Roles are stored in Firestore (`role`: ADMINISTRATOR or FARM_STAFF); known worker and admin emails always use the app’s fixed role.",
                        color = secondaryText,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        item {
            SettingsSectionCard(
                title = "Appearance",
                icon = Icons.Default.Palette
            ) {
                OptionRow(
                    label = "Theme mode",
                    options = listOf(ThemeModeCoffee, ThemeModeLightCoffee),
                    selected = themeMode,
                    optionLabel = {
                        when (it) {
                            ThemeModeCoffee -> "Coffee"
                            ThemeModeLightCoffee -> "Light Coffee"
                            else -> "Coffee"
                        }
                    },
                    onSelect = {
                        themeMode = it
                        saveString("theme_mode", it)
                    }
                )
                OptionRow(
                    label = "Font size",
                    options = listOf("small", "normal", "large"),
                    selected = fontScale,
                    optionLabel = { it.replaceFirstChar { c -> c.uppercase() } },
                    onSelect = {
                        fontScale = it
                        saveString("font_scale", it)
                    }
                )
            }
        }

        item {
            SettingsSectionCard(
                title = "Notifications",
                icon = Icons.Default.Notifications
            ) {
                SettingSwitchRow(
                    title = "Enable notifications",
                    subtitle = "Master switch for all farm alerts.",
                    checked = notificationsEnabled,
                    onCheckedChange = {
                        notificationsEnabled = it
                        saveBoolean("notifications_enabled", it)
                    }
                )
                SettingSwitchRow(
                    title = "Harvest alerts",
                    subtitle = "Get reminders for harvest and grading activity.",
                    checked = harvestAlerts,
                    enabled = notificationsEnabled,
                    onCheckedChange = {
                        harvestAlerts = it
                        saveBoolean("harvest_alerts", it)
                    }
                )
                SettingSwitchRow(
                    title = "Maintenance alerts",
                    subtitle = "Get reminders for equipment servicing.",
                    checked = maintenanceAlerts,
                    enabled = notificationsEnabled,
                    onCheckedChange = {
                        maintenanceAlerts = it
                        saveBoolean("maintenance_alerts", it)
                    }
                )
                OptionRow(
                    label = "Daily reminder time",
                    options = listOf("06:00 AM", "07:00 AM", "08:00 AM"),
                    selected = reminderTime,
                    optionLabel = { it },
                    onSelect = {
                        reminderTime = it
                        saveString("reminder_time", it)
                    }
                )
            }
        }

        item {
            SettingsSectionCard(
                title = "Security",
                icon = Icons.Default.Security
            ) {
                SettingSwitchRow(
                    title = "PIN lock",
                    subtitle = "Require PIN before opening management modules.",
                    checked = pinLockEnabled,
                    onCheckedChange = {
                        pinLockEnabled = it
                        saveBoolean("pin_lock_enabled", it)
                    }
                )
            }
        }

        item {
            SettingsSectionCard(
                title = "Data & Sync",
                icon = Icons.Default.Storage
            ) {
                FirebaseSyncCard(
                    syncStatus = syncStatus,
                    lastSyncedAt = lastSyncedAt,
                    firebaseConfigured = firebaseConfigured,
                    onSyncNow = { store.syncFirebaseNow() }
                )
                SettingSwitchRow(
                    title = "Sync using mobile data",
                    subtitle = "Allow cloud sync even without Wi-Fi.",
                    checked = mobileDataSync,
                    onCheckedChange = {
                        mobileDataSync = it
                        saveBoolean("mobile_data_sync", it)
                    }
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF84B626))
                    Text(
                        text = "Settings are saved locally on this device.",
                        color = secondaryText,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FirebaseSyncCard(
    syncStatus: CloudSyncStatus,
    lastSyncedAt: Long?,
    firebaseConfigured: Boolean,
    onSyncNow: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF3A2A21) else Color(0xFFF0EBE5)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFCFC2B9) else Color(0xFF7A6A5F)
    val statusLine = when (syncStatus) {
        CloudSyncStatus.CONNECTED -> "Connected to Firestore"
        CloudSyncStatus.SYNCING -> "Uploading data…"
        CloudSyncStatus.CONNECTING -> "Connecting…"
        CloudSyncStatus.PENDING_UPLOAD ->
            "Offline or server unreachable — data stays on this device; will upload when online"
        CloudSyncStatus.LOCAL_ONLY ->
            if (firebaseConfigured) "Cloud not reachable or Firebase failed to start"
            else "Firebase not configured in this build (missing google-services?)"
        CloudSyncStatus.ERROR -> "Upload failed — check network and Firestore rules"
    }
    val syncedText = lastSyncedAt?.let {
        val fmt = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault())
        "Last successful upload: ${fmt.format(Date(it))}"
    } ?: "Last successful upload: not yet (tap Sync now)"
    val busy = syncStatus == CloudSyncStatus.SYNCING || syncStatus == CloudSyncStatus.CONNECTING

    Card(
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Firebase",
                    color = titleColor,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = statusLine,
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    text = syncedText,
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            TextButton(
                onClick = onSyncNow,
                enabled = firebaseConfigured && !busy
            ) {
                Text(if (busy) "…" else "Sync now")
            }
        }
    }
}

@Composable
private fun SettingsSectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    Card(
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
                Text(
                    text = title,
                    color = titleColor,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
            content()
        }
    }
}

@Composable
private fun SettingSwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val disabledTitle = if (isDarkPalette) Color(0xFF7A6A5F) else Color(0xFF9A8D83)
    val disabledSubtitle = if (isDarkPalette) Color(0xFF6A5A50) else Color(0xFFB3A69C)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 8.dp)
        ) {
            Text(title, color = if (enabled) titleColor else disabledTitle, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = if (enabled) subtitleColor else disabledSubtitle, style = MaterialTheme.typography.bodySmall)
        }
        Switch(
            checked = checked,
            enabled = enabled,
            onCheckedChange = onCheckedChange
        )
    }
}

@Composable
private fun OptionRow(
    label: String,
    options: List<String>,
    selected: String,
    optionLabel: (String) -> String,
    onSelect: (String) -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val unselectedChip = if (isDarkPalette) Color(0xFF3A2A21) else Color(0xFFE9DFD6)
    val unselectedLabel = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF6D5A50)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = titleColor, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { option ->
                val isSelected = option == selected
                AssistChip(
                    onClick = { onSelect(option) },
                    label = { Text(optionLabel(option)) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = if (isSelected) Color(0xFF2E8B3C) else unselectedChip,
                        labelColor = if (isSelected) Color(0xFFF4EDE6) else unselectedLabel
                    ),
                    border = null
                )
            }
        }
    }
}
