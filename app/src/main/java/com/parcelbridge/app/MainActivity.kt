package com.parcelbridge.app

import android.Manifest
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import com.google.android.material.textfield.MaterialAutoCompleteTextView
import android.content.Intent
import android.util.Log
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var api: Api
    private lateinit var content: LinearLayout
    private lateinit var ui: ExpressiveUi
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var account = JSONObject()
    private var orderId: String? = null
    private var currentPage = ""
    private var pageGeneration = 0
    private var locationListener: LocationListener? = null
    private var busy = false
    private val tick = object : Runnable {
        override fun run() {
            if (currentPage == "order" && !busy && orderId != null && api.token.isNotEmpty()) {
                val target = orderId!!
                background({ api.obj("/v1/orders/$target") }) { o ->
                    if (currentPage == "order" && orderId == target) {
                        findViewById<TextView>(R.id.delivery_status)?.text = "Status: ${o.getString("status").replace('_',' ')}"
                        if (account.optString("role") == "rider" && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && o.optString("status") !in listOf("delivered","returned","cancelled")) {
                            location { lat,lng -> background({ api.post("/v1/orders/$target/location", json("lat" to lat,"lng" to lng)) }) {} }
                        }
                    }
                }
            }
            handler.postDelayed(this,30000)
        }
    }
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        api = Api(this)
        ui = ExpressiveUi(this)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { navigateBack() }
        })
        // A corrupted or partially migrated profile must not terminate app startup.
        account = runCatching {
            JSONObject(api.prefs.getString("user", "{}") ?: "{}")
        }.getOrElse { problem ->
            Log.w("ParcelBridge", "Saved account metadata is invalid; retaining it for recovery", problem)
            JSONObject()
        }
        try {
            if (api.token.isEmpty()) auth() else home()
        } catch (problem: Exception) {
            CrashDiagnostics.record(this, problem)
            showStartupRecovery(problem)
        }
        // These operations are optional. Neither should prevent the main screen opening.
        runCatching { SyncJob.schedule(this) }
            .onFailure { Log.w("ParcelBridge", "Periodic sync could not be scheduled", it) }
        runCatching { Updates.check(this, api, false) }
            .onFailure { Log.w("ParcelBridge", "Update check could not start", it) }
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            runCatching { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 9) }
                .onFailure { Log.w("ParcelBridge", "Notification permission prompt unavailable", it) }
        }
    }
    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(tick)
        handler.postDelayed(tick, 30000)
        runCatching { Updates.resume(this) }
            .onFailure { Log.w("ParcelBridge", "Update resume failed", it) }
    }
    override fun onPause() { handler.removeCallbacks(tick); super.onPause() }
    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        locationListener?.let { (getSystemService(LOCATION_SERVICE) as LocationManager).removeUpdates(it) }
        executor.shutdownNow(); super.onDestroy()
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) { super.onActivityResult(requestCode,resultCode,data); Updates.result(this,requestCode,resultCode) }
    private fun navigateBack() { if(busy) { toast("Please wait for this request to finish"); return }; if (currentPage == "home" || currentPage == "auth" || currentPage == "recovery") finish() else if (api.token.isEmpty()) auth() else home() }

    /** Minimal platform UI if the Material interface fails during construction. */
    private fun showStartupRecovery(problem: Exception) {
        pageGeneration++
        busy = false
        currentPage = "recovery"
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val gap = dp(24)
            setPadding(gap, gap, gap, gap)
        }
        layout.addView(TextView(this).apply {
            text = "ParcelBridge couldn't open its interface"
            textSize = 22f
        })
        layout.addView(TextView(this).apply {
            text = "Your saved account and deliveries have not been erased. Copy the crash report and share it with the developer."
            setPadding(0, dp(12), 0, dp(20))
        })
        layout.addView(Button(this).apply {
            text = "Copy crash report"
            setOnClickListener {
                toast(if (CrashDiagnostics.copy(this@MainActivity)) "Crash report copied" else "No crash report is available")
            }
        })
        layout.addView(Button(this).apply {
            text = "Retry"
            setOnClickListener {
                try { if (api.token.isEmpty()) auth() else home() }
                catch (error: Exception) {
                    CrashDiagnostics.record(this@MainActivity, error)
                    toast("Still unable to open: ${error.javaClass.simpleName}")
                }
            }
        })
        setContentView(layout)
        Log.e("ParcelBridge", "Startup screen failed: ${problem.javaClass.simpleName}", problem)
    }
    private fun dp(value: Int) = (value*resources.displayMetrics.density).toInt()
    private fun page(title: String, key: String) {
        pageGeneration++
        currentPage = key
        content = ui.page(title, key, api.token.isNotEmpty(), { destination ->
            if (busy) false else {
                when (destination) { "orders" -> orders(); "settings" -> settings(); else -> home() }
                true
            }
        }, ::navigateBack)
    }
    private fun label(value: String, big: Boolean = false): TextView = ui.info(content, value, big)
    private fun button(value: String, primary: Boolean = false, action: () -> Unit): Button = ui.button(content, value, primary) {
        if (!busy) try { action() } catch (e: Exception) { toast(e.message ?: "Check your entries") }
    }
    private fun field(name: String, value: String = "", type: Int = InputType.TYPE_CLASS_TEXT): EditText = ui.field(content, name, value, type)
    private fun choose(name: String, values: List<String>): MaterialAutoCompleteTextView = ui.choice(content, name, values)
    private fun toast(message:String) { Toast.makeText(this,message,Toast.LENGTH_LONG).show() }
    private fun offlineNotice() { if(api.offline) label("Offline: showing saved information. Connect before changing a delivery.") }
    private fun <T> background(work: () -> T, success: (T) -> Unit) {
        if(busy) return
        busy=true
        val origin=pageGeneration
        val parent=content
        val progress=ui.progress()
        parent.addView(progress,0)
        executor.execute {
            try {
                val result = work()
                runOnUiThread {
                    parent.removeView(progress)
                    busy = false
                    if (!isDestroyed && pageGeneration == origin) {
                        // API callbacks may throw on unexpected payloads. Never crash
                        // the entire app from a background-response UI update.
                        try { success(result) }
                        catch (problem: Exception) {
                            CrashDiagnostics.record(this, problem)
                            toast("Unable to display server response. A diagnostic report was saved.")
                        }
                    }
                }
            } catch (problem: Exception) {
                runOnUiThread {
                    parent.removeView(progress)
                    busy = false
                    if (!isDestroyed && pageGeneration == origin) {
                        toast(problem.message ?: "Please try again")
                        if (api.token.isEmpty() && account.length() > 0) {
                            account = JSONObject()
                            try { auth() }
                            catch (error: Exception) {
                                CrashDiagnostics.record(this, error)
                                showStartupRecovery(error)
                            }
                        }
                    }
                }
            }
        }
    }
    private fun persistAccount(user:JSONObject) { account=user; api.prefs.edit().putString("user",user.toString()).apply() }
    private fun auth(register:Boolean=false) {
        page(if(register) "Create your account" else "Welcome back","auth")
        label("Deliver locally. Keep your shop moving.",true)
        if(api.base.isEmpty()) { label("Connect this app to your ParcelBridge server first."); button("Set server address") { settings() }; return }
        val name=if(register) field("Your name") else null
        val phone=if(register) field("Bangladesh mobile number",type=InputType.TYPE_CLASS_PHONE) else null
        val email=field("Email",type=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val password=field("Password · at least 10 characters",type=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        val role=if(register) choose("I am a",listOf("seller","rider")) else null
        button(if(register) "Create account" else "Sign in", primary=true) {
            val b=json("email" to email.text.toString(),"password" to password.text.toString())
            if(register) { b.put("name",name!!.text.toString()); b.put("phone",phone!!.text.toString()); b.put("role",role!!.text.toString()) }
            background({ api.post("/v1/auth/${if(register) "register" else "login"}",b) }) { api.token=it.getString("token"); persistAccount(it.getJSONObject("user")); home() }
        }
        button(if(register) "Already registered? Sign in" else "Create a seller or rider account") { auth(!register) }
        button("Settings") { settings() }
        label("Riders must be approved by ParcelBridge before accepting jobs. This pilot uses email and password sign-in.")
    }
    private fun home() {
        page("Your delivery desk","home")
        label("Hello, ${account.optString("name")}",true)
        val role=account.optString("role")
        if(role=="seller") { button("Book a delivery", primary=true) { booking() }; button("Saved pickup addresses") { addresses() }; button("Preferred riders") { riders() } }
        if(role=="rider") {
            label(if(account.optInt("approved")==1) "Rider account approved" else "Your account is awaiting operator approval")
            button("Go online and find nearby jobs", primary=true) { location { lat,lng -> background({ api.post("/v1/me/availability",json("online" to 1,"lat" to lat,"lng" to lng)) }) { persistAccount(account.put("online",1)); jobs() } } }
            button("Go offline") { background({ api.post("/v1/me/availability",json("online" to 0,"lat" to 23.0144,"lng" to 91.3966)) }) { persistAccount(account.put("online",0)); toast("You are offline") } }
            button("Nearby jobs") { jobs() }
        }
        if(role=="admin") button("Operator tools", primary=true) { admin() }
        button("Delivery history") { orders() }; button("Help and support") { tickets() }
        background({ val me=api.obj("/v1/me",true); val s=api.obj("/v1/summary",true); me to s }) { (me,s) ->
            persistAccount(me); offlineNotice()
            label("${s.optInt("delivered")} delivered · ${s.optInt("total")} total",true)
            if(role=="rider") label("Recorded delivery earnings: ${money(s.optLong("earnings_minor"))}")
            label("COD awaiting recorded settlement: ${money(s.optLong("cod_pending_minor"))}")
            label("Delivery earnings and COD records are separate. Payments are handled by your operator.")
        }
    }
    private fun booking(saved:JSONObject?=null, preferredId:String="") {
        page("Book a delivery","booking")
        label("Feni service area only. Confirm the address and coordinates before booking.")
        val pickupArea=field("Pickup area / neighbourhood",saved?.optString("label") ?: "")
        val pickup=field("Full pickup address",saved?.optString("address") ?: "")
        val plat=field("Pickup latitude",saved?.optString("lat") ?: "",8194)
        val plng=field("Pickup longitude",saved?.optString("lng") ?: "",8194)
        button("Use my current location for pickup") { location { lat,lng -> plat.setText(lat.toString()); plng.setText(lng.toString()) } }
        button("Find pickup coordinates from address") { geocode(pickup.text.toString(),plat,plng) }
        val dropArea=field("Delivery area / neighbourhood")
        val drop=field("Full delivery address")
        val dlat=field("Delivery latitude",type=8194); val dlng=field("Delivery longitude",type=8194)
        button("Find delivery coordinates from address") { geocode(drop.text.toString(),dlat,dlng) }
        val name=field("Recipient name"); val phone=field("Recipient mobile",type=InputType.TYPE_CLASS_PHONE)
        val size=choose("Package size",listOf("small","medium","large"))
        val instructions=field("Instructions (optional)")
        val cod=field("Cash to collect for your product (BDT)","0",8194)
        val schedule=field("Pickup time (optional) · yyyy-MM-dd HH:mm, Dhaka time")
        val preferred=field("Preferred rider ID (optional, from Preferred riders)",preferredId)
        label("Rates use a straight-line distance estimate and package size. Check the server’s final quote before booking.")
        val requestId=UUID.randomUUID().toString()
        fun data(): JSONObject {
            require(schedule.text.isBlank() || schedule.text.toString().matches(Regex("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"))) { "Use yyyy-MM-dd HH:mm for pickup time" }
            val timestamp=if(schedule.text.isBlank()) System.currentTimeMillis()/1000 else SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.US).apply { isLenient=false; timeZone=TimeZone.getTimeZone("Asia/Dhaka") }.parse(schedule.text.toString())!!.time/1000
            return json("request_id" to requestId,"pickup_area" to pickupArea.text.toString(),"pickup_address" to pickup.text.toString(),"pickup_lat" to plat.text.toString().toDouble(),"pickup_lng" to plng.text.toString().toDouble(),"dropoff_area" to dropArea.text.toString(),"dropoff_address" to drop.text.toString(),"dropoff_lat" to dlat.text.toString().toDouble(),"dropoff_lng" to dlng.text.toString().toDouble(),"recipient_name" to name.text.toString(),"recipient_phone" to phone.text.toString(),"size" to size.text.toString(),"instructions" to instructions.text.toString(),"cod_minor" to minorAmount(cod.text.toString()),"scheduled_at" to timestamp,"preferred_rider_id" to preferred.text.toString())
        }
        button("Get price and confirm booking", primary=true) {
            val b=data()
            background({ api.post("/v1/quote",b) }) { q ->
                ExpressiveDialogBuilder(this).setTitle("Confirm delivery")
                    .setMessage("Delivery fee: ${money(q.getLong("fee_minor"),q.getString("currency"))}\nEstimated distance: ${q.getDouble("distance_km")} km\nPickup: ${date(b.getLong("scheduled_at"))}\nProduct cash to collect: ${money(b.getLong("cod_minor"))}\n\nDelivery charges are separate from product COD. Confirm addresses and parcel details.")
                    .setNegativeButton("Edit",null).setPositiveButton("Book") { _,_ -> background({ api.post("/v1/orders",b) }) { order(it.getString("id")) } }.show()
            }
        }
    }
    private fun orders(offset:Int=0) {
        page("Delivery history","orders")
        background({ api.array("/v1/orders?offset=$offset",true) }) { rows ->
            offlineNotice(); if(rows.length()==0) label("No deliveries yet.")
            val search=field("Search these deliveries by area or status")
            button("Apply search") { showOrderRows(rows,search.text.toString()) }
            showOrderRows(rows,"")
            if(rows.length()==100) button("Next 100 deliveries") { orders(offset+100) }
            if(offset>0) button("Previous page") { orders((offset-100).coerceAtLeast(0)) }
            button("Share this page as CSV") {
                val csv="ID,Status,Pickup area,Delivery area,Fee minor,COD minor\n"+rows.objects().joinToString("\n") { o -> listOf("id","status","pickup_area","dropoff_area","fee_minor","cod_minor").joinToString(",") { key -> val value=o.optString(key).let { if(it.startsWith("=") || it.startsWith("+") || it.startsWith("-") || it.startsWith("@")) "'$it" else it }; "\"${value.replace("\"","\"\"")}\"" } }
                share(csv)
            }
        }
    }
    private var orderRows: LinearLayout?=null
    private fun showOrderRows(rows:JSONArray,query:String) {
        orderRows?.let { if(it.parent===content) content.removeView(it) }
        val container=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL }
        rows.objects().filter { query.isBlank() || it.toString().contains(query,true) }.forEach { o ->
            ui.button(container, "${o.getString("pickup_area")} → ${o.getString("dropoff_area")}\n${o.getString("status").replace('_',' ')} · ${money(o.getLong("fee_minor"))}") { if(!busy) order(o.getString("id")) }
        }
        orderRows=container; content.addView(container)
    }
    private fun jobs() {
        page("Nearby rider jobs","jobs")
        label("Refresh location by going online again after one hour. Preferred riders get the first five minutes to accept.")
        button("Refresh") { jobs() }
        background({ api.array("/v1/jobs") }) { rows ->
            if(rows.length()==0) label("No nearby jobs at the moment.")
            rows.objects().forEach { o ->
                label("${o.getString("pickup_area")} → ${o.getString("dropoff_area")}",true)
                label("${o.optDouble("distance_km")} km to pickup · ${o.getString("size")} parcel\nYour pay: ${money(o.getLong("rider_pay_minor"))}\nCash responsibility: ${money(o.getLong("cod_minor"))}\nPickup: ${date(o.getLong("scheduled_at"))}")
                button("Accept delivery", primary=true) { background({ api.post("/v1/orders/${o.getString("id")}/accept") }) { order(o.getString("id")) } }
            }
        }
    }
    private fun order(target:String) {
        orderId=target; page("Delivery details","order")
        background({ api.obj("/v1/orders/$target",true) }) { o ->
            offlineNotice()
            label("Status: ${o.getString("status").replace('_',' ')}",true).id=R.id.delivery_status
            label("Order $target\nPickup: ${date(o.getLong("scheduled_at"))}\n${o.getString("pickup_address")}\n↓\n${o.getString("dropoff_address")}")
            label("Recipient: ${o.getString("recipient_name")}\nDelivery fee: ${money(o.getLong("fee_minor"))}\nProduct COD: ${money(o.getLong("cod_minor"))}\nCOD settlement: ${if(o.isNull("cod_settled_at")) "pending / not applicable" else date(o.getLong("cod_settled_at"))}")
            if(o.optString("instructions").isNotBlank()) label("Instructions: ${o.getString("instructions")}")
            button("Refresh delivery") { order(target) }
            val seller=account.optString("role")=="seller"
            if(seller) {
                label("Pickup code: ${o.getString("pickup_code")}\nDelivery code: ${o.getString("delivery_code")}",true)
                label("Give the pickup code to the rider at handover. Send the delivery code privately to your customer.")
                button("Share tracking link with customer") { share("Track your ParcelBridge delivery: ${o.getString("tracking_url")}") }
                button("Share customer delivery code") { share("Your ParcelBridge delivery confirmation code is ${o.getString("delivery_code")}. Give it to the rider only after receiving your parcel. Product COD: ${money(o.getLong("cod_minor"))}") }
                if(o.getString("status")=="pending") button("Cancel delivery") { confirm("Cancel this delivery?") { step(target,"cancel") } }
                if(o.getString("status")=="delivered") button("Rate this delivery") { rating(target) }
            }
            if(account.optString("role")=="rider") {
                button("Call recipient") { open("tel:${o.getString("recipient_phone")}") }
                if(!o.isNull("seller_phone")) button("Call seller") { open("tel:${o.getString("seller_phone")}") }
                button("Navigate to pickup") { open("https://www.google.com/maps/dir/?api=1&destination=${o.getDouble("pickup_lat")},${o.getDouble("pickup_lng")}") }
                button("Navigate to customer") { open("https://www.google.com/maps/dir/?api=1&destination=${o.getDouble("dropoff_lat")},${o.getDouble("dropoff_lng")}") }
                if(o.getString("status") !in listOf("delivered","returned","cancelled")) button("Share my current location") { location { lat,lng -> background({ api.post("/v1/orders/$target/location",json("lat" to lat,"lng" to lng)) }) { toast("Location shared") } } }
                when(o.getString("status")) {
                    "accepted" -> { button("Confirm pickup with seller code") { codeDialog(target,"pickup",0) }; button("Release job") { confirm("Release this job for another rider?") { step(target,"release") } } }
                    "picked_up" -> { button("Complete delivery with customer code") { codeDialog(target,"deliver",o.getLong("cod_minor")) }; button("Report failed delivery") { noteDialog(target,"fail") } }
                    "failed" -> { button("Retry delivery") { step(target,"retry") }; button("Start return to seller") { noteDialog(target,"return") } }
                    "returning" -> button("Confirm return with seller code") { codeDialog(target,"returned",0) }
                }
            }
            if(!o.isNull("rider_id")) button("Delivery chat") { chat(target) }
            button("Get help with this delivery") { newTicket(target) }
            label("Delivery timeline",true)
            o.getJSONArray("events").objects().forEach { event -> label("${date(event.getLong("created_at"))}\n${event.getString("status")} · ${event.getString("note")}") }
            if(account.optString("role")=="admin") {
                button("Unlock confirmation attempts") { background({ api.post("/v1/admin/unlock",json("order_id" to target)) }) { toast("Codes unlocked") } }
                if(o.getString("status")=="delivered" && o.getLong("cod_minor")>0 && o.isNull("cod_settled_at")) button("Record COD paid to seller") { confirm("Confirm this cash has actually been paid to the seller. This records settlement; it does not move money.") { background({ api.post("/v1/admin/settle",json("order_id" to target)) }) { order(target) } } }
            }
        }
    }
    private fun step(target:String,action:String,code:String="",note:String="",cash:Long=0) { background({ api.post("/v1/orders/$target/transition",json("action" to action,"code" to code,"note" to note,"cod_collected_minor" to cash)) }) { order(target) } }
    private fun codeDialog(target: String, action: String, cash: Long) {
        val form = ui.form()
        ui.info(form, if (action == "deliver") "Receive the parcel confirmation code. Collect ${money(cash)} for the product before completing." else "Enter the seller’s six-digit pickup code.")
        val code = ui.field(form, "Confirmation code", "", InputType.TYPE_CLASS_NUMBER)
        val cashField = if (action == "deliver") ui.field(form, "Product cash actually collected in BDT", if (cash == 0L) "0" else "", 8194) else null
        val dialog = ExpressiveDialogBuilder(this).setTitle("Confirm ${action.replace('_', ' ')}")
            .setView(ui.dialogContent(form)).setNegativeButton("Cancel", null).setPositiveButton("Confirm", null).create()
        dialog.setOnShowListener {
            ExpressiveMotion.dialogShown(dialog)
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                try {
                    val received = cashField?.let { minorAmount(it.text.toString()) } ?: 0L
                    if (action == "deliver") require(received == cash) { "Collect the exact expected COD amount" }
                    val value = code.text.toString()
                    require(value.matches(Regex("""\d{6}"""))) { "Enter six digits" }
                    dialog.dismiss(); step(target, action, value, cash = received)
                } catch (e: Exception) { toast(e.message ?: "Check amount") }
            }
        }
        dialog.show()
    }
    private fun noteDialog(target: String, action: String) {
        val form = ui.form()
        val input = ui.field(form, "Explain the problem", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE)
        ExpressiveDialogBuilder(this).setTitle("Delivery problem").setView(ui.dialogContent(form))
            .setNegativeButton("Cancel", null).setPositiveButton("Submit") { _, _ -> step(target, action, note = input.text.toString()) }.show()
    }
    private fun chat(target:String) {
        page("Delivery chat","chat")
        background({ api.array("/v1/orders/$target/messages",true) }) { rows ->
            offlineNotice(); rows.objects().forEach { label("${if(it.getString("sender_id")==account.optString("id")) "You" else "Partner"}: ${it.getString("text")}\n${date(it.getLong("created_at"))}") }
            val message=field("Message"); button("Send", primary=true) { background({ api.post("/v1/orders/$target/messages",json("text" to message.text.toString())) }) { chat(target) } }
            button("Refresh messages") { chat(target) }; button("Back to delivery") { order(target) }
        }
    }
    private fun rating(target:String) { page("Rate your delivery","rating"); val stars=choose("Stars",listOf("5","4","3","2","1")); val comment=field("Comment (optional)"); button("Save rating", primary=true) { background({ api.post("/v1/orders/$target/rating",json("stars" to stars.text.toString().toInt(),"comment" to comment.text.toString())) }) { order(target) } } }
    private fun addresses() {
        page("Saved addresses","addresses")
        background({ api.array("/v1/addresses",true) }) { rows ->
            offlineNotice(); rows.objects().forEach { a -> label("${a.getString("label")}\n${a.getString("address")}"); button("Book from ${a.getString("label")}") { booking(a) }; button("Remove ${a.getString("label")}") { background({ api.request("/v1/addresses/${a.getString("id")}","DELETE") }) { addresses() } } }
            val name=field("Area / label"); val address=field("Full address"); val lat=field("Latitude",type=8194); val lng=field("Longitude",type=8194)
            button("Use current location") { location { x,y -> lat.setText(x.toString()); lng.setText(y.toString()) } }
            button("Save address", primary=true) { val b=json("label" to name.text.toString(),"address" to address.text.toString(),"lat" to lat.text.toString().toDouble(),"lng" to lng.text.toString().toDouble()); background({ api.post("/v1/addresses",b) }) { addresses() } }
        }
    }
    private fun riders() {
        page("Preferred riders","riders")
        background({ api.array("/v1/riders",true) }) { rows -> offlineNotice(); rows.objects().forEach { r -> label("${r.getString("name")} · ${if(r.optInt("online")==1) "online" else "offline"}\nRating: ${r.optDouble("rating")} (${r.optInt("deliveries")} ratings)\nRider ID: ${r.getString("id")}"); button(if(r.optInt("favorite")==1) "Remove favourite" else "Add favourite") { background({ api.request("/v1/favorites/${r.getString("id")}",if(r.optInt("favorite")==1) "DELETE" else "POST",if(r.optInt("favorite")==1) null else JSONObject()) }) { riders() } }; button("Book with this rider") { booking(preferredId=r.getString("id")) } } }
    }
    private fun tickets() { page("Help and support","tickets"); button("Create support request") { newTicket() }; background({ api.array("/v1/tickets",true) }) { rows -> offlineNotice(); rows.objects().forEach { t -> label("${t.getString("subject")} · ${t.getString("status")}\n${t.getString("message")}\n${t.optString("reply")}"); if(account.optString("role")=="admin") button("Reply to ticket") { replyTicket(t.getString("id")) } } } }
    private fun newTicket(target:String="") { page("Ask for help","newticket"); val subject=field("Subject"); val message=field("Describe the issue"); button("Send support request", primary=true) { background({ api.post("/v1/tickets",json("order_id" to target,"subject" to subject.text.toString(),"message" to message.text.toString())) }) { tickets() } } }
    private fun replyTicket(target:String) { page("Support reply","reply"); val reply=field("Reply"); val status=choose("Status",listOf("resolved","open")); button("Save reply", primary=true) { background({ api.post("/v1/admin/ticket",json("ticket_id" to target,"reply" to reply.text.toString(),"status" to status.text.toString())) }) { tickets() } } }
    private fun admin() {
        page("Operator tools","admin"); button("All deliveries and COD") { orders() }; button("Support tickets") { tickets() }
        background({ api.array("/v1/admin/users") }) { rows -> rows.objects().filter { it.optString("role")!="admin" }.forEach { u ->
            label("${u.getString("name")} · ${u.getString("role")}\n${u.getString("phone")}\nApproved: ${u.getInt("approved")} · Blocked: ${u.getInt("blocked")}")
            button("Approve / unblock") { background({ api.post("/v1/admin/user",json("user_id" to u.getString("id"),"approved" to 1,"blocked" to 0)) }) { admin() } }
            button("Block account") { confirm("Block this account and revoke its sessions?") { background({ api.post("/v1/admin/user",json("user_id" to u.getString("id"),"approved" to u.getInt("approved"),"blocked" to 1)) }) { admin() } } }
        } }
    }
    private fun settings() {
        page("Settings","settings")
        label("ParcelBridge ${BuildConfig.VERSION_NAME} · ${BuildConfig.FLAVOR}")
        if (CrashDiagnostics.lastReport(this) != null) {
            button("Copy last crash report") {
                if (CrashDiagnostics.copy(this)) toast("Crash report copied")
            }
            button("Clear saved crash report") {
                CrashDiagnostics.clear(this)
                settings()
            }
        }
        val server=field("ParcelBridge HTTPS API address",api.base)
        button("Save server address", primary=true) { api.base=server.text.toString(); account=JSONObject(); auth() }
        val uiPreferences = getSharedPreferences("parcelbridge_ui", MODE_PRIVATE)
        ui.preference(content, "Reduce motion", uiPreferences.getBoolean("reduce_motion", false)) { checked ->
            uiPreferences.edit().putBoolean("reduce_motion", checked).apply()
        }
        Updates.settings(this,api,content)
        button("Check for app update") { Updates.check(this,api,true) }
        if(api.token.isNotEmpty()) {
            ui.preference(content, "Delivery and update notifications", api.prefs.getBoolean("notifications", true)) { checked -> api.prefs.edit().putBoolean("notifications", checked).apply() }
            button("Change password") { password() }
            button("Sign out") { background({ api.post("/v1/auth/logout") }) { api.logout(); account=JSONObject(); auth() } }
            button("Clear session on this device") { api.logout(); account=JSONObject(); auth() }
        }
        label("Location is shared only during active delivery use. Background notifications depend on Android scheduling and notification permission. Keep customer details private.")
    }
    private fun password() { page("Change password","password"); val old=field("Current password",type=129); val next=field("New password · at least 10 characters",type=129); button("Change password and sign out everywhere") { background({ api.post("/v1/me/password",json("current_password" to old.text.toString(),"new_password" to next.text.toString())) }) { api.logout(); account=JSONObject(); auth() } } }
    private fun geocode(address:String,lat:EditText,lng:EditText) {
        require(address.isNotBlank()) { "Enter the address first" }
        background({ @Suppress("DEPRECATION") val matches=Geocoder(this,Locale.ENGLISH).getFromLocationName("$address, Feni, Bangladesh",3); matches?.firstOrNull() ?: throw ApiError("Address lookup failed. Enter coordinates from a map.") }) { result -> lat.setText(result.latitude.toString()); lng.setText(result.longitude.toString()); toast("Check the coordinates match the actual address") }
    }
    private fun location(callback:(Double,Double)->Unit) {
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED) { requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),7); toast("Allow location, then tap this action again"); return }
        val manager=getSystemService(LOCATION_SERVICE) as LocationManager
        val precise=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
        val provider=if(precise && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
        if(!manager.isProviderEnabled(provider)) { toast("Enable location in Android settings"); return }
        locationListener?.let { manager.removeUpdates(it) }
        val listener=object:LocationListener {
            override fun onLocationChanged(value:Location) { manager.removeUpdates(this); if(locationListener!==this) return; locationListener=null; if(value.accuracy>500) toast("Location is approximate; check addresses carefully"); callback(value.latitude,value.longitude) }
            override fun onProviderEnabled(provider:String) {}
            override fun onProviderDisabled(provider:String) {}
            @Deprecated("Legacy location callback") override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?) {}
        }
        locationListener=listener
        manager.requestLocationUpdates(provider,0L,0f,listener,Looper.getMainLooper())
        handler.postDelayed({ if(locationListener===listener) { manager.removeUpdates(listener); locationListener=null; toast("Could not get a fresh location. Try outdoors or enable precise location.") } },25000)
    }
    private fun confirm(message:String,action:()->Unit) { ExpressiveDialogBuilder(this).setMessage(message).setNegativeButton("Cancel",null).setPositiveButton("Confirm") { _,_ -> action() }.show() }
    private fun share(text:String) { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type="text/plain"; putExtra(Intent.EXTRA_TEXT,text) },"Share")) }
    private fun open(url:String) { startActivity(Intent(if(url.startsWith("tel:")) Intent.ACTION_DIAL else Intent.ACTION_VIEW,Uri.parse(url))) }
    private fun date(seconds:Long) = SimpleDateFormat("dd MMM, HH:mm",Locale.ENGLISH).apply { timeZone=TimeZone.getTimeZone("Asia/Dhaka") }.format(java.util.Date(seconds*1000))
}
