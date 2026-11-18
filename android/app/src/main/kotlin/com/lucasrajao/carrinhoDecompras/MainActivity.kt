package com.lucasrajao.carrinhoDecompras

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    companion object {
        const val SYNC_CHANNEL = "com.lucasrajao.carrinhoDecompras/widget_sync"
        private var syncChannel: MethodChannel? = null

        fun notifyWidgetDataChanged() {
            try {
                syncChannel?.invokeMethod("onWidgetDataChanged", null)
            } catch (_: Exception) {}
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        syncChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SYNC_CHANNEL)
    }

    override fun onResume() {
        super.onResume()
        notifyWidgetDataChanged()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        notifyWidgetDataChanged()
    }

    override fun onDestroy() {
        syncChannel = null
        super.onDestroy()
    }
}
