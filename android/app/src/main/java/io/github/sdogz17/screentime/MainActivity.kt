package io.github.sdogz17.screentime

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import io.github.sdogz17.screentime.model.WebPolicy
import io.github.sdogz17.screentime.model.emptyDocument
import io.github.sdogz17.screentime.model.toJson
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val reads = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView = WebView(this)
        setContentView(webView)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        configure(webView, assetLoader)
        webView.addJavascriptInterface(Bridge(), "ScreenTimeAndroid")
        WebView.setWebContentsDebuggingEnabled(false)
        webView.loadUrl(WebPolicy.PAGE)
    }

    override fun onResume() {
        super.onResume()
        reads.execute {
            UsageRefresh.refresh(this)
            runOnUiThread { notifyPage() }
        }
    }

    override fun onDestroy() {
        reads.shutdown()
        super.onDestroy()
    }

    private fun notifyPage() {
        val url = webView.url ?: return
        if (!WebPolicy.allow(url)) return
        webView.evaluateJavascript("window.__screenTimeRefresh && window.__screenTimeRefresh()", null)
    }

    private fun configure(view: WebView, assetLoader: WebViewAssetLoader) {
        val settings = view.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        @Suppress("DEPRECATION")
        settings.allowFileAccessFromFileURLs = false
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.safeBrowsingEnabled = true
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return !WebPolicy.allow(request.url?.toString())
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url ?: return blocked()
                if (!WebPolicy.allow(url.toString())) return blocked()
                return withPolicy(assetLoader.shouldInterceptRequest(url))
            }
        }
    }

    private inner class Bridge {
        @JavascriptInterface
        fun snapshot(): String = readOrError()

        @JavascriptInterface
        fun refresh(): String = UsageRefresh.refresh(this@MainActivity)

        @JavascriptInterface
        fun deleteAll(): String {
            UsageRefresh.delete(this@MainActivity)
            return emptyDocument().copy(
                status = emptyDocument().status.copy(
                    usageAccess = if (hasUsageAccess(this@MainActivity)) "granted" else "denied",
                    userUnlocked = isUserUnlocked(this@MainActivity),
                    lastDetail = "Stored screen time was deleted from this app.",
                ),
            ).toJson()
        }

        @JavascriptInterface
        fun openUsageAccess() {
            val specific = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            val general = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            runOnUiThread {
                try {
                    startActivity(specific)
                } catch (_: ActivityNotFoundException) {
                    try {
                        startActivity(general)
                    } catch (_: ActivityNotFoundException) {
                        // The page explains that the switch lives in system Settings.
                    }
                }
            }
        }

        @JavascriptInterface
        fun shareExport(): String {
            val json = readOrError()
            val export = File(cacheDir, "exports/screentime.json")
            export.parentFile?.mkdirs()
            export.writeText(json)
            val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", export)
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "application/json"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = android.content.ClipData.newRawUri("screentime.json", uri)
            }
            runOnUiThread {
                startActivity(Intent.createChooser(share, "Export screen time"))
            }
            return """{"ok":true,"detail":"Android opened the share sheet. The file stays on this phone unless you send it."}"""
        }

        private fun readOrError(): String = try {
            UsageRefresh.repository(this@MainActivity).read().toJson()
        } catch (_: Exception) {
            emptyDocument().copy(
                status = emptyDocument().status.copy(
                    lastResult = "error",
                    lastDetail = "Saved screen time could not be read. It was not overwritten.",
                ),
            ).toJson()
        }
    }
}

private fun withPolicy(response: WebResourceResponse?): WebResourceResponse? {
    if (response == null) return null
    val headers = (response.responseHeaders ?: emptyMap()).toMutableMap()
    headers["Content-Security-Policy"] = WebPolicy.CSP
    headers["Cache-Control"] = "no-store"
    val status = if (response.statusCode <= 0) 200 else response.statusCode
    val reason = response.reasonPhrase?.takeIf { it.isNotBlank() } ?: "OK"
    return WebResourceResponse(response.mimeType, response.encoding, status, reason, headers, response.data)
}

private fun blocked(): WebResourceResponse = WebResourceResponse(
    "text/plain",
    "utf-8",
    403,
    "Blocked",
    mapOf("Content-Security-Policy" to WebPolicy.CSP),
    ByteArrayInputStream(ByteArray(0)),
)
