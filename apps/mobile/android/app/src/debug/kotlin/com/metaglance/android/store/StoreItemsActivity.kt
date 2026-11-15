package com.metaglance.android.store

import android.content.Intent
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.metaglance.core.contract.StoreItemView
import com.metaglance.core.net.StoreApiException
import com.metaglance.core.store.StoreItemForm
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The debug screen "Store items": what the store list of the server holds now, with the price and the picture
 * count of each item. A tap on an item opens "Add product" for it. The screen reads the list each time it comes
 * into view, so it shows an item that the person just saved.
 */
class StoreItemsActivity : AppCompatActivity() {
    private lateinit var statusView: TextView
    private lateinit var items: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = StoreScreens.dp(this, StoreScreens.PAD_DP)
        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.fitsSystemWindows = true
        root.setPadding(pad, pad, pad, pad)

        val title = StoreScreens.text(this, StoreScreens.TITLE_SP, bold = true)
        title.text = "Store items"
        root.addView(title, StoreScreens.wide(this))
        statusView = StoreScreens.text(this, StoreScreens.TEXT_SP)
        root.addView(statusView, StoreScreens.wide(this, StoreScreens.GAP_DP))
        val add = StoreScreens.button(this, "Add or edit a product") { startActivity(Intent(this, AddProductActivity::class.java)) }
        root.addView(add, StoreScreens.wide(this, StoreScreens.GAP_DP))

        items = LinearLayout(this)
        items.orientation = LinearLayout.VERTICAL
        val scroll = ScrollView(this)
        scroll.addView(items)
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        read()
    }

    private fun read() {
        statusView.text = "Asks the server."
        lifecycleScope.launch {
            val list = try {
                withContext(Dispatchers.IO) { StoreScreens.api(this@StoreItemsActivity).items() }.items
            } catch (e: StoreApiException) {
                statusView.text = e.message
                return@launch
            }
            statusView.text = if (list.isEmpty()) "The store has no item. Add one." else "${list.size} items. Tap one to change it."
            items.removeAllViews()
            for (item in list) items.addView(row(item), StoreScreens.wide(this@StoreItemsActivity))
        }
    }

    private fun row(item: StoreItemView) = StoreScreens.button(this, "${StoreItemForm.title(item)}\n${StoreItemForm.detail(item)}") {
        startActivity(Intent(this, AddProductActivity::class.java).putExtra(AddProductActivity.EXTRA_GTIN, item.gtin))
    }
}
