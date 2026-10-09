package com.parcelbridge.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class Api(private val context: Context) {
    val prefs = context.getSharedPreferences("parcelbridge", Context.MODE_PRIVATE)
    var offline = false
    /** No server hostname is compiled into the APK. The host is paired at runtime. */
    val base: String
        get() {
            val encrypted = prefs.getString("endpoint_secure", null)
            if (encrypted != null) return runCatching { decrypt(encrypted) }.getOrDefault("")
            // Previous releases saved manually entered endpoints as plain preferences.
            // Encrypt before removing the legacy value; never clear sessions during migration.
            val legacy = prefs.getString("api", null) ?: return ""
            return try {
                validateOrigin(legacy)
                val sealed = encrypt(legacy.trim().trimEnd('/'))
                check(prefs.edit().putString("endpoint_secure", sealed).remove("api").commit())
                legacy.trim().trimEnd('/')
            } catch (_: Exception) { "" }
        }

    /** Pairing material is supplied separately by an administrator, never by an APK. */
    fun pair(code: String) {
        val text = code.trim()
        require(text.startsWith("PB1-")) { "Enter a valid ParcelBridge pairing code" }
        val encoded = text.removePrefix("PB1-")
        require(encoded.length in 12..2048 && encoded.matches(Regex("[A-Za-z0-9_-]+"))) { "Invalid pairing code" }
        val origin = try {
            String(Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), Charsets.UTF_8)
        } catch (_: Exception) { throw IllegalArgumentException("Invalid pairing code") }
        validateOrigin(origin)
        val secure = encrypt(origin.trim().trimEnd('/'))
        logout()
        check(prefs.edit().putString("endpoint_secure", secure).remove("api").commit()) { "Could not save this device's connection" }
    }

    private fun validateOrigin(value: String) {
        val uri = URI(value.trim())
        require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.userInfo == null &&
            uri.query == null && uri.fragment == null && uri.port == -1 &&
            (uri.path.isNullOrEmpty() || uri.path == "/") && !value.contains('\n')) {
            "This pairing code does not contain a valid HTTPS endpoint"
        }
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }
    private fun decrypt(encoded: String): String {
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        require(bytes.size >= 29) { "Invalid saved connection" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (!store.containsAlias("parcelbridge-session")) {
            KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
                init(KeyGenParameterSpec.Builder("parcelbridge-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            }.generateKey()
        }
        return store.getKey("parcelbridge-session", null) as SecretKey
    }
    var token: String
        get() {
            val encoded = prefs.getString("session", null) ?: return ""
            return try {
                val bytes = Base64.decode(encoded, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
                String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
            } catch (_: Exception) { prefs.edit().remove("session").apply(); "" }
        }
        set(value) {
            if (value.isEmpty()) { prefs.edit().remove("session").apply(); return }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            prefs.edit().putString("session", Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)).apply()
        }
    fun logout() {
        token = ""
        prefs.edit().remove("user").remove("statuses").apply()
        File(context.filesDir, "responses").listFiles()?.forEach { it.delete() }
    }
    fun request(path: String, method: String = "GET", data: JSONObject? = null, cached: Boolean = false): Any {
        check(base.isNotEmpty()) { "Pair this device in Settings before signing in" }
        val uri = URI(base)
        check(uri.scheme == "https" && uri.host != null) { "The server must use HTTPS" }
        val cacheDir = File(context.filesDir, "responses").apply { mkdirs() }
        val digest = MessageDigest.getInstance("SHA-256").digest((base + token + path).toByteArray()).joinToString("") { "%02x".format(it) }
        val cache = File(cacheDir, digest)
        val conn = URL(base + path).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000; conn.readTimeout = 20000; conn.requestMethod = method
        conn.instanceFollowRedirects = false
        conn.setRequestProperty("Accept", "application/json")
        if (token.isNotEmpty()) conn.setRequestProperty("Authorization", "Bearer $token")
        try {
            if (data != null) {
                conn.doOutput = true; conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(data.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val source = if (status in 200..299) conn.inputStream else conn.errorStream
            val result = source?.bufferedReader()?.use { it.readText() } ?: "{}"
            if (status !in 200..299) {
                if (status == 401 && !path.startsWith("/v1/auth/")) logout()
                throw ApiError(JSONObject(result).optString("error", "Request failed ($status)"))
            }
            offline = false
            if (cached && method == "GET") cache.writeText(result)
            return if (result.trimStart().startsWith("[")) JSONArray(result) else JSONObject(result)
        } catch (e: java.io.IOException) {
            if (cached && method == "GET" && cache.exists()) {
                offline = true
                val result = cache.readText()
                return if (result.trimStart().startsWith("[")) JSONArray(result) else JSONObject(result)
            }
            throw ApiError("Cannot reach the server. Check your connection and try again.")
        } finally { conn.disconnect() }
    }
    fun obj(path: String, cached: Boolean = false) = request(path, cached = cached) as JSONObject
    fun array(path: String, cached: Boolean = false) = request(path, cached = cached) as JSONArray
    fun post(path: String, data: JSONObject = JSONObject()) = request(path, "POST", data) as JSONObject
}
class ApiError(message: String) : Exception(message)
fun json(vararg values: Pair<String, Any?>): JSONObject = JSONObject().apply { values.forEach { put(it.first, it.second ?: JSONObject.NULL) } }
fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
