package com.parcelbridge.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.provider.Settings
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

object Updates {
    private val executor=Executors.newSingleThreadExecutor()
    @Volatile private var running=false
    fun check(activity:Activity,api:Api,manual:Boolean) {
        if(api.base.isEmpty() || running) return
        running=true
        executor.execute {
            try {
                val manifest=api.obj("/v1/updates")
                activity.runOnUiThread {
                    if(activity.isDestroyed) return@runOnUiThread
                    if(manifest.getInt("versionCode")<=BuildConfig.VERSION_CODE) { if(manual) toast(activity,"You have the latest version"); return@runOnUiThread }
                    AlertDialog.Builder(activity).setTitle("ParcelBridge update available").setMessage("Version ${manifest.getString("versionName")} is available. Download and verify it now?")
                        .setNegativeButton("Later",null).setPositiveButton("Download") { _,_ -> download(activity,api,manifest) }.show()
                }
            } catch(e:Exception) { if(manual) activity.runOnUiThread { toast(activity,e.message ?: "Update check failed") } }
            finally { running=false }
        }
    }
    fun settings(activity:Activity,api:Api,content:LinearLayout) {
        content.addView(CheckBox(activity).apply { text="Automatically download verified updates on Wi-Fi"; isChecked=api.prefs.getBoolean("auto_updates",false); setOnCheckedChangeListener { _,checked -> api.prefs.edit().putBoolean("auto_updates",checked).apply() } })
        if(File(activity.filesDir,"updates/parcelbridge.apk").exists()) content.addView(android.widget.Button(activity).apply { text="Install downloaded update"; setOnClickListener { try { install(activity,api) } catch(e:Exception) { toast(activity,e.message ?: "Installation failed") } } })
    }
    fun background(context:Context,api:Api) {
        if(api.base.isEmpty() || System.currentTimeMillis()-api.prefs.getLong("update_check_at",0)<24*3600*1000L) return
        val manifest=api.obj("/v1/updates")
        api.prefs.edit().putLong("update_check_at",System.currentTimeMillis()).apply()
        if(manifest.getInt("versionCode")<=BuildConfig.VERSION_CODE) return
        SyncJob.notify(context,200,"ParcelBridge update available","Version ${manifest.getString("versionName")} is ready")
        val cm=context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val wifi=cm.getNetworkCapabilities(cm.activeNetwork)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)==true
        if(api.prefs.getBoolean("auto_updates",false) && wifi && !running) {
            running=true
            try { save(context,api,manifest); SyncJob.notify(context,201,"Update downloaded and verified","Open Settings in ParcelBridge to install") } finally { running=false }
        }
    }
    private fun download(activity:Activity,api:Api,manifest:JSONObject) {
        if(running) return
        running=true; toast(activity,"Downloading update…")
        executor.execute {
            try { save(activity,api,manifest); activity.runOnUiThread { if(!activity.isDestroyed) AlertDialog.Builder(activity).setTitle("Update verified").setMessage("Install the new version now?").setNegativeButton("Later",null).setPositiveButton("Install") { _,_ -> try { install(activity,api) } catch(e:Exception) { toast(activity,e.message ?: "Installation failed") } }.show() } }
            catch(e:Exception) { activity.runOnUiThread { toast(activity,e.message ?: "Update download failed") } }
            finally { running=false }
        }
    }
    private fun save(context:Context,api:Api,manifest:JSONObject) {
        val url=URL(manifest.getString("apkUrl")); val repo=api.obj("/v1/config").getString("github_repository")
        require(repo.matches(Regex("[\\w.-]+/[\\w.-]+")) && url.toString().startsWith("https://github.com/$repo/releases/download/") && url.toString().endsWith("/parcelbridge.apk")) { "Untrusted update URL" }
        require(manifest.getInt("versionCode")>BuildConfig.VERSION_CODE && manifest.getString("sha256").matches(Regex("[a-f0-9]{64}"))) { "Invalid update manifest" }
        val dir=File(context.filesDir,"updates").apply { mkdirs() }; val partial=File(dir,"download.part")
        val conn=url.openConnection() as HttpURLConnection; conn.connectTimeout=20000; conn.readTimeout=30000
        try {
            require(conn.responseCode==200 && conn.url.protocol=="https") { "Update download failed" }
            val hash=MessageDigest.getInstance("SHA-256"); var total=0L
            conn.inputStream.use { source -> partial.outputStream().use { sink ->
                val buffer=ByteArray(32768)
                while(true) { val count=source.read(buffer); if(count<0) break; total+=count; require(total<=100*1024*1024) { "Update exceeds download limit" }; hash.update(buffer,0,count); sink.write(buffer,0,count) }
            } }
            require(hash.digest().joinToString("") { "%02x".format(it) }==manifest.getString("sha256")) { "Update checksum does not match" }
            verifyPackage(context,partial,manifest.getInt("versionCode"))
            val destination=File(dir,"parcelbridge.apk"); require(!destination.exists() || destination.delete()) { "Cannot replace old update" }; require(partial.renameTo(destination)) { "Cannot save update" }
            api.prefs.edit().putString("update_manifest",manifest.toString()).apply()
        } finally { conn.disconnect(); partial.delete() }
    }
    @Suppress("DEPRECATION") private fun verifyPackage(context:Context,file:File,version:Int) {
        val flags=if(android.os.Build.VERSION.SDK_INT>=28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val installed=context.packageManager.getPackageInfo(context.packageName,flags)
        val update=context.packageManager.getPackageArchiveInfo(file.absolutePath,flags) ?: error("Downloaded file is not an Android package")
        require(update.packageName==context.packageName) { "Update is for a different app" }
        val code=if(android.os.Build.VERSION.SDK_INT>=28) update.longVersionCode else update.versionCode.toLong()
        require(code==version.toLong() && code>BuildConfig.VERSION_CODE) { "Update version does not match" }
        val existing=if(android.os.Build.VERSION.SDK_INT>=28) installed.signingInfo!!.apkContentsSigners else installed.signatures!!
        val incoming=if(android.os.Build.VERSION.SDK_INT>=28) update.signingInfo!!.apkContentsSigners else update.signatures!!
        require(existing.map { it.toCharsString() }.toSet()==incoming.map { it.toCharsString() }.toSet()) { "Update signing certificate does not match" }
    }
    private fun install(activity:Activity,api:Api) {
        val file=File(activity.filesDir,"updates/parcelbridge.apk"); val manifest=JSONObject(api.prefs.getString("update_manifest","{}")!!)
        require(file.exists()) { "Download the update first" }; verifyPackage(activity,file,manifest.getInt("versionCode"))
        if(!activity.packageManager.canRequestPackageInstalls()) { activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:${activity.packageName}"))); toast(activity,"Allow updates from ParcelBridge, then tap Install again"); return }
        val uri=FileProvider.getUriForFile(activity,"${activity.packageName}.updates",file)
        activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
    fun resume(activity:Activity) {}
    fun result(activity:Activity,request:Int,result:Int) {}
    private fun toast(context:Context,message:String) { Toast.makeText(context,message,Toast.LENGTH_LONG).show() }
}
