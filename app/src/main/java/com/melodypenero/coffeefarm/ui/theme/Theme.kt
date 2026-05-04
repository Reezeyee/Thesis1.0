package com.melodypenero.coffeefarm.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Leaf700,
    onPrimary = Cream50,
    secondary = Coffee700,
    onSecondary = Cream50,
    tertiary = Leaf500,
    background = Color(0xFFF5F5F5),
    surface = Color(0xFFF5F5F5),
    onSurface = Coffee900,
    surfaceVariant = Soil100
)

private val DarkColors = darkColorScheme(
    primary = Moss200,
    secondary = Coffee400,
    tertiary = Leaf500
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
        content = content
    )
}
