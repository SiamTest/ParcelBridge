package com.parcelbridge.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.widget.LinearLayout
import android.widget.Toast
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

object Updates {
    private var manager:AppUpdateManager?=null
    fun check(activity:Activity,api:Api,manual:Boolean) {
        val update=AppUpdateManagerFactory.create(activity); manager=update
        update.appUpdateInfo.addOnSuccessListener { info ->
            if(activity.isDestroyed) return@addOnSuccessListener
            if(info.installStatus()==InstallStatus.DOWNLOADED) { complete(activity,update); return@addOnSuccessListener }
            if(info.updateAvailability()==UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                update.registerListener { state -> if(state.installStatus()==InstallStatus.DOWNLOADED && !activity.isDestroyed) complete(activity,update) }
                @Suppress("DEPRECATION") update.startUpdateFlowForResult(info,activity,AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),700)
            } else if(manual) Toast.makeText(activity,"No Play update available for this account",Toast.LENGTH_LONG).show()
        }.addOnFailureListener { if(manual) Toast.makeText(activity,"Play updates require installation from a Play test or production track",Toast.LENGTH_LONG).show() }
    }
    private fun complete(activity:Activity,update:AppUpdateManager) { AlertDialog.Builder(activity).setTitle("Update ready").setMessage("Restart ParcelBridge to finish installing the update?").setNegativeButton("Later",null).setPositiveButton("Restart") { _,_ -> update.completeUpdate() }.show() }
    fun resume(activity:Activity) { manager?.appUpdateInfo?.addOnSuccessListener { if(it.installStatus()==InstallStatus.DOWNLOADED && !activity.isDestroyed) manager?.let { m -> complete(activity,m) } } }
    fun result(activity:Activity,request:Int,result:Int) { if(request==700 && result!=Activity.RESULT_OK) Toast.makeText(activity,"Update postponed. Check again in Settings.",Toast.LENGTH_LONG).show() }
    fun settings(activity:Activity,api:Api,content:LinearLayout) {}
    fun background(context:Context,api:Api) { /* Play manages background delivery of Play-distributed updates. */ }
}
