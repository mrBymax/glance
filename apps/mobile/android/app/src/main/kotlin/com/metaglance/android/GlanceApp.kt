package com.metaglance.android

import android.app.Application
import android.util.Log
import com.metaglance.android.dat.DatLink
import com.metaglance.android.mock.MockGlassesController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class GlanceApp : Application() {
    val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /** Receives each log line of [datLink]. The probe replaces it with its own log. */
    @Volatile
    var datLog: (String) -> Unit = { Log.i("Glance", it) }

    val datLink: DatLink by lazy { DatLink(this, scope) { datLog(it) } }
    val mockGlasses: MockGlassesController by lazy { MockGlassesController(this) }
}
