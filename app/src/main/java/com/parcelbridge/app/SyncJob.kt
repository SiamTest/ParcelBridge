package com.parcelbridge.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.util.concurrent.Executors

class SyncJob : JobService() {
    private val executor=Executors.newSingleThreadExecutor()
    override fun onStartJob(params:JobParameters):Boolean {
        executor.execute {
            val api=Api(this)
            try {
                if(api.token.isNotEmpty() && api.base.isNotEmpty()) {
                    val rows=api.array("/v1/orders").objects()
                    val previous=JSONObject(api.prefs.getString("statuses","{}")!!)
                    val current=JSONObject()
                    rows.forEach { o ->
                        val id=o.getString("id"); val status=o.getString("status")
                        current.put(id,status)
                        if(previous.has(id) && previous.optString(id)!=status) notify(this,id.hashCode(),"Delivery ${status.replace('_',' ')}","${o.getString("pickup_area")} → ${o.getString("dropoff_area")}")
                    }
                    api.prefs.edit().putString("statuses",current.toString()).apply()
                }
                Updates.background(this,api)
            } catch (_:Exception) { /* Retry on the next scheduled sync. */ }
            jobFinished(params,false)
        }
        return true
    }
    override fun onStopJob(params:JobParameters)=true
    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
    companion object {
        fun schedule(context:Context) {
            (context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).schedule(JobInfo.Builder(101,ComponentName(context,SyncJob::class.java)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).setPersisted(true).build())
        }
        fun notify(context:Context,id:Int,title:String,message:String) {
            if(!Api(context).prefs.getBoolean("notifications",true)) return
            val manager=context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(NotificationChannel("deliveries","Deliveries and app updates",NotificationManager.IMPORTANCE_DEFAULT))
            val intent=PendingIntent.getActivity(context,0,Intent(context,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification=Notification.Builder(context,"deliveries").setSmallIcon(R.drawable.ic_parcel).setContentTitle(title).setContentText(message).setContentIntent(intent).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build()
            try { manager.notify(id,notification) } catch (_:SecurityException) { /* User controls notification permission. */ }
        }
    }
}
