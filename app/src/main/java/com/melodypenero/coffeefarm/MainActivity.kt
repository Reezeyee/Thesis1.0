package com.melodypenero.coffeefarm

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.melodypenero.coffeefarm.ui.CoffeeFarmApp
import com.melodypenero.coffeefarm.ui.theme.CoffeeFarmTheme

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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val prefs = remember {
                applicationContext.getSharedPreferences(
                    "coffee_farm_settings",
                    MODE_PRIVATE
                )
            }
            val defaultThemeMode = if (isSystemInDarkTheme()) ThemeModeCoffee else ThemeModeLightCoffee
            var themeMode by remember {
                mutableStateOf(
                    normalizeThemeMode(
                        raw = prefs.getString("theme_mode", defaultThemeMode),
                        defaultMode = defaultThemeMode
                    )
                )
            }
            var fontScaleMode by remember { mutableStateOf(prefs.getString("font_scale", "normal") ?: "normal") }

            DisposableEffect(prefs) {
                val listener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { changedPrefs, key ->
                    when (key) {
                        "theme_mode" -> {
                            themeMode = normalizeThemeMode(
                                raw = changedPrefs.getString("theme_mode", defaultThemeMode),
                                defaultMode = defaultThemeMode
                            )
                        }
                        "font_scale" -> {
                            fontScaleMode = changedPrefs.getString("font_scale", "normal") ?: "normal"
                        }
                    }
                }
                prefs.registerOnSharedPreferenceChangeListener(listener)
                onDispose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
            }

            val darkTheme = when (themeMode) {
                ThemeModeCoffee -> true
                ThemeModeLightCoffee -> false
                else -> defaultThemeMode == ThemeModeCoffee
            }
            val fontScale = when (fontScaleMode) {
                "small" -> 0.9f
                "large" -> 1.1f
                else -> 1.0f
            }

            CoffeeFarmTheme(
                darkTheme = darkTheme,
                fontScale = fontScale
            ) {
                CoffeeFarmApp()
            }
        }
    }
}
