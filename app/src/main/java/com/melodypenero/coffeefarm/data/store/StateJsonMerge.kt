package com.melodypenero.coffeefarm.data.store

import com.google.gson.JsonParser

/**
 * The shared farm document stores everything as ONE text field (`stateJson`). The website adds
 * sections this app's [AppState] model doesn't have (e.g. `productListings` for the Buyer
 * storefront). If the app wrote back only what it models, every sync would silently ERASE those
 * sections -- that is exactly how the storefront's product listings disappeared.
 *
 * So the app never replaces the blob: it starts from what is currently stored and overlays only
 * its own top-level sections. Anything it doesn't model is carried through untouched.
 */
fun preserveUnknownFields(remoteJson: String?, ourJson: String): String {
    if (remoteJson.isNullOrBlank()) return ourJson
    val remote = runCatching { JsonParser.parseString(remoteJson) }.getOrNull()
        ?.takeIf { it.isJsonObject }
        ?.asJsonObject
        ?: return ourJson
    val ours = JsonParser.parseString(ourJson).asJsonObject
    for ((key, value) in ours.entrySet()) remote.add(key, value)
    return remote.toString()
}
