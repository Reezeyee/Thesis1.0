package com.melodypenero.coffeefarm.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Forest,
    onPrimary = Cream,
    primaryContainer = Color(0xFFE8F0E4),
    onPrimaryContainer = Forest,
    secondary = Espresso,
    onSecondary = Cream,
    secondaryContainer = CreamMuted,
    onSecondaryContainer = Espresso,
    tertiary = Bark,
    onTertiary = Cream,
    background = Cream,
    onBackground = Espresso,
    surface = CreamMuted,
    onSurface = Espresso,
    surfaceVariant = Color(0xFFEDE6DF),
    onSurfaceVariant = MutedText,
    outline = Color(0xFFD9CEC3),
    outlineVariant = Color(0xFFE8E0D8),
    error = ErrorSoft,
    onError = Cream
)

private val DarkColors = darkColorScheme(
    primary = AccentGreenBright,
    onPrimary = DarkBg,
    primaryContainer = Color(0xFF2A4A1E),
    onPrimaryContainer = Color(0xFFB8E0A8),
    secondary = Color(0xFFD4A574),
    onSecondary = DarkBg,
    secondaryContainer = DarkSurfaceElevated,
    onSecondaryContainer = DarkText,
    tertiary = Bark,
    onTertiary = DarkText,
    background = DarkBg,
    onBackground = DarkText,
    surface = DarkSurface,
    onSurface = DarkText,
    surfaceVariant = DarkSurfaceElevated,
    onSurfaceVariant = DarkTextMuted,
    outline = DarkBorder,
    outlineVariant = Color(0xFF4A372B),
    error = ErrorSoft,
    onError = Cream
)

private val FarmShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(24.dp)
)

@Composable
fun CoffeeFarmTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    fontScale: Float = 1f,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = scaledTypography(fontScale.coerceIn(0.85f, 1.25f)),
        shapes = FarmShapes,
        content = content
    )
}
