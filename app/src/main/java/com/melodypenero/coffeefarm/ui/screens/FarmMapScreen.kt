package com.melodypenero.coffeefarm.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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
private const val GOOGLE_MAPS_API_KEY = "AIzaSyCIPvNir7jtTPn5icBN8-8svGSGNz4o9_w"

@Composable
fun FarmMapScreen() {
    val palette = farmPalette()
    val store = LocalAppStore.current
    val state by store.appState
    val fields = state.coffeeFields
    var selectedField by remember { mutableStateOf<CoffeeFieldRecord?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    FarmLazyScreen(
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Screen Title
        item {
            FarmSectionTitle(
                title = "Farm Section Map",
                subtitle = "Google Satellite visual guide of coffee fields & sections."
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
                            title = "Google Satellite Section Map",
                            subtitle = "Tap section pins or click field cards below to inspect details"
                        )
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

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(350.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                            .background(palette.surfaceElevated)
                    ) {
                        InteractiveGoogleMapView(
                            fields = fields,
                            onWebViewCreated = { webViewInstance = it }
                        )
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
                        webViewInstance?.evaluateJavascript(
                            "if (window.panToLoc) { window.panToLoc($effectiveLat, $effectiveLng); }",
                            null
                        )
                    }
                )
            }
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
private fun InteractiveGoogleMapView(
    fields: List<CoffeeFieldRecord>,
    onWebViewCreated: (WebView) -> Unit
) {
    val htmlContent = remember(fields) { buildGoogleMapsHtml(fields) }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                setBackgroundColor(android.graphics.Color.parseColor("#1C2B18"))
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        view?.postDelayed({
                            view.evaluateJavascript("if (window.refreshMapSize) { window.refreshMapSize(); }", null)
                        }, 150)
                        view?.postDelayed({
                            view.evaluateJavascript("if (window.refreshMapSize) { window.refreshMapSize(); }", null)
                        }, 600)
                    }
                }
                webChromeClient = object : android.webkit.WebChromeClient() {
                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: android.webkit.GeolocationPermissions.Callback?
                    ) {
                        callback?.invoke(origin, true, false)
                    }

                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                        android.util.Log.d("FarmMapGoogle", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()}")
                        return true
                    }
                }
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    setGeolocationEnabled(true)
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    allowFileAccess = true
                    allowContentAccess = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                }
                tag = htmlContent
                loadDataWithBaseURL(
                    "https://www.google.com",
                    htmlContent,
                    "text/html",
                    "UTF-8",
                    null
                )
                onWebViewCreated(this)
            }
        },
        update = { webView ->
            val lastLoadedHtml = webView.tag as? String
            if (lastLoadedHtml != htmlContent) {
                webView.tag = htmlContent
                webView.loadDataWithBaseURL(
                    "https://www.google.com",
                    htmlContent,
                    "text/html",
                    "UTF-8",
                    null
                )
            }
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

private fun buildGoogleMapsHtml(fields: List<CoffeeFieldRecord>): String {
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
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          height: 100%;
          background: #152214;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }
        #map, #fallback-map {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          overflow: hidden;
        }
        #fallback-map {
          display: none;
          background: #1b2818;
          touch-action: none;
        }
        #tile-container, #marker-container {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .map-tile {
          position: absolute;
          width: 256px;
          height: 256px;
          will-change: transform;
          background: #1b2818;
        }
        .map-pin {
          position: absolute;
          transform: translate(-50%, -100%);
          pointer-events: auto;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 0.15s ease-out;
          z-index: 10;
        }
        .map-pin:active, .map-pin.active {
          transform: translate(-50%, -100%) scale(1.15);
          z-index: 20;
        }
        .pin-badge {
          background: rgba(20, 32, 17, 0.95);
          border: 1.5px solid #a3e635;
          color: #ffffff;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          margin-bottom: 2px;
        }
        .pin-icon {
          width: 32px;
          height: 32px;
          background: #2d5016;
          border: 2px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.6);
        }
        .worker-pin {
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: auto;
          width: 28px;
          height: 28px;
          background: #2563eb;
          border: 2px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: 0 0 12px #38bdf8;
          z-index: 15;
        }
        .map-floating-controls {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 50;
          display: flex;
          gap: 6px;
        }
        .ctrl-btn {
          background: rgba(20, 32, 17, 0.92);
          color: #b8e994;
          border: 1px solid #4d7a27;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .ctrl-btn.active {
          background: #3b6b1d;
          border-color: #7cfc00;
          color: #ffffff;
        }
        .zoom-controls {
          position: absolute;
          bottom: 16px;
          left: 14px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zoom-btn {
          width: 36px;
          height: 36px;
          background: rgba(20, 32, 17, 0.92);
          color: #ffffff;
          border: 1px solid #4d7a27;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .locate-btn {
          position: absolute;
          bottom: 16px;
          right: 14px;
          z-index: 50;
          background: #2563eb;
          color: #ffffff;
          border: 2px solid #ffffff;
          border-radius: 24px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        #info-popup {
          position: absolute;
          bottom: 70px;
          left: 50%;
          transform: translateX(-50%);
          background: #213519;
          border: 1.5px solid #4d7a27;
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6);
          min-width: 210px;
          max-width: 85%;
          display: none;
          z-index: 60;
        }
        .popup-close {
          position: absolute;
          top: 6px;
          right: 8px;
          color: #d1d8e0;
          font-size: 16px;
          cursor: pointer;
          padding: 2px 6px;
        }
        .popup-title {
          font-weight: 700;
          color: #b8e994;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .popup-sub {
          font-size: 11px;
          color: #e1e8dc;
          line-height: 1.5;
        }
        .popup-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 10px;
          background: #2d5016;
          color: #7cfc00;
          border: 1px solid #7cfc00;
          margin-top: 4px;
        }
        #loading-overlay {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: #152214;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 100;
          transition: opacity 0.3s ease;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.15);
          border-top-color: #7cfc00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Style for Google InfoWindows */
        .gm-style .gm-style-iw-c {
          background-color: #1e311a !important;
          color: #ffffff !important;
          border-radius: 12px !important;
          padding: 12px !important;
          border: 1px solid #4d7a27 !important;
        }
        .gm-style .gm-style-iw-d {
          color: #ffffff !important;
          overflow: hidden !important;
        }
        .gm-style .gm-style-iw-tc::after {
          background: #1e311a !important;
        }
      </style>
    </head>
    <body>
      <div id="loading-overlay">
        <div class="spinner"></div>
        <div style="font-size: 12px; color: #a3e635; font-weight: 600;">🛰️ Loading Google Satellite Map...</div>
      </div>

      <!-- Google Maps JS Container -->
      <div id="map"></div>

      <!-- High-res Satellite Tile Fallback Container -->
      <div id="fallback-map">
        <div id="tile-container"></div>
        <div id="marker-container"></div>

        <div class="map-floating-controls">
          <button id="btn-satellite" class="ctrl-btn active" onclick="setFallbackLayer('satellite')">🛰️ Satellite</button>
          <button id="btn-osm" class="ctrl-btn" onclick="setFallbackLayer('osm')">🗺️ Street</button>
          <button id="btn-topo" class="ctrl-btn" onclick="setFallbackLayer('topo')">⛰️ Topo</button>
        </div>

        <div class="zoom-controls">
          <button class="zoom-btn" onclick="changeFallbackZoom(1)">+</button>
          <button class="zoom-btn" onclick="changeFallbackZoom(-1)">&minus;</button>
        </div>

        <button class="locate-btn" onclick="locateWorker()">
          <span>📍</span> My Location
        </button>

        <div id="info-popup">
          <div class="popup-close" onclick="closePopup()">&times;</div>
          <div id="popup-content"></div>
        </div>
      </div>

      <script>
        var fields = [ $markersJson ];
        var centerLat = $DEFAULT_LAT;
        var centerLng = $DEFAULT_LNG;
        var zoom = 16;
        var gMap = null;
        var gMarkers = [];
        var gInfoWindow = null;
        var gWorkerMarker = null;
        var isGoogleMapsLoaded = false;
        var hasSwitchedToFallback = false;

        // Auto-center on fields if provided
        if (fields.length > 0) {
          var sumLat = 0, sumLng = 0;
          fields.forEach(function(f) { sumLat += f.lat; sumLng += f.lng; });
          centerLat = sumLat / fields.length;
          centerLng = sumLng / fields.length;
        }

        function hideLoading() {
          var loader = document.getElementById('loading-overlay');
          if (loader) {
            loader.style.opacity = '0';
            setTimeout(function() { loader.style.display = 'none'; }, 300);
          }
        }

        // --- 1. GOOGLE MAPS JAVASCRIPT INITIALIZATION ---
        window.initGoogleMap = function() {
          try {
            isGoogleMapsLoaded = true;
            var farmCenter = { lat: centerLat, lng: centerLng };

            gMap = new google.maps.Map(document.getElementById('map'), {
              center: farmCenter,
              zoom: 16,
              mapTypeId: google.maps.MapTypeId.HYBRID,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: false,
              styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] }
              ]
            });

            gInfoWindow = new google.maps.InfoWindow();

            fields.forEach(function(f) {
              var marker = new google.maps.Marker({
                position: { lat: f.lat, lng: f.lng },
                map: gMap,
                title: f.name,
                label: {
                  text: '🌱 ' + f.name,
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  className: 'g-pin-label'
                },
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 9,
                  fillColor: '#2d5016',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2.5
                }
              });

              marker.addListener('click', function() {
                var content = '<div style="color:#ffffff; font-family:sans-serif; min-width:180px;">' +
                  '<div style="font-weight:bold; font-size:14px; color:#a3e635; margin-bottom:4px;">🌱 ' + f.name + '</div>' +
                  '<div style="font-size:12px; color:#e2e8f0; line-height:1.5;">' +
                  '<b>Area:</b> ' + f.area + '<br/>' +
                  '<b>Trees:</b> ' + f.trees + ' trees<br/>' +
                  '<b>Variety:</b> ' + f.variety + '<br/>' +
                  '<span style="display:inline-block; margin-top:4px; padding:2px 8px; background:#2d5016; color:#7cfc00; border-radius:8px; font-weight:bold; font-size:10px;">' + f.status + '</span>' +
                  '</div></div>';
                gInfoWindow.setContent(content);
                gInfoWindow.open(gMap, marker);
              });

              gMarkers.push({ id: f.id, marker: marker, data: f });
            });

            // GPS Worker Locator Button inside Google Maps UI
            var locateDiv = document.createElement('div');
            locateDiv.innerHTML = '<button class="locate-btn" style="position:relative; bottom:0; right:0; margin:10px;"><span>📍</span> My Location</button>';
            locateDiv.onclick = locateWorker;
            gMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locateDiv);

            hideLoading();
          } catch(e) {
            console.error('Google Maps init error, falling back:', e);
            fallbackToTileMap();
          }
        };

        window.gm_authFailure = function() {
          console.warn('Google Maps auth failure detected. Activating satellite fallback.');
          fallbackToTileMap();
        };

        // --- 2. FALLBACK SATELLITE ENGINE ---
        var currentFallbackLayer = 'satellite';
        var fallbackZoom = 16;
        var fallbackCenterLat = centerLat;
        var fallbackCenterLng = centerLng;
        var fallbackWorkerPos = null;
        var fallbackSelectedPinId = null;

        var fallbackMap = document.getElementById('fallback-map');
        var tileContainer = document.getElementById('tile-container');
        var markerContainer = document.getElementById('marker-container');
        var infoPopup = document.getElementById('info-popup');
        var popupContent = document.getElementById('popup-content');

        var isDragging = false;
        var startX = 0, startY = 0;
        var lastTouchDist = null;

        function fallbackToTileMap() {
          if (hasSwitchedToFallback) return;
          hasSwitchedToFallback = true;
          document.getElementById('map').style.display = 'none';
          fallbackMap.style.display = 'block';
          renderFallbackMap();
          hideLoading();
        }

        function latLngToTile(lat, lng, z) {
          var n = Math.pow(2, z);
          var latRad = lat * Math.PI / 180;
          var x = ((lng + 180) / 360) * n;
          var y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
          return { x: x, y: y };
        }

        function tileToLatLng(x, y, z) {
          var n = Math.pow(2, z);
          var lng = (x / n) * 360 - 180;
          var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
          var lat = latRad * 180 / Math.PI;
          return { lat: lat, lng: lng };
        }

        function getTileUrl(x, y, z, layer) {
          if (layer === 'satellite') {
            return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x;
          } else if (layer === 'topo') {
            return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/' + z + '/' + y + '/' + x;
          } else {
            return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
          }
        }

        function renderFallbackMap() {
          var width = fallbackMap.clientWidth || 360;
          var height = fallbackMap.clientHeight || 350;

          var centerTile = latLngToTile(fallbackCenterLat, fallbackCenterLng, fallbackZoom);
          var centerPxX = centerTile.x * 256;
          var centerPxY = centerTile.y * 256;

          var originPxX = centerPxX - width / 2;
          var originPxY = centerPxY - height / 2;

          var minTileX = Math.floor(originPxX / 256);
          var maxTileX = Math.floor((originPxX + width) / 256);
          var minTileY = Math.floor(originPxY / 256);
          var maxTileY = Math.floor((originPxY + height) / 256);

          var n = Math.pow(2, fallbackZoom);

          tileContainer.innerHTML = '';
          for (var tx = minTileX; tx <= maxTileX; tx++) {
            for (var ty = minTileY; ty <= maxTileY; ty++) {
              var normTx = (tx % n + n) % n;
              var normTy = ty;
              if (normTy < 0 || normTy >= n) continue;

              var tileUrl = getTileUrl(normTx, normTy, fallbackZoom, currentFallbackLayer);

              var img = document.createElement('img');
              img.className = 'map-tile';
              img.src = tileUrl;
              img.style.left = (tx * 256 - originPxX) + 'px';
              img.style.top = (ty * 256 - originPxY) + 'px';
              
              // Multi-source fallback on tile load failure
              img.onerror = function() {
                if (this.dataset.triedBackup) {
                  this.style.opacity = '0.3';
                } else {
                  this.dataset.triedBackup = '1';
                  this.src = 'https://tile.openstreetmap.org/' + fallbackZoom + '/' + normTx + '/' + normTy + '.png';
                }
              };
              tileContainer.appendChild(img);
            }
          }

          // Pins
          markerContainer.innerHTML = '';
          fields.forEach(function(f) {
            var pinTile = latLngToTile(f.lat, f.lng, fallbackZoom);
            var pinPxX = pinTile.x * 256 - originPxX;
            var pinPxY = pinTile.y * 256 - originPxY;

            var pinDiv = document.createElement('div');
            pinDiv.className = 'map-pin' + (fallbackSelectedPinId === f.id ? ' active' : '');
            pinDiv.id = 'pin-' + f.id;
            pinDiv.style.left = pinPxX + 'px';
            pinDiv.style.top = pinPxY + 'px';

            pinDiv.innerHTML = '<div class="pin-badge">🌱 ' + f.name + '</div>' +
              '<div class="pin-icon">☕</div>';

            pinDiv.onclick = function(e) {
              e.stopPropagation();
              openPopup(f);
            };

            markerContainer.appendChild(pinDiv);
          });

          // Worker Pin
          if (fallbackWorkerPos) {
            var wTile = latLngToTile(fallbackWorkerPos.lat, fallbackWorkerPos.lng, fallbackZoom);
            var wPxX = wTile.x * 256 - originPxX;
            var wPxY = wTile.y * 256 - originPxY;

            var wDiv = document.createElement('div');
            wDiv.className = 'worker-pin';
            wDiv.style.left = wPxX + 'px';
            wDiv.style.top = wPxY + 'px';
            wDiv.innerHTML = '🧍';
            wDiv.onclick = function(e) {
              e.stopPropagation();
              popupContent.innerHTML = '<div class="popup-title">📍 You are here</div><div class="popup-sub">Current GPS position on farm.</div>';
              infoPopup.style.display = 'block';
            };
            markerContainer.appendChild(wDiv);
          }
        }

        function openPopup(f) {
          fallbackSelectedPinId = f.id;
          popupContent.innerHTML = '<div class="popup-title">🌱 ' + f.name + '</div>' +
            '<div class="popup-sub">' +
            '<b>Area:</b> ' + f.area + '<br/>' +
            '<b>Trees:</b> ' + f.trees + ' trees<br/>' +
            '<b>Variety:</b> ' + f.variety + '<br/>' +
            '<span class="popup-badge">' + f.status + '</span>' +
            '</div>';
          infoPopup.style.display = 'block';
          renderFallbackMap();
        }

        function closePopup() {
          infoPopup.style.display = 'none';
          fallbackSelectedPinId = null;
          renderFallbackMap();
        }

        function setFallbackLayer(layerType) {
          currentFallbackLayer = layerType;
          document.querySelectorAll('.ctrl-btn').forEach(function(b) { b.classList.remove('active'); });
          if (layerType === 'satellite') document.getElementById('btn-satellite').classList.add('active');
          if (layerType === 'osm') document.getElementById('btn-osm').classList.add('active');
          if (layerType === 'topo') document.getElementById('btn-topo').classList.add('active');
          renderFallbackMap();
        }

        function changeFallbackZoom(delta) {
          fallbackZoom = Math.max(12, Math.min(19, fallbackZoom + delta));
          renderFallbackMap();
        }

        function locateWorker() {
          if (!navigator.geolocation) {
            alert('Geolocation is not supported by your device.');
            return;
          }
          navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;

            if (isGoogleMapsLoaded && gMap) {
              var workerLatLng = new google.maps.LatLng(lat, lng);
              gMap.setCenter(workerLatLng);
              gMap.setZoom(17);
              if (gWorkerMarker) {
                gWorkerMarker.setPosition(workerLatLng);
              } else {
                gWorkerMarker = new google.maps.Marker({
                  position: workerLatLng,
                  map: gMap,
                  title: 'You are here',
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#2563eb',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3
                  }
                });
              }
            } else {
              fallbackWorkerPos = { lat: lat, lng: lng };
              fallbackCenterLat = lat;
              fallbackCenterLng = lng;
              fallbackZoom = 17;
              renderFallbackMap();
              popupContent.innerHTML = '<div class="popup-title">📍 You are here</div><div class="popup-sub">GPS location found on farm.</div>';
              infoPopup.style.display = 'block';
            }
          }, function(err) {
            console.warn('GPS error:', err);
          }, { enableHighAccuracy: true, timeout: 8000 });
        }

        window.panToLoc = function(lat, lng) {
          if (isGoogleMapsLoaded && gMap) {
            var target = new google.maps.LatLng(lat, lng);
            gMap.panTo(target);
            gMap.setZoom(17);
            var match = gMarkers.find(function(m) {
              return Math.abs(m.data.lat - lat) < 0.0001 && Math.abs(m.data.lng - lng) < 0.0001;
            });
            if (match && gInfoWindow) {
              google.maps.event.trigger(match.marker, 'click');
            }
          } else {
            fallbackCenterLat = lat;
            fallbackCenterLng = lng;
            fallbackZoom = 17;
            var matched = fields.find(function(f) {
              return Math.abs(f.lat - lat) < 0.0001 && Math.abs(f.lng - lng) < 0.0001;
            });
            if (matched) {
              openPopup(matched);
            } else {
              renderFallbackMap();
            }
          }
        };

        window.refreshMapSize = function() {
          if (isGoogleMapsLoaded && gMap) {
            google.maps.event.trigger(gMap, 'resize');
          } else {
            renderFallbackMap();
          }
        };

        // Touch & Pan Drag Handling for Fallback
        fallbackMap.addEventListener('mousedown', function(e) {
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
        });

        window.addEventListener('mousemove', function(e) {
          if (!isDragging || !hasSwitchedToFallback) return;
          var dx = e.clientX - startX;
          var dy = e.clientY - startY;
          startX = e.clientX;
          startY = e.clientY;

          var centerTile = latLngToTile(fallbackCenterLat, fallbackCenterLng, fallbackZoom);
          centerTile.x -= dx / 256;
          centerTile.y -= dy / 256;
          var newCenter = tileToLatLng(centerTile.x, centerTile.y, fallbackZoom);
          fallbackCenterLat = newCenter.lat;
          fallbackCenterLng = newCenter.lng;
          renderFallbackMap();
        });

        window.addEventListener('mouseup', function() { isDragging = false; });

        fallbackMap.addEventListener('touchstart', function(e) {
          if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
          } else if (e.touches.length === 2) {
            isDragging = false;
            lastTouchDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
          }
        }, { passive: true });

        fallbackMap.addEventListener('touchmove', function(e) {
          if (e.touches.length === 1 && isDragging) {
            var dx = e.touches[0].clientX - startX;
            var dy = e.touches[0].clientY - startY;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            var centerTile = latLngToTile(fallbackCenterLat, fallbackCenterLng, fallbackZoom);
            centerTile.x -= dx / 256;
            centerTile.y -= dy / 256;
            var newCenter = tileToLatLng(centerTile.x, centerTile.y, fallbackZoom);
            fallbackCenterLat = newCenter.lat;
            fallbackCenterLng = newCenter.lng;
            renderFallbackMap();
          } else if (e.touches.length === 2 && lastTouchDist) {
            var dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            if (dist - lastTouchDist > 40) {
              changeFallbackZoom(1);
              lastTouchDist = dist;
            } else if (lastTouchDist - dist > 40) {
              changeFallbackZoom(-1);
              lastTouchDist = dist;
            }
          }
        }, { passive: true });

        fallbackMap.addEventListener('touchend', function() {
          isDragging = false;
          lastTouchDist = null;
        });

        // Timeout fallback if Google Maps JS fails to load or takes > 2500ms
        setTimeout(function() {
          if (!isGoogleMapsLoaded) {
            console.log('Google Maps API timeout. Switching to satellite fallback engine.');
            fallbackToTileMap();
          }
        }, 2500);
      </script>

      <!-- Official Google Maps JavaScript API with User API Key -->
      <script src="https://maps.googleapis.com/maps/api/js?key=$GOOGLE_MAPS_API_KEY&callback=initGoogleMap" async defer onerror="fallbackToTileMap()"></script>
    </body>
    </html>
    """.trimIndent()
}

private fun jsonEscape(str: String): String {
    val escaped = str.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ")
    return "\"$escaped\""
}
