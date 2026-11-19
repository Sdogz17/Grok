package io.github.sdogz17.screentime.model

import java.net.URI

/**
 * The privileged page is the app's own bundled assets.
 * The public GitHub Pages calendar is not loaded here, and it gets no bridge.
 */
object WebPolicy {
    const val HOST = "appassets.androidplatform.net"
    const val PAGE = "https://appassets.androidplatform.net/assets/index.html"
    const val CSP =
        "default-src 'none'; " +
            "script-src https://appassets.androidplatform.net; " +
            "style-src https://appassets.androidplatform.net 'unsafe-inline'; " +
            "img-src https://appassets.androidplatform.net data:; " +
            "font-src https://appassets.androidplatform.net; " +
            "connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

    fun allow(raw: String?): Boolean {
        if (raw.isNullOrBlank()) return false
        val uri = try {
            URI(raw)
        } catch (_: Exception) {
            return false
        }
        if (!uri.isAbsolute || uri.scheme != "https") return false
        if (uri.host != HOST) return false
        if (uri.userInfo != null || uri.query != null) return false
        val path = uri.path ?: return false
        if (!path.startsWith("/assets/")) return false
        if (path.contains("..") || path.contains("//") || path.contains("\\")) return false
        return true
    }
}
