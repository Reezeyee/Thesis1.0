package com.melodypenero.coffeefarm.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.melodypenero.coffeefarm.data.store.CoffeeFieldRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette

private const val DEFAULT_LAT = 14.5394408
private const val DEFAULT_LNG = 120.5763727

enum class MapViewMode { NATIVE_GRID, ONLINE_GIS }

@Composable
fun FarmMapScreen() {
    val palette = farmPalette()
    val store = LocalAppStore.current
    val state by store.appState
    val fields = state.coffeeFields
    var selectedField by remember { mutableStateOf<CoffeeFieldRecord?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var mapMode by remember { mutableStateOf(MapViewMode.ONLINE_GIS) }

    FarmLazyScreen(
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Screen Title
        item {
            FarmSectionTitle(
                title = "Farm Section Map",
                subtitle = "Visual guide of coffee fields & sections added by admin."
            )
        }

        // Stats Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MapStatBadge(
                    label = "Total Fields",
                    value = "${fields.size}",
                    icon = Icons.Default.Map,
                    modifier = Modifier.weight(1f)
                )
                MapStatBadge(
                    label = "Mapped Pins",
                    value = "${fields.size}",
                    icon = Icons.Default.PinDrop,
                    modifier = Modifier.weight(1f)
                )
                MapStatBadge(
                    label = "Total Trees",
                    value = "${fields.sumOf { it.trees }}",
                    icon = Icons.Default.Grass,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Mode Switcher Controls
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.surfaceElevated)
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { mapMode = MapViewMode.ONLINE_GIS },
                    shape = RoundedCornerShape(10.dp),
                    color = if (mapMode == MapViewMode.ONLINE_GIS) palette.accent else Color.Transparent
                ) {
                    Text(
                        text = "🛰️ Interactive GIS Map",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (mapMode == MapViewMode.ONLINE_GIS) palette.onAccent else palette.textSecondary,
                        modifier = Modifier.padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }

                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { mapMode = MapViewMode.NATIVE_GRID },
                    shape = RoundedCornerShape(10.dp),
                    color = if (mapMode == MapViewMode.NATIVE_GRID) palette.accent else Color.Transparent
                ) {
                    Text(
                        text = "🌱 Plantation Section Grid",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (mapMode == MapViewMode.NATIVE_GRID) palette.onAccent else palette.textSecondary,
                        modifier = Modifier.padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        }

        // Interactive Map View Container
        item {
            FarmCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FarmSectionTitle(
                            title = if (mapMode == MapViewMode.ONLINE_GIS) "Interactive Satellite & Street Map" else "Bataan Plantation Layout Grid",
                            subtitle = "Tap section plots or click field cards below to inspect details"
                        )
                        if (mapMode == MapViewMode.ONLINE_GIS) {
                            IconButton(
                                onClick = { webViewInstance?.reload() },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Reload map",
                                    tint = palette.textSecondary
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(350.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                            .background(palette.surfaceElevated)
                    ) {
                        if (mapMode == MapViewMode.NATIVE_GRID) {
                            NativeFarmMapView(
                                fields = fields,
                                selectedField = selectedField,
                                onFieldSelected = { selectedField = it }
                            )
                        } else {
                            InteractiveLeafletMapView(
                                fields = fields,
                                onWebViewCreated = { webViewInstance = it }
                            )
                        }
                    }
                }
            }
        }

        // List Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Coffee Field Sections (${fields.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = palette.textPrimary
                )
                Text(
                    text = "Added by Admin",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary
                )
            }
        }

        // Fallback list if empty
        if (fields.isEmpty()) {
            item {
                FarmCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Place,
                            contentDescription = null,
                            tint = palette.textSecondary,
                            modifier = Modifier.size(40.dp)
                        )
                        Text(
                            text = "No coffee fields mapped yet",
                            style = MaterialTheme.typography.titleSmall,
                            color = palette.textPrimary
                        )
                        Text(
                            text = "Fields added by admin on the website will instantly appear here on the map.",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                    }
                }
            }
        } else {
            itemsIndexed(items = fields) { index, field ->
                val effectiveLat = field.lat ?: (DEFAULT_LAT + (index % 3) * 0.008 - 0.004)
                val effectiveLng = field.lng ?: (DEFAULT_LNG + (index / 3) * 0.008 - 0.004)

                CoffeeFieldCardItem(
                    field = field,
                    effectiveLat = effectiveLat,
                    effectiveLng = effectiveLng,
                    isSelected = selectedField?.fieldId == field.fieldId,
                    onSelect = {
                        selectedField = field
                        if (mapMode == MapViewMode.ONLINE_GIS) {
                            webViewInstance?.evaluateJavascript(
                                "if (window.panToLoc) { window.panToLoc($effectiveLat, $effectiveLng); }",
                                null
                            )
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun NativeFarmMapView(
    fields: List<CoffeeFieldRecord>,
    selectedField: CoffeeFieldRecord?,
    onFieldSelected: (CoffeeFieldRecord) -> Unit
) {
    var scale by remember { mutableStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val textMeasurer = rememberTextMeasurer()

    Box(modifier = Modifier.fillMaxSize()) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        scale = (scale * zoom).coerceIn(0.8f, 3f)
                        offset += pan
                    }
                }
                .pointerInput(fields) {
                    detectTapGestures { tapOffset ->
                        // Determine which plot section was tapped
                        val size = this.size
                        val cols = 2
                        val rows = ((fields.size + 1) / cols).coerceAtLeast(1)
                        val cellW = size.width / cols
                        val cellH = size.height / rows

                        val transformedTap = (tapOffset - offset) / scale

                        fields.forEachIndexed { index, field ->
                            val col = index % cols
                            val row = index / cols
                            val left = col * cellW + 16f
                            val top = row * cellH + 16f
                            val right = left + cellW - 32f
                            val bottom = top + cellH - 32f

                            if (transformedTap.x in left..right && transformedTap.y in top..bottom) {
                                onFieldSelected(field)
                            }
                        }
                    }
                }
        ) {
            // Draw Ground Background
            drawRect(Color(0xFF233B18))

            // Grid Mesh
            val gridStep = 40f * scale
            var x = offset.x % gridStep
            while (x < size.width) {
                drawLine(
                    color = Color(0xFF335422),
                    start = Offset(x, 0f),
                    end = Offset(x, size.height),
                    strokeWidth = 1f
                )
                x += gridStep
            }
            var y = offset.y % gridStep
            while (y < size.height) {
                drawLine(
                    color = Color(0xFF335422),
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1f
                )
                y += gridStep
            }

            // Render Coffee Plantation Plots
            val cols = 2
            val rows = ((fields.size + 1) / cols).coerceAtLeast(1)
            val cellW = (size.width / cols)
            val cellH = (size.height / rows)

            fields.forEachIndexed { index, field ->
                val col = index % cols
                val row = index / cols

                val isSelected = selectedField?.fieldId == field.fieldId

                val plotLeft = (col * cellW + 14f) * scale + offset.x
                val plotTop = (row * cellH + 14f) * scale + offset.y
                val plotWidth = (cellW - 28f) * scale
                val plotHeight = (cellH - 28f) * scale

                val fillColor = if (isSelected) Color(0xFF4A7C28) else Color(0xFF2E4D1D)
                val strokeColor = if (isSelected) Color(0xFF7CFC00) else Color(0xFF5B8A3C)

                // Draw Plot Boundary Rectangle
                drawRoundRect(
                    color = fillColor,
                    topLeft = Offset(plotLeft, plotTop),
                    size = Size(plotWidth, plotHeight),
                    cornerRadius = CornerRadius(14f * scale)
                )

                drawRoundRect(
                    color = strokeColor,
                    topLeft = Offset(plotLeft, plotTop),
                    size = Size(plotWidth, plotHeight),
                    cornerRadius = CornerRadius(14f * scale),
                    style = Stroke(width = if (isSelected) 3f * scale else 1.5f * scale)
                )

                // Draw Plot Header & Title
                val titleText = field.name.ifBlank { "Section ${index + 1}" }
                val subText = "${field.area.ifBlank { "2.5 ha" }} • ${field.trees} trees"

                drawText(
                    textMeasurer = textMeasurer,
                    text = "🌱 $titleText",
                    topLeft = Offset(plotLeft + 12f * scale, plotTop + 10f * scale),
                    style = TextStyle(
                        color = Color.White,
                        fontSize = (12f * scale).coerceAtMost(16f).sp,
                        fontWeight = FontWeight.Bold
                    )
                )

                drawText(
                    textMeasurer = textMeasurer,
                    text = subText,
                    topLeft = Offset(plotLeft + 12f * scale, plotTop + 28f * scale),
                    style = TextStyle(
                        color = Color(0xFFB8E994),
                        fontSize = (10f * scale).coerceAtMost(13f).sp
                    )
                )

                // Draw Pin & Status
                drawCircle(
                    color = if (isSelected) Color(0xFF7CFC00) else Color(0xFF3867D6),
                    radius = 5f * scale,
                    center = Offset(plotLeft + plotWidth - 16f * scale, plotTop + 18f * scale)
                )
            }
        }

        // Map Overlay Controls (Zoom In, Zoom Out, Center)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FloatingMapButton(
                icon = Icons.Default.Add,
                contentDescription = "Zoom In",
                onClick = { scale = (scale + 0.3f).coerceAtMost(3f) }
            )
            FloatingMapButton(
                icon = Icons.Default.Remove,
                contentDescription = "Zoom Out",
                onClick = { scale = (scale - 0.3f).coerceAtLeast(0.8f) }
            )
            FloatingMapButton(
                icon = Icons.Default.CenterFocusStrong,
                contentDescription = "Reset Zoom",
                onClick = {
                    scale = 1f
                    offset = Offset.Zero
                }
            )
        }

        // Overlay Banner Instructions
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(10.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black.copy(alpha = 0.65f))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(
                text = if (selectedField != null) "Selected: ${selectedField.name}" else "Tap plot section or pinch to zoom",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun FloatingMapButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = Color(0xFF2D5016),
        contentColor = Color.White,
        shadowElevation = 4.dp,
        modifier = Modifier.size(36.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun MapStatBadge(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    val palette = farmPalette()
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = palette.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, palette.border)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = palette.accent,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textSecondary
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = palette.textPrimary
            )
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun InteractiveLeafletMapView(
    fields: List<CoffeeFieldRecord>,
    onWebViewCreated: (WebView) -> Unit
) {
    val htmlContent = remember(fields) { buildLeafletHtml(fields) }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        view?.evaluateJavascript("if (window.refreshMapSize) { window.refreshMapSize(); }", null)
                    }
                }
                webChromeClient = object : android.webkit.WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                        android.util.Log.d("FarmMapWebView", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()}")
                        return true
                    }
                }
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                }
                loadDataWithBaseURL(
                    "https://cdnjs.cloudflare.com",
                    htmlContent,
                    "text/html",
                    "UTF-8",
                    null
                )
                onWebViewCreated(this)
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL(
                "https://cdnjs.cloudflare.com",
                htmlContent,
                "text/html",
                "UTF-8",
                null
            )
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
private fun CoffeeFieldCardItem(
    field: CoffeeFieldRecord,
    effectiveLat: Double,
    effectiveLng: Double,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    val palette = farmPalette()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelect() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) palette.accent.copy(alpha = 0.15f) else palette.surface
        ),
        border = androidx.compose.foundation.BorderStroke(
            if (isSelected) 2.dp else 1.dp,
            if (isSelected) palette.accent else palette.border
        )
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(palette.accent.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🌱", fontSize = 18.sp)
                    }
                    Column {
                        Text(
                            text = field.name.ifBlank { "Coffee Field Plot" },
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = palette.textPrimary
                        )
                        Text(
                            text = "${field.area.ifBlank { "Unspecified area" }} • ${field.trees} trees",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                    }
                }

                StatusBadge(status = field.status)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = palette.accent,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = String.format("%.5f, %.5f", effectiveLat, effectiveLng),
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textSecondary
                    )
                }

                Text(
                    text = "Tap to focus map plot",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = palette.accent
                )
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (bgColor, textColor, label) = when (status.lowercase()) {
        "excellent" -> Triple(Color(0xFF2D5016), Color.White, "Excellent")
        "healthy" -> Triple(Color(0xFF4A2C2A), Color.White, "Healthy")
        "monitoring" -> Triple(Color(0xFFD4A574), Color.White, "Monitoring")
        else -> Triple(Color(0xFF2D5016), Color.White, status.ifBlank { "Active" })
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

private fun buildLeafletHtml(fields: List<CoffeeFieldRecord>): String {
    val markersJson = fields.mapIndexed { idx, f ->
        val lat = f.lat ?: (DEFAULT_LAT + (idx % 3) * 0.008 - 0.004)
        val lng = f.lng ?: (DEFAULT_LNG + (idx / 3) * 0.008 - 0.004)
        """
        {
          id: ${idx + 1},
          name: ${jsonEscape(f.name.ifBlank { "Coffee Field Section ${idx + 1}" })},
          area: ${jsonEscape(f.area.ifBlank { "2.5 ha" })},
          trees: ${f.trees},
          variety: ${jsonEscape(f.variety.ifBlank { "Arabica / Robusta" })},
          status: ${jsonEscape(f.status.ifBlank { "Healthy" })},
          lat: $lat,
          lng: $lng
        }
        """.trimIndent()
    }.joinToString(",\n")

    return """
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
      <style>
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        #map-container { position: relative; width: 100%; height: 100%; background: #e4e8ec; }
        #leaflet-map { position: absolute; inset: 0; z-index: 1; }
        #vector-fallback {
          position: absolute; inset: 0; z-index: 2; background: #1c2b18; color: #ffffff;
          display: flex; flex-direction: column; padding: 12px; overflow-y: auto;
        }
        .custom-pin {
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          background: #2d5016; border: 2px solid #ffffff; border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-size: 16px; color: #ffffff;
        }
        .leaflet-popup-content-wrapper {
          background: #ffffff; border-radius: 12px; color: #1f2937; box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .popup-title { font-weight: 700; color: #2d5016; margin-bottom: 4px; font-size: 14px; }
        .popup-sub { font-size: 12px; color: #4b5563; line-height: 1.4; }
        
        .vector-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px; }
        .vector-title { font-weight: bold; font-size: 14px; color: #b8e994; display: flex; align-items: center; gap: 6px; }
        .vector-badge { background: #2d5016; color: #7cfc00; font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: bold; border: 1px solid #7cfc00; }
        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; }
        .plot-card {
          background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.18); border-radius: 12px;
          padding: 10px; cursor: pointer; transition: all 0.2s;
        }
        .plot-card.selected { border-color: #7cfc00; background: rgba(124,252,0,0.18); transform: scale(1.02); }
        .plot-name { font-weight: bold; font-size: 12px; color: #ffffff; margin-bottom: 3px; display: flex; align-items: center; gap: 4px; }
        .plot-info { font-size: 10px; color: #d1d8e0; margin-bottom: 2px; }
        .plot-status { display: inline-block; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 8px; margin-top: 4px; background: #2d5016; color: #7cfc00; }
      </style>
    </head>
    <body>
      <div id="map-container">
        <div id="leaflet-map"></div>
        <div id="vector-fallback">
          <div class="vector-header">
            <div class="vector-title">🌱 Bataan Coffee Farm Sections</div>
            <div class="vector-badge" id="active-badge">Interactive Map</div>
          </div>
          <div class="grid-container" id="grid-list"></div>
        </div>
      </div>

      <script>
        var fields = [ $markersJson ];
        var defaultCenter = [ $DEFAULT_LAT, $DEFAULT_LNG ];
        var map = null;
        var markers = {};

        function renderVectorFallback() {
          var container = document.getElementById('grid-list');
          if (!container) return;
          container.innerHTML = '';
          fields.forEach(function(f) {
            var div = document.createElement('div');
            div.className = 'plot-card';
            div.id = 'plot-card-' + f.id;
            div.onclick = function() { window.panToLoc(f.lat, f.lng); };
            div.innerHTML = '<div class="plot-name">☕ ' + f.name + '</div>' +
              '<div class="plot-info">📐 ' + f.area + ' • ' + f.trees + ' trees</div>' +
              '<div class="plot-info">🌱 ' + f.variety + '</div>' +
              '<div class="plot-status">' + f.status + '</div>';
            container.appendChild(div);
          });
        }

        function initMap() {
          renderVectorFallback();
          if (typeof L === 'undefined') {
            return;
          }

          try {
            var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            });

            var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
              attribution: '&copy; Esri &mdash; Bataan Coffee Fields',
              maxZoom: 18
            });

            var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenTopoMap',
              maxZoom: 17
            });

            map = L.map('leaflet-map', { 
              zoomControl: true,
              layers: [satelliteLayer]
            }).setView(defaultCenter, 15);

            var baseMaps = {
              "🛰️ Satellite": satelliteLayer,
              "🌐 Street (OSM)": osmLayer,
              "⛰️ Terrain": topoLayer
            };

            L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

            var greenIcon = L.divIcon({
              className: '',
              html: '<div class="custom-pin">🌱</div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            var bounds = [];
            fields.forEach(function(f) {
              var latLng = [f.lat, f.lng];
              bounds.push(latLng);

              L.circle(latLng, {
                color: '#2d5016',
                fillColor: '#7cfc00',
                fillOpacity: 0.35,
                radius: 120
              }).addTo(map);

              var marker = L.marker(latLng, { icon: greenIcon }).addTo(map);
              var popupContent = '<div class="popup-title">' + f.name + '</div>' +
                '<div class="popup-sub"><b>Area:</b> ' + f.area + '<br/>' +
                '<b>Trees:</b> ' + f.trees + ' trees<br/>' +
                '<b>Variety:</b> ' + f.variety + '<br/>' +
                '<b>Status:</b> ' + f.status + '</div>';
              marker.bindPopup(popupContent);
              markers[f.lat + '_' + f.lng] = marker;
            });

            if (bounds.length > 1) {
              map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
            } else if (bounds.length === 1) {
              map.setView(bounds[0], 16);
            }

            // Hide fallback overlay when Leaflet initialized cleanly
            document.getElementById('vector-fallback').style.display = 'none';
          } catch(e) {
            console.error('Leaflet init fallback error:', e);
          }
        }

        window.refreshMapSize = function() {
          if (map) {
            map.invalidateSize();
          }
        };

        window.panToLoc = function(lat, lng) {
          if (map) {
            map.flyTo([lat, lng], 17, { duration: 1.2 });
            var m = markers[lat + '_' + lng];
            if (m) {
              setTimeout(function() { m.openPopup(); }, 1200);
            }
            setTimeout(window.refreshMapSize, 400);
          }
          // Highlight vector card if active
          fields.forEach(function(f) {
            var card = document.getElementById('plot-card-' + f.id);
            if (card) {
              if (Math.abs(f.lat - lat) < 0.0001 && Math.abs(f.lng - lng) < 0.0001) {
                card.classList.add('selected');
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } else {
                card.classList.remove('selected');
              }
            }
          });
        };

        window.onload = function() {
          initMap();
          setTimeout(window.refreshMapSize, 200);
          setTimeout(window.refreshMapSize, 600);
        };
      </script>
    </body>
    </html>
    """.trimIndent()
}

private fun jsonEscape(str: String): String {
    val escaped = str.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ")
    return "\"$escaped\""
}



