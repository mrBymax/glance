package com.metaglance.core.state

import com.metaglance.core.contract.Cart
import com.metaglance.core.contract.CartItem
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.StreamStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionNoticesTest {
    private val oneItem = Cart(listOf(CartItem("oat-drink-1l", "Oat drink", "1 L", 1, 189)), 189)
    private val threeItems = Cart(listOf(CartItem("oat-drink-1l", "Oat drink", "1 L", 2, 189), CartItem("rye-bread", "Rye bread", "500 g", 1, 862)), 1240)

    private fun notice(
        stream: StreamStatus = StreamStatus.STREAMING,
        network: Network = Network.ONLINE,
        waitingForGlasses: Boolean = false,
        cart: Cart? = oneItem,
        lang: Lang = Lang.EN
    ) = SessionNotices.of(stream, network, waitingForGlasses, cart, lang)

    @Test fun `the title is the state of the session`() {
        assertEquals("Shopping", notice().title)
        assertEquals("Camera paused", notice(stream = StreamStatus.PAUSED).title)
        assertEquals("Camera starts", notice(stream = StreamStatus.STARTING).title)
        assertEquals("Camera off", notice(stream = StreamStatus.STOPPED).title)
        assertEquals("Server not reachable", notice(network = Network.OFFLINE).title)
        assertEquals("Glasses disconnected", notice(stream = StreamStatus.STOPPED, waitingForGlasses = true).title)
    }

    // Without the glasses nothing works, so that state hides a lost server.
    @Test fun `disconnected glasses come before a server that is not reachable`() {
        assertEquals("Glasses disconnected", notice(network = Network.OFFLINE, waitingForGlasses = true).title)
        assertEquals("Server not reachable", notice(stream = StreamStatus.PAUSED, network = Network.OFFLINE).title)
    }

    @Test fun `the text is the item count and the total of the cart`() {
        assertEquals("1 item, 1.89 EUR", notice().text)
        assertEquals("3 items, 12.40 EUR", notice(cart = threeItems).text)
        assertEquals("Your cart is empty.", notice(cart = Cart(emptyList(), 0)).text)
        assertEquals("Your cart is empty.", notice(cart = null).text)
    }

    @Test fun `each text has an Italian form`() {
        assertEquals("Spesa in corso", notice(lang = Lang.IT).title)
        assertEquals("Fotocamera in pausa", notice(stream = StreamStatus.PAUSED, lang = Lang.IT).title)
        assertEquals("Avvio della fotocamera", notice(stream = StreamStatus.STARTING, lang = Lang.IT).title)
        assertEquals("Fotocamera spenta", notice(stream = StreamStatus.STOPPED, lang = Lang.IT).title)
        assertEquals("Server non raggiungibile", notice(network = Network.OFFLINE, lang = Lang.IT).title)
        assertEquals("Occhiali non collegati", notice(waitingForGlasses = true, lang = Lang.IT).title)
        assertEquals("1 articolo, 1.89 EUR", notice(lang = Lang.IT).text)
        assertEquals("3 articoli, 12.40 EUR", notice(cart = threeItems, lang = Lang.IT).text)
        assertEquals("Il carrello è vuoto.", notice(cart = null, lang = Lang.IT).text)
    }

    @Test fun `the action and the channel have a name in each language`() {
        assertEquals("Stop camera", notice().stopCamera)
        assertEquals("Spegni la fotocamera", notice(lang = Lang.IT).stopCamera)
        assertEquals("Shopping session", notice().channel)
        assertEquals("Sessione di spesa", notice(lang = Lang.IT).channel)
    }
}
