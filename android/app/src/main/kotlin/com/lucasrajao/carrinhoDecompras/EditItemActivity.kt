package com.lucasrajao.carrinhoDecompras

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import es.antonborri.home_widget.HomeWidgetPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class EditItemActivity : Activity() {

    private var itemId: String? = null
    private var currentQuantity: Int = 1
    private var currentUnit: String = "un"
    private var currentName: String = ""
    private var currentChecked: Boolean = false

    override fun finish() {
        super.finish()
        overridePendingTransition(0, 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_item)

        itemId = intent.getStringExtra("itemId")
        if (itemId == null) {
            finish()
            return
        }

        loadItemData()

        val txtProductName = findViewById<TextView>(R.id.edit_item_product_name)
        val txtQuantity = findViewById<TextView>(R.id.edit_txt_quantity)
        val btnDecrement = findViewById<View>(R.id.edit_btn_decrement)
        val btnIncrement = findViewById<View>(R.id.edit_btn_increment)
        val btnDelete = findViewById<View>(R.id.edit_btn_delete)
        val btnCancel = findViewById<View>(R.id.edit_btn_cancel)
        val btnSave = findViewById<View>(R.id.edit_btn_save)

        val btnToggleStatus = findViewById<View>(R.id.edit_btn_toggle_status)
        val imgStatusIcon = findViewById<ImageView>(R.id.edit_img_status_icon)
        val txtStatusLabel = findViewById<TextView>(R.id.edit_txt_status_label)

        txtProductName.text = currentName
        updateQuantityText(txtQuantity)

        fun renderStatus() {
            if (currentChecked) {
                imgStatusIcon.setImageResource(R.drawable.ic_check_circle)
                imgStatusIcon.setColorFilter(0xFF00C853.toInt())
                txtStatusLabel.text = "Item comprado (concluído)"
                txtStatusLabel.setTextColor(0xFF00C853.toInt())
            } else {
                imgStatusIcon.setImageResource(R.drawable.ic_circle_outline)
                imgStatusIcon.setColorFilter(0xFF9CA3AF.toInt())
                txtStatusLabel.text = "Pendente (toque para marcar como comprado)"
                txtStatusLabel.setTextColor(0xFFD1D5DB.toInt())
            }
        }

        renderStatus()

        btnToggleStatus.setOnClickListener {
            currentChecked = !currentChecked
            renderStatus()
        }

        btnDecrement.setOnClickListener {
            if (currentQuantity > 1) {
                currentQuantity--
                updateQuantityText(txtQuantity)
            }
        }

        btnIncrement.setOnClickListener {
            currentQuantity++
            updateQuantityText(txtQuantity)
        }

        btnCancel.setOnClickListener {
            finish()
        }

        btnDelete.setOnClickListener {
            deleteItem()
            finish()
        }

        btnSave.setOnClickListener {
            saveQuantity()
            finish()
        }
    }

    private fun updateQuantityText(textView: TextView) {
        val unitText = if (currentUnit.isNotEmpty() && currentUnit != "un") " $currentUnit" else " un"
        textView.text = "$currentQuantity$unitText"
    }

    private fun loadItemData() {
        val prefs = HomeWidgetPlugin.getData(this)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.getJSONObject(i)
                if (item.optString("id") == itemId) {
                    currentName = item.optString("name", "Produto")
                    currentQuantity = item.optInt("quantity", 1)
                    currentUnit = item.optString("unit", "un")
                    currentChecked = item.optBoolean("isChecked", false)
                    break
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun saveQuantity() {
        val prefs = HomeWidgetPlugin.getData(this)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.getJSONObject(i)
                if (item.optString("id") == itemId) {
                    item.put("quantity", currentQuantity)
                    item.put("isChecked", currentChecked)
                    break
                }
            }
            prefs.edit().putString("shopping_items_json", jsonArray.toString()).commit()
            syncWithFlutter(jsonArray)
            ShoppingListWidgetProvider.notifyUpdate(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun deleteItem() {
        val prefs = HomeWidgetPlugin.getData(this)
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
            syncWithFlutter(newArray)
            ShoppingListWidgetProvider.notifyUpdate(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun syncWithFlutter(newArray: JSONArray) {
        try {
            val filesDir = filesDir
            val candidateDirs = listOf(
                File(filesDir, "app_flutter"),
                filesDir,
                cacheDir
            )
            for (dir in candidateDirs) {
                val stateFile = File(dir, "carrinho_compras_state_v1.json")
                if (stateFile.exists()) {
                    val content = stateFile.readText()
                    val rootJson = JSONObject(content)
                    rootJson.put("items", newArray)
                    stateFile.writeText(rootJson.toString())
                    break
                }
            }
        } catch (_: Exception) {}
    }
}
