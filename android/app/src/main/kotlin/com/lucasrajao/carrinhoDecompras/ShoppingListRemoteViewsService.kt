package com.lucasrajao.carrinhoDecompras

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import es.antonborri.home_widget.HomeWidgetPlugin
import org.json.JSONArray
import org.json.JSONObject

class ShoppingListRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return ShoppingListRemoteViewsFactory(applicationContext)
    }
}

class ShoppingListRemoteViewsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {

    private val items = ArrayList<JSONObject>()
    private var isDarkMode: Boolean = false

    override fun onCreate() {
        loadItems()
    }

    override fun onDataSetChanged() {
        loadItems()
    }

    private fun loadItems() {
        items.clear()
        val prefs = HomeWidgetPlugin.getData(context)
        isDarkMode = prefs.getBoolean("is_dark_mode", false)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                items.add(jsonArray.getJSONObject(i))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        items.clear()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position < 0 || position >= items.size) return null

        val item = items[position]
        val id = item.optString("id", "")
        val name = item.optString("name", "Produto")
        val quantity = item.optInt("quantity", 1)
        val unit = item.optString("unit", "un")
        val isChecked = item.optBoolean("isChecked", false)

        val views = RemoteViews(context.packageName, R.layout.widget_item_row)

        // Cores dependentes do tema
        val textColorNormal = if (isDarkMode) 0xFFFFFFFF.toInt() else 0xFF111827.toInt()
        val textColorChecked = if (isDarkMode) 0xFF6B7280.toInt() else 0xFF9CA3AF.toInt()

        // Nome do produto (Fonte Aumentada 16sp)
        views.setTextViewText(R.id.item_name, name)
        if (isChecked) {
            views.setTextColor(R.id.item_name, textColorChecked)
            views.setInt(R.id.item_name, "setPaintFlags", Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG)
            views.setInt(R.id.item_quantity_badge, "setBackgroundResource", R.drawable.badge_quantity_checked_bg)
            views.setTextColor(R.id.item_quantity_badge, textColorChecked)
        } else {
            views.setTextColor(R.id.item_name, textColorNormal)
            views.setInt(R.id.item_name, "setPaintFlags", Paint.ANTI_ALIAS_FLAG)
            views.setInt(R.id.item_quantity_badge, "setBackgroundResource", R.drawable.badge_quantity_bg)
            views.setTextColor(R.id.item_quantity_badge, 0xFF00C853.toInt())
        }

        // Badge de quantidade idêntica ao app
        val unitText = if (unit.isNotEmpty() && unit != "un") " $unit" else ""
        views.setTextViewText(R.id.item_quantity_badge, "$quantity$unitText")

        // 1. Clicar no nome ou na linha do item: MARCA COMO TICKADO / DESMARCA
        val toggleIntent = Intent().apply {
            putExtra(ShoppingListWidgetProvider.EXTRA_ACTION, ShoppingListWidgetProvider.ACTION_TOGGLE)
            putExtra(ShoppingListWidgetProvider.EXTRA_ITEM_ID, id)
        }
        views.setOnClickFillInIntent(R.id.item_name, toggleIntent)
        views.setOnClickFillInIntent(R.id.widget_row_container, toggleIntent)

        // 2. Clicar na badge de quantidade: ABRE O MODAL DE ALTERAR QUANTIDADE / REMOVER
        val editIntent = Intent().apply {
            putExtra(ShoppingListWidgetProvider.EXTRA_ACTION, ShoppingListWidgetProvider.ACTION_EDIT_MODAL)
            putExtra(ShoppingListWidgetProvider.EXTRA_ITEM_ID, id)
        }
        views.setOnClickFillInIntent(R.id.item_quantity_badge, editIntent)

        // 3. Clicar na lixeira: REMOVE O ITEM DIRETAMENTE DA TELA INICIAL
        val deleteIntent = Intent().apply {
            putExtra(ShoppingListWidgetProvider.EXTRA_ACTION, ShoppingListWidgetProvider.ACTION_DELETE)
            putExtra(ShoppingListWidgetProvider.EXTRA_ITEM_ID, id)
        }
        views.setOnClickFillInIntent(R.id.item_btn_delete, deleteIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        if (position >= 0 && position < items.size) {
            val id = items[position].optString("id", "")
            if (id.isNotEmpty()) {
                return id.hashCode().toLong()
            }
        }
        return position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
