package com.melodypenero.coffeefarm.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

data class FarmPalette(
    val pageGradient: Brush,
    val surface: Color,
    val surfaceElevated: Color,
    val border: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val accent: Color,
    val accentContainer: Color,
    val onAccent: Color,
    val drawerSurface: Color,
    val drawerSelected: Color,
    val tabContainer: Color,
    val tabIndicator: Color,
)

@Composable
fun farmPalette(): FarmPalette {
    val cs = MaterialTheme.colorScheme
    val isDark = cs.background.luminance() < 0.5f
    return if (isDark) {
        FarmPalette(
            pageGradient = Brush.verticalGradient(
                listOf(Color(0xFF241710), Color(0xFF1A120D))
            ),
            surface = cs.surface,
            surfaceElevated = cs.surfaceVariant,
            border = cs.outline,
            textPrimary = cs.onSurface,
            textSecondary = cs.onSurfaceVariant,
            accent = cs.primary,
            accentContainer = cs.primaryContainer,
            onAccent = cs.onPrimary,
            drawerSurface = Color(0xFF2B1E16),
            drawerSelected = Color(0xFF3A4A2E),
            tabContainer = Color(0xFF1F140F),
            tabIndicator = cs.primary
        )
    } else {
        FarmPalette(
            pageGradient = Brush.verticalGradient(
                listOf(Color(0xFFFDFBF7), Color(0xFFF5F1ED))
            ),
            surface = Color(0xFFFFFFFF),
            surfaceElevated = cs.surface,
            border = cs.outline,
            textPrimary = cs.onBackground,
            textSecondary = cs.onSurfaceVariant,
            accent = cs.primary,
            accentContainer = cs.primaryContainer,
            onAccent = cs.onPrimary,
            drawerSurface = Color(0xFFFFFFFF),
            drawerSelected = Color(0xFFE8F0E4),
            tabContainer = Color(0xFFFFFFFF),
            tabIndicator = cs.primary
        )
    }
}

@Composable
fun FarmScreen(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    val palette = farmPalette()
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(palette.pageGradient)
            .padding(contentPadding),
        content = content
    )
}

@Composable
fun FarmLazyScreen(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp),
    content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit
) {
    val palette = farmPalette()
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(palette.pageGradient),
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement,
        content = content
    )
}

@Composable
fun FarmCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val palette = farmPalette()
    Card(
        modifier = modifier.then(
            if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
        ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = palette.surface),
        border = BorderStroke(1.dp, palette.border),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content
        )
    }
}

@Composable
fun FarmSectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null
) {
    val palette = farmPalette()
    Column(modifier = modifier.padding(vertical = 4.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = palette.textPrimary,
            fontWeight = FontWeight.SemiBold
        )
        if (!subtitle.isNullOrBlank()) {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = palette.textSecondary,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
fun FarmInfoBanner(text: String, modifier: Modifier = Modifier) {
    val palette = farmPalette()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.accentContainer)
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = palette.textPrimary
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FarmStatCard(
    title: String,
    value: String,
    icon: ImageVector,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val palette = farmPalette()
    FarmCard(
        modifier = modifier.fillMaxWidth(0.48f),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = palette.textSecondary
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.headlineSmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.accentContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(22.dp))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FarmModuleTile(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val palette = farmPalette()
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(0.48f),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = palette.surface),
        border = BorderStroke(1.dp, palette.border),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp, horizontal = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(palette.accentContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(26.dp))
            }
            Text(
                text = label,
                color = palette.textPrimary,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleSmall
            )
        }
    }
}

@Composable
fun FarmPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val palette = farmPalette()
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = palette.accent,
            contentColor = palette.onAccent,
            disabledContainerColor = palette.border,
            disabledContentColor = palette.textSecondary
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun FarmTabRow(
    tabs: List<String>,
    selectedTab: String,
    onTabSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val palette = farmPalette()
    val selectedIndex = tabs.indexOf(selectedTab).coerceAtLeast(0)
    ScrollableTabRow(
        selectedTabIndex = selectedIndex,
        modifier = modifier.fillMaxWidth(),
        edgePadding = 16.dp,
        containerColor = palette.tabContainer,
        contentColor = palette.textPrimary,
        divider = {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(palette.border)
            )
        },
        indicator = { tabPositions ->
            if (selectedIndex < tabPositions.size) {
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedIndex]),
                    color = palette.tabIndicator,
                    height = 3.dp
                )
            }
        }
    ) {
        tabs.forEach { tab ->
            val selected = tab == selectedTab
            Tab(
                selected = selected,
                onClick = { onTabSelected(tab) },
                text = {
                    Text(
                        tab,
                        color = if (selected) palette.accent else palette.textSecondary,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                        style = MaterialTheme.typography.titleSmall
                    )
                }
            )
        }
    }
}

@Composable
fun farmTextFieldColors() = run {
    val palette = farmPalette()
    val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    if (isDark) {
        OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color(0xFF3A2A21),
            unfocusedContainerColor = Color(0xFF3A2A21),
            focusedTextColor = palette.textPrimary,
            unfocusedTextColor = palette.textPrimary,
            focusedBorderColor = palette.accent,
            unfocusedBorderColor = palette.border,
            focusedLabelColor = palette.accent,
            unfocusedLabelColor = palette.textSecondary,
            cursorColor = palette.accent
        )
    } else {
        OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color(0xFFF5F1ED),
            unfocusedContainerColor = Color(0xFFF5F1ED),
            focusedTextColor = palette.textPrimary,
            unfocusedTextColor = palette.textPrimary,
            focusedBorderColor = palette.accent,
            unfocusedBorderColor = palette.border,
            focusedLabelColor = palette.accent,
            unfocusedLabelColor = palette.textSecondary,
            cursorColor = palette.accent
        )
    }
}
