package com.parcelbridge.app

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/** A local-only report. Never automatically send app logs or user data to a server. */
object CrashDiagnostics {
    private const val FILE_NAME = "last_crash.txt"
    private const val MAX_LENGTH = 24_000

    fun record(context: Context, throwable: Throwable) {
        Log.e("ParcelBridge", "Uncaught app error", throwable)
        runCatching {
            val trace = StringWriter().also { throwable.printStackTrace(PrintWriter(it)) }.toString()
            File(context.filesDir, FILE_NAME).writeText(
                "ParcelBridge ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" +
                    "Android ${android.os.Build.VERSION.SDK_INT}\n\n" + trace.take(MAX_LENGTH)
            )
        }
    }

    fun lastReport(context: Context): String? = runCatching {
        File(context.filesDir, FILE_NAME).takeIf { it.isFile }?.readText()?.take(MAX_LENGTH)
    }.getOrNull()

    fun copy(context: Context): Boolean {
        val report = lastReport(context) ?: return false
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("ParcelBridge crash report", report))
        return true
    }

    fun clear(context: Context) {
        runCatching { File(context.filesDir, FILE_NAME).delete() }
    }
}

class ParcelBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, cause ->
            CrashDiagnostics.record(this, cause)
            // Preserve Android's normal crash handling and system crash reports.
            previous?.uncaughtException(thread, cause)
                ?: android.os.Process.killProcess(android.os.Process.myPid())
        }
    }
}
