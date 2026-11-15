package com.metaglance.core.state

import com.metaglance.core.contract.Cart
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.StreamStatus

/**
 * The texts of the notification of a session. `stopCamera` is the label of its one action, and `channel` is the
 * name of its notification channel in the settings of Android.
 */
data class SessionNotice(val title: String, val text: String, val stopCamera: String, val channel: String)

/** Makes the notification of a session: the title is the state, and the text is the cart. */
object SessionNotices {
    /** `cart` is null before the first cart of the server arrives. */
    fun of(stream: StreamStatus, network: Network, waitingForGlasses: Boolean, cart: Cart?, lang: Lang): SessionNotice {
        val words = if (lang == Lang.IT) IT else EN
        val title = when {
            waitingForGlasses -> words.glassesDisconnected
            network == Network.OFFLINE -> words.serverNotReachable
            stream == StreamStatus.STREAMING -> words.shopping
            stream == StreamStatus.PAUSED -> words.cameraPaused
            stream == StreamStatus.STARTING -> words.cameraStarts
            else -> words.cameraOff
        }
        val count = cart?.items?.sumOf { it.qty } ?: 0
        val text = if (cart == null || count == 0) words.cartEmpty else "${words.items(count)}, ${eur(cart.totalCents)} EUR"
        return SessionNotice(title, text, words.stopCamera, words.channel)
    }

    /** The amount as the page shows it, for example 189 as "1.89". */
    private fun eur(cents: Int): String = "${cents / 100}.${(cents % 100).toString().padStart(2, '0')}"

    private class Words(
        val shopping: String,
        val cameraPaused: String,
        val cameraStarts: String,
        val cameraOff: String,
        val serverNotReachable: String,
        val glassesDisconnected: String,
        val cartEmpty: String,
        val items: (Int) -> String,
        val stopCamera: String,
        val channel: String
    )

    // The words for the cart are those of the page, in `apps/mobile/ui/src/text/strings.ts`.
    private val EN = Words(
        shopping = "Shopping",
        cameraPaused = "Camera paused",
        cameraStarts = "Camera starts",
        cameraOff = "Camera off",
        serverNotReachable = "Server not reachable",
        glassesDisconnected = "Glasses disconnected",
        cartEmpty = "Your cart is empty.",
        items = { if (it == 1) "1 item" else "$it items" },
        stopCamera = "Stop camera",
        channel = "Shopping session"
    )

    private val IT = Words(
        shopping = "Spesa in corso",
        cameraPaused = "Fotocamera in pausa",
        cameraStarts = "Avvio della fotocamera",
        cameraOff = "Fotocamera spenta",
        serverNotReachable = "Server non raggiungibile",
        glassesDisconnected = "Occhiali non collegati",
        cartEmpty = "Il carrello è vuoto.",
        items = { if (it == 1) "1 articolo" else "$it articoli" },
        stopCamera = "Spegni la fotocamera",
        channel = "Sessione di spesa"
    )
}
