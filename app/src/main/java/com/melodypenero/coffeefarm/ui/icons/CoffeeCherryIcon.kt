package com.melodypenero.coffeefarm.ui.icons

import androidx.compose.material.icons.Icons
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Material's icon set (including material-icons-extended) has no fruit/berry icon at all, so
 * every coffee-cherry-specific spot in the app (harvest stats, the cherry scanner tile, the
 * classification result sheet) was falling back to [Icons.Default.Coffee] -- a brewed-coffee
 * cup, not the actual crop. This draws a minimalist paired-cherry silhouette (two round fruit +
 * a forked stem) at the same 24x24dp viewport Material icons use, so it drops into an
 * [androidx.compose.material3.Icon] anywhere Icons.Default.Coffee was used and tints the same way.
 */
private var _coffeeCherry: ImageVector? = null

val Icons.Filled.CoffeeCherry: ImageVector
    get() {
        _coffeeCherry?.let { return it }
        val kappa = 0.5523f
        val built = ImageVector.Builder(
            name = "Filled.CoffeeCherry",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // Forked stem: a single line from the top splitting toward each cherry.
            path(fill = SolidColor(Color.Black)) {
                moveTo(12.4f, 2.2f)
                curveTo(12.0f, 2.6f, 11.8f, 3.6f, 12.1f, 5.4f)
                lineTo(13.1f, 5.2f)
                curveTo(12.85f, 3.8f, 12.9f, 3.0f, 13.2f, 2.5f)
                close()

                moveTo(12.4f, 2.2f)
                curveTo(13.3f, 3.0f, 14.8f, 6.0f, 15.85f, 10.9f)
                lineTo(14.95f, 11.15f)
                curveTo(13.9f, 6.3f, 12.6f, 3.1f, 12.0f, 2.6f)
                close()

                moveTo(12.1f, 5.4f)
                curveTo(11.5f, 7.6f, 10.6f, 9.7f, 9.6f, 11.0f)
                lineTo(8.8f, 10.4f)
                curveTo(9.75f, 9.15f, 10.6f, 7.2f, 11.15f, 5.15f)
                close()
            }
            // Left cherry
            path(fill = SolidColor(Color.Black)) {
                circle(cx = 8.3f, cy = 15.2f, r = 4.6f, kappa = kappa)
            }
            // Right cherry
            path(fill = SolidColor(Color.Black)) {
                circle(cx = 15.6f, cy = 15.6f, r = 4.6f, kappa = kappa)
            }
        }.build()
        _coffeeCherry = built
        return built
    }

/** Draws a filled circle using the standard 4-cubic-Bezier approximation. */
private fun PathBuilder.circle(cx: Float, cy: Float, r: Float, kappa: Float) {
    val k = r * kappa
    moveTo(cx, cy - r)
    curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    close()
}
