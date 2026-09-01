package com.melodypenero.coffeefarm.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp

/** Cabinet Grotesk font family for display, headlines, and card titles. */
val CabinetGroteskFontFamily = FontFamily.SansSerif

/** Satoshi font family for body, UI labels, buttons, and tabular text. */
val SatoshiFontFamily = FontFamily.SansSerif

val Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 38.sp
    ),
    displayMedium = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 32.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 30.sp
    ),
    titleLarge = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 21.sp,
        lineHeight = 27.sp
    ),
    titleMedium = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 17.sp,
        lineHeight = 23.sp
    ),
    titleSmall = TextStyle(
        fontFamily = CabinetGroteskFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 15.sp,
        lineHeight = 20.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
    labelLarge = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelMedium = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
    labelSmall = TextStyle(
        fontFamily = SatoshiFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp
    )
)

fun scaledTypography(scale: Float): Typography {
    fun TextUnit.scaleBy(multiplier: Float): TextUnit {
        return if (this.isSpecified) (this.value * multiplier).sp else this
    }
    return Typography.copy(
        headlineSmall = Typography.headlineSmall.copy(
            fontSize = Typography.headlineSmall.fontSize.scaleBy(scale),
            lineHeight = Typography.headlineSmall.lineHeight.scaleBy(scale)
        ),
        titleLarge = Typography.titleLarge.copy(
            fontSize = Typography.titleLarge.fontSize.scaleBy(scale),
            lineHeight = Typography.titleLarge.lineHeight.scaleBy(scale)
        ),
        titleMedium = Typography.titleMedium.copy(
            fontSize = Typography.titleMedium.fontSize.scaleBy(scale),
            lineHeight = Typography.titleMedium.lineHeight.scaleBy(scale)
        ),
        bodyLarge = Typography.bodyLarge.copy(
            fontSize = Typography.bodyLarge.fontSize.scaleBy(scale),
            lineHeight = Typography.bodyLarge.lineHeight.scaleBy(scale)
        ),
        bodyMedium = Typography.bodyMedium.copy(
            fontSize = Typography.bodyMedium.fontSize.scaleBy(scale),
            lineHeight = Typography.bodyMedium.lineHeight.scaleBy(scale)
        ),
        labelLarge = Typography.labelLarge.copy(
            fontSize = Typography.labelLarge.fontSize.scaleBy(scale),
            lineHeight = Typography.labelLarge.lineHeight.scaleBy(scale)
        )
    )
}

