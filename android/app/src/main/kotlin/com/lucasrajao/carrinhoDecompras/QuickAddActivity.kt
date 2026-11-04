package com.lucasrajao.carrinhoDecompras

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.TextView
import es.antonborri.home_widget.HomeWidgetPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.Normalizer
import java.util.Locale

class QuickAddActivity : Activity() {

    private var sessionAddedCount = 0

    override fun finish() {
        super.finish()
        overridePendingTransition(0, 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_add)

        val input = findViewById<EditText>(R.id.quick_add_input)
        val btnClose = findViewById<View>(R.id.quick_add_btn_close)
        val btnAdd = findViewById<View>(R.id.quick_add_btn_save)
        val feedbackLayout = findViewById<View>(R.id.quick_add_feedback_layout)
        val feedbackText = findViewById<TextView>(R.id.quick_add_feedback_text)

        fun showFeedback(msg: String) {
            feedbackText.text = msg
            feedbackLayout.visibility = View.VISIBLE
        }

        fun executeAdd() {
            val text = input.text.toString().trim()
            if (text.isNotEmpty()) {
                val (count, summary) = addItemsSmartly(text)
                if (count > 0) {
                    sessionAddedCount += count
                    val msg = if (count == 1) {
                        "✓ \"$summary\" adicionado à lista!"
                    } else {
                        "✓ $count itens adicionados com sucesso!"
                    }
                    showFeedback("$msg ($sessionAddedCount na sessão)")
                }
                input.setText("")
            }
            input.requestFocus()
        }

        // 1. Botão "+ Adicionar à Lista": adiciona os itens sem fechar o modal, permitindo adicionar mais
        btnAdd.setOnClickListener {
            executeAdd()
        }

        // 2. Ação do Teclado (Enviar/Concluir): adiciona e mantém o foco para o próximo item
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_SEND) {
                executeAdd()
                true
            } else {
                false
            }
        }

        // 3. Botão Fechar (X no cabeçalho): fecha o modal
        btnClose?.setOnClickListener {
            finish()
        }

        // Foca e abre o teclado
        input.requestFocus()
        input.postDelayed({
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
        }, 150)
    }

    /**
     * Adiciona itens com suporte a todas as capacidades do app Flutter:
     * - Multi-linhas (listas coladas)
     * - Separadores por vírgula (,), ponto e vírgula (;) ou quebra de linha (\n)
     * - Remoção de marcadores de lista / bullets (-, *, •, 1., [ ])
     * - Extração automática de quantidade e unidade (prefixos e sufixos)
     * - Singularização de plurais em português
     * - Prevenção / incremento de quantidade para itens já existentes
     * - Classificação automática nas 9 categorias
     */
    private fun addItemsSmartly(rawText: String): Pair<Int, String> {
        val cleanText = rawText.trim()
        if (cleanText.isEmpty()) return Pair(0, "")

        // Divisão por quebra de linha, ponto e vírgula ou vírgula
        val segments = if (cleanText.contains("\n") || cleanText.contains(";")) {
            cleanText.split(Regex("[\r\n;]+"))
        } else if (cleanText.contains(",")) {
            cleanText.split(",")
        } else {
            listOf(cleanText)
        }

        // Regex para remover marcadores de checklist: ex: "- item", "* item", "• item", "1. item", "[ ] item"
        val bulletPrefixRegex = Regex("^(\\s*[-*•◦▪▫▸▹▻✓✔✗✘☐☑☒]\\s*|\\s*\\[[ xX]?\\]\\s*|\\s*\\d+[.)\\-]\\s*)+")

        val prefs = HomeWidgetPlugin.getData(this)
        val jsonStr = prefs.getString("shopping_items_json", "[]") ?: "[]"

        try {
            val originalArray = JSONArray(jsonStr)
            val now = System.currentTimeMillis()
            var addedCount = 0
            var firstItemName = ""

            val newItemsToAdd = mutableListOf<JSONObject>()

            for ((index, segment) in segments.withIndex()) {
                val cleanedCandidate = bulletPrefixRegex.replace(segment.trim(), "").trim()
                if (cleanedCandidate.isEmpty()) continue

                val parsed = parseItemInput(cleanedCandidate)
                if (parsed.name.isEmpty()) continue

                if (firstItemName.isEmpty()) {
                    firstItemName = parsed.name
                }

                // Verifica se já existe um item com o mesmo nome na lista
                var existingItem: JSONObject? = null
                val normalizedTarget = removeAccents(parsed.name.lowercase(Locale.ROOT))

                for (i in 0 until originalArray.length()) {
                    val item = originalArray.getJSONObject(i)
                    val existingNormalized = removeAccents(item.optString("name", "").lowercase(Locale.ROOT))
                    if (existingNormalized == normalizedTarget) {
                        existingItem = item
                        break
                    }
                }

                // Também verifica nos que acabaram de ser adicionados nesta leva
                if (existingItem == null) {
                    for (item in newItemsToAdd) {
                        val existingNormalized = removeAccents(item.optString("name", "").lowercase(Locale.ROOT))
                        if (existingNormalized == normalizedTarget) {
                            existingItem = item
                            break
                        }
                    }
                }

                if (existingItem != null) {
                    // Já existe: incrementa a quantidade
                    val currentQty = existingItem.optInt("quantity", 1)
                    existingItem.put("quantity", currentQty + parsed.quantity)
                    addedCount++
                } else {
                    // Item novo: cria e adiciona
                    val newItem = JSONObject().apply {
                        put("id", "${now}_${index}")
                        put("name", parsed.name)
                        put("category", parsed.category)
                        put("quantity", parsed.quantity)
                        put("unit", parsed.unit)
                        put("isChecked", false)
                        put("createdAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", Locale.US).format(java.util.Date()))
                    }
                    newItemsToAdd.add(newItem)
                    addedCount++
                }
            }

            if (addedCount > 0) {
                // Monta o array final: novos itens no topo, seguidos dos itens existentes
                val finalArray = JSONArray()
                for (item in newItemsToAdd) {
                    finalArray.put(item)
                }
                for (i in 0 until originalArray.length()) {
                    finalArray.put(originalArray.getJSONObject(i))
                }

                // Salva no SharedPreferences do widget de forma síncrona (commit)
                prefs.edit()
                    .putString("shopping_items_json", finalArray.toString())
                    .putInt("total_items", finalArray.length())
                    .commit()

                // Sincroniza com arquivo de persistência do Flutter
                syncWithFlutter(finalArray)

                // Atualiza a lista do widget na tela inicial instantaneamente sem recriar o widget
                ShoppingListWidgetProvider.notifyUpdate(this, fullReinflate = false)
            }

            return Pair(addedCount, firstItemName)
        } catch (e: Exception) {
            e.printStackTrace()
            return Pair(0, "")
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

    private data class ParsedProduct(
        val name: String,
        val quantity: Int,
        val unit: String,
        val category: String
    )

    private fun parseItemInput(input: String): ParsedProduct {
        val cleanInput = input.trim()

        // 1. Extração de Quantidade e Unidade
        var quantity = 1
        var unit = "un"
        var cleanName = cleanInput

        // Regex para sufixos: ex: "maçã 2kg", "leite (3cx)", "ovos 1dz", "arroz 5kg", "suco 2L"
        val suffixRegex = Regex("^(.*?)\\s*\\(?(\\d+)\\s*(kg|kilos?|quilos?|g|gr|gramas?|dz|d[uú]zias?|cx|cxa|caixas?|pct|pacotes?|l|litros?|un|und|unidades?)\\)?$", RegexOption.IGNORE_CASE)
        val suffixMatch = suffixRegex.find(cleanInput)

        if (suffixMatch != null) {
            cleanName = suffixMatch.groupValues[1].trim()
            quantity = suffixMatch.groupValues[2].toIntOrNull() ?: 1
            unit = normalizeUnit(suffixMatch.groupValues[3])
        } else {
            // Regex para prefixos: ex: "2kg maçã", "2kg de maçã", "3cx leite", "1dz de ovos", "4 sabonetes", "2x refri"
            val prefixRegex = Regex("^(\\d+)\\s*(kg|kilos?|quilos?|g|gr|gramas?|dz|d[uú]zias?|cx|cxa|caixas?|pct|pacotes?|l|litros?|un|und|unidades?|x)?\\s*(?:de\\s+)?(.*)$", RegexOption.IGNORE_CASE)
            val prefixMatch = prefixRegex.find(cleanInput)
            if (prefixMatch != null) {
                val possibleQty = prefixMatch.groupValues[1].toIntOrNull() ?: 1
                val possibleUnit = prefixMatch.groupValues[2]
                val remainder = prefixMatch.groupValues[3].trim()

                if (remainder.isNotEmpty()) {
                    quantity = possibleQty
                    unit = if (possibleUnit.isNotEmpty()) normalizeUnit(possibleUnit) else "un"
                    cleanName = remainder
                }
            }
        }

        // 2. Singularização e Formatação do Nome
        cleanName = singularize(cleanName.lowercase(Locale.ROOT))
        if (cleanName.isNotEmpty()) {
            cleanName = cleanName.substring(0, 1).uppercase(Locale.ROOT) + cleanName.substring(1)
        } else {
            cleanName = cleanInput
        }

        // 3. Classificação Automática Inteligente de Categoria
        val category = classifyCategory(cleanName)

        return ParsedProduct(
            name = cleanName,
            quantity = if (quantity > 0) quantity else 1,
            unit = unit,
            category = category
        )
    }

    private fun normalizeUnit(raw: String): String {
        val u = raw.lowercase(Locale.ROOT).trim()
        return when {
            u in listOf("kg", "kilo", "kilos", "quilo", "quilos") -> "kg"
            u in listOf("g", "gr", "grama", "gramas") -> "g"
            u in listOf("dz", "duzia", "dúzia", "duzias", "dúzias") -> "dz"
            u in listOf("cx", "cxa", "caixa", "caixas", "pct", "pacote", "pacotes") -> "cx"
            u in listOf("l", "lt", "litro", "litros", "ml") -> "L"
            else -> "un"
        }
    }

    private fun singularize(text: String): String {
        val words = text.split(Regex("\\s+"))
        val result = words.map { word ->
            when {
                word.length <= 3 -> word
                word.endsWith("oes") || word.endsWith("ões") -> word.substring(0, word.length - 3) + "ão"
                word.endsWith("aes") || word.endsWith("ães") -> word.substring(0, word.length - 3) + "ão"
                word.endsWith("eis") -> word.substring(0, word.length - 3) + "el"
                word.endsWith("ns") -> word.substring(0, word.length - 2) + "m"
                word in listOf("arroz", "lapis", "lápis", "onibus", "ônibus", "virus", "vírus") -> word
                word.endsWith("s") -> word.substring(0, word.length - 1)
                else -> word
            }
        }
        return result.joinToString(" ")
    }

    private fun classifyCategory(name: String): String {
        val normalized = removeAccents(name.lowercase(Locale.ROOT))

        val bebidas = listOf("refrigerante", "refri", "coca", "agua", "suco", "cerveja", "vinho", "cha", "energetico", "vodka", "guarana", "fanta", "sprite", "pepsi", "leite", "iogurte", "nescau", "achocolatado")
        val limpeza = listOf("sabao", "detergente", "amaciante", "desinfetante", "agua sanitaria", "esponja", "vassoura", "rodo", "pano", "cloro", "vanish", "veja", "omo", "limpador", "lustra", "lustra moveis")
        val higiene = listOf("sabonete", "shampoo", "condicionador", "pasta", "dente", "escova", "desodorante", "fio dental", "papel higienico", "hidratante", "creme", "barbeador", "gillette", "absorvente", "colgate", "rexona", "dove", "nivea")
        val bebe = listOf("fralda", "pomada", "lenco", "chupeta", "mamadeira", "pampers", "huggies", "mucilon", "nan", "aptamil")
        val pet = listOf("racao", "petisco", "areia", "sache", "gato", "cachorro", "whiskas", "pedigree", "golden", "premier")
        val descartaveis = listOf("descartavel", "copo descartavel", "prato descartavel", "guardanapo", "papel toalha", "papel aluminio", "saco lixo", "filme pvc")
        val bazar = listOf("pilha", "lampada", "fita", "vela", "fosforo", "cola")

        for (word in bebidas) {
            if (normalized.contains(word)) return "bebidas"
        }
        for (word in limpeza) {
            if (normalized.contains(word)) return "limpeza"
        }
        for (word in higiene) {
            if (normalized.contains(word)) return "perfumaria_higiene"
        }
        for (word in bebe) {
            if (normalized.contains(word)) return "bebe_crianca"
        }
        for (word in pet) {
            if (normalized.contains(word)) return "pet_shop"
        }
        for (word in descartaveis) {
            if (normalized.contains(word)) return "descartaveis"
        }
        for (word in bazar) {
            if (normalized.contains(word)) return "bazar"
        }

        return "alimentos"
    }

    private fun removeAccents(str: String): String {
        val nfd = Normalizer.normalize(str, Normalizer.Form.NFD)
        return nfd.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
    }
}
