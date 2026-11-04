package com.lucasrajao.carrinhoDecompras

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.HomeWidgetProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class ShoppingListWidgetProvider : HomeWidgetProvider() {

    companion object {
        const val ACTION_ITEM_CLICK = "com.lucasrajao.carrinhoDecompras.ACTION_ITEM_CLICK"
        const val EXTRA_ACTION = "extra_action"
        const val EXTRA_ITEM_ID = "extra_item_id"

        const val ACTION_TOGGLE = "action_toggle"
        const val ACTION_EDIT_MODAL = "action_edit_modal"
        const val ACTION_DELETE = "action_delete"

        fun notifyUpdate(context: Context, fullReinflate: Boolean = false) {
            val appContext = context.applicationContext ?: context
            val appWidgetManager = AppWidgetManager.getInstance(appContext)
            val thisWidget = ComponentName(appContext, ShoppingListWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (appWidgetIds != null && appWidgetIds.isNotEmpty()) {
                if (fullReinflate) {
                    val prefs = HomeWidgetPlugin.getData(appContext)
                    val provider = ShoppingListWidgetProvider()
                    provider.onUpdate(appContext, appWidgetManager, appWidgetIds, prefs)
                }
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_list_view)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_ITEM_CLICK) {
            val action = intent.getStringExtra(EXTRA_ACTION)
            val itemId = intent.getStringExtra(EXTRA_ITEM_ID)
            if (action != null && itemId != null) {
                if (action == ACTION_EDIT_MODAL) {
                    // Abre o modal de edição de quantidade e exclusão
                    val editIntent = Intent(context, EditItemActivity::class.java).apply {
                        putExtra("itemId", itemId)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    context.startActivity(editIntent)
                } else if (action == ACTION_TOGGLE) {
                    // Alterna o status (tickado/desmarcado) em segundo plano sem abrir o app
                    handleToggleAction(context, itemId)
                } else if (action == ACTION_DELETE) {
                    // Remove o item em segundo plano sem abrir o app
                    handleDeleteAction(context, itemId)
                }
                return
            }
        }
        super.onReceive(context, intent)
    }

    private fun handleDeleteAction(context: Context, itemId: String) {
        val prefs = HomeWidgetPlugin.getData(context)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"
        try {
            val originalArray = JSONArray(jsonStr)
            val newArray = JSONArray()
            for (i in 0 until originalArray.length()) {
                val item = originalArray.getJSONObject(i)
                if (item.optString("id") != itemId) {
                    newArray.put(item)
                }
            }
            prefs.edit().putString("shopping_items_json", newArray.toString()).commit()
            syncWithFlutterFile(context, newArray)
            notifyUpdate(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun handleToggleAction(context: Context, itemId: String) {
        val prefs = HomeWidgetPlugin.getData(context)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(jsonStr)
            var modified = false

            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.getJSONObject(i)
                if (item.optString("id") == itemId) {
                    val currentChecked = item.optBoolean("isChecked", false)
                    item.put("isChecked", !currentChecked)
                    modified = true
                    break
                }
            }

            if (modified) {
                val updatedJson = jsonArray.toString()
                prefs.edit().putString("shopping_items_json", updatedJson).commit()
                syncWithFlutterFile(context, jsonArray)
                notifyUpdate(context)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun syncWithFlutterFile(context: Context, newItemsArray: JSONArray) {
        try {
            val filesDir = context.filesDir
            val candidateDirs = listOf(
                File(filesDir, "app_flutter"),
                filesDir,
                context.cacheDir
            )
            for (dir in candidateDirs) {
                val stateFile = File(dir, "carrinho_compras_state_v1.json")
                if (stateFile.exists()) {
                    val content = stateFile.readText()
                    val rootJson = JSONObject(content)
                    rootJson.put("items", newItemsArray)
                    stateFile.writeText(rootJson.toString())
                    break
                }
            }
        } catch (_: Exception) {}
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        val isDarkMode = widgetData.getBoolean("is_dark_mode", false)

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.shopping_list_widget)

            // Aplica cores do tema (Claro ou Escuro)
            if (isDarkMode) {
                views.setInt(R.id.widget_container, "setBackgroundResource", R.drawable.widget_bg_dark)
                views.setInt(R.id.widget_header_gradient, "setBackgroundResource", R.drawable.widget_header_gradient_overlay)
                views.setTextColor(R.id.widget_title, 0xFFFFFFFF.toInt())
                views.setInt(R.id.widget_divider, "setBackgroundColor", 0xFF2E3440.toInt())
                views.setInt(R.id.widget_bottom_input_box, "setBackgroundResource", R.drawable.bottom_input_bg_dark)
                views.setTextColor(R.id.widget_bottom_hint, 0xFF9CA3AF.toInt())
            } else {
                views.setInt(R.id.widget_container, "setBackgroundResource", R.drawable.widget_bg_light)
                views.setInt(R.id.widget_header_gradient, "setBackgroundResource", R.drawable.widget_header_gradient_overlay_light)
                views.setTextColor(R.id.widget_title, 0xFF111827.toInt())
                views.setInt(R.id.widget_divider, "setBackgroundColor", 0xFFE5E7EB.toInt())
                views.setInt(R.id.widget_bottom_input_box, "setBackgroundResource", R.drawable.bottom_input_bg_light)
                views.setTextColor(R.id.widget_bottom_hint, 0xFF6B7280.toInt())
            }

            // Configura o RemoteViewsService do ListView
            val serviceIntent = Intent(context, ShoppingListRemoteViewsService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse("content://com.lucasrajao.carrinhoDecompras/widget/$widgetId")
            }
            views.setRemoteAdapter(R.id.widget_list_view, serviceIntent)
            views.setEmptyView(R.id.widget_list_view, R.id.widget_empty_view)

            // Configura o PendingIntent template para cliques individuais nos itens da lista
            val itemClickIntent = Intent(context, ShoppingListWidgetProvider::class.java).apply {
                action = ACTION_ITEM_CLICK
            }
            val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val itemClickPendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                itemClickIntent,
                pendingFlags
            )
            views.setPendingIntentTemplate(R.id.widget_list_view, itemClickPendingIntent)

            // Configura o clique na barra inferior de texto: abre o diálogo flutuante sem entrar no app
            val quickAddIntent = Intent(context, QuickAddActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val quickAddPendingIntent = PendingIntent.getActivity(
                context,
                1001,
                quickAddIntent,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
            )
            views.setOnClickPendingIntent(R.id.widget_bottom_input_box, quickAddPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_btn_bottom_add, quickAddPendingIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
            appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list_view)
        }
    }
}
