package com.parcelbridge.app

import android.content.Context
import android.widget.TextView
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Exercise the actual Activity, rather than only a standalone UI host. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = ParcelBridgeApplication::class)
class MainActivityStartupTest {
    private fun freshPreferences() {
        val context = RuntimeEnvironment.getApplication()
        context.getSharedPreferences("parcelbridge", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("parcelbridge_ui", Context.MODE_PRIVATE).edit()
            .putBoolean("reduce_motion", true).commit()
        CrashDiagnostics.clear(context)
    }

    private fun launch(): MainActivity = Robolectric.buildActivity(MainActivity::class.java).setup().get()

    @Test fun aNewInstallOpensWelcomePageWithoutAConfiguredServer() {
        freshPreferences()
        val activity = launch()
        assertFalse("The activity must not finish or crash", activity.isFinishing)
        assertTrue("A welcome screen should be visible",
            activity.findViewById<android.view.ViewGroup>(android.R.id.content).let { root ->
                fun labels(view: android.view.View): List<TextView> =
                    listOfNotNull(view as? TextView) +
                        if (view is android.view.ViewGroup)
                            (0 until view.childCount).flatMap { labels(view.getChildAt(it)) }
                        else emptyList()
                labels(root).any { it.text.toString().contains("Welcome back") }
            })
        activity.finish()
    }

    @Test fun MalformedSavedAccountNeverCausesAnImmediateCrash() {
        freshPreferences()
        val context = RuntimeEnvironment.getApplication()
        context.getSharedPreferences("parcelbridge", Context.MODE_PRIVATE)
            .edit().putString("user", "{incomplete JSON").commit()
        val activity = launch()
        assertFalse(activity.isFinishing)
        // Keep the original metadata for recovery; do not delete stored user state.
        assertTrue(context.getSharedPreferences("parcelbridge", Context.MODE_PRIVATE)
            .getString("user", "")!!.contains("incomplete"))
        activity.finish()
    }

    @Test fun LocalCrashReportCanBeReadAndCleared() {
        freshPreferences()
        val context = RuntimeEnvironment.getApplication()
        CrashDiagnostics.record(context, IllegalStateException("test startup failure"))
        assertTrue(CrashDiagnostics.lastReport(context)!!.contains("test startup failure"))
        CrashDiagnostics.clear(context)
        assertTrue(CrashDiagnostics.lastReport(context) == null)
    }
}
