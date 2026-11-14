package com.metaglance.core.state

import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.ServerEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NativeErrorsTest {
    @Test fun `has one error for each stop cause except a stop by the app`() {
        assertNull(NativeErrors.forStop(StopCause.APP))
        val codes = StopCause.values().drop(1).map { NativeErrors.forStop(it)!!.code }
        assertEquals(
            listOf(
                "native.update_required",
                "native.too_warm",
                "native.battery_low",
                "native.hinge_closed",
                "native.link_lost",
                "native.stopped_by_device",
                "native.session_failed"
            ),
            codes
        )
    }

    @Test fun `makes an error event of the contract`() {
        val event = Codec.decodeServerEvent(NativeErrors.toEvent(NativeErrors.NO_DEVICE))
        assertEquals(ServerEvent.Error("native.no_device", "Unfold your glasses and keep them near the phone."), event)
    }
}
