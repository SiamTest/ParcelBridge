package com.parcelbridge.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.navigationrail.NavigationRailView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ExpressiveUiTest {
    class HostActivity : AppCompatActivity() {
        override fun onCreate(state: Bundle?) { setTheme(R.style.AppTheme); super.onCreate(state) }
    }

    private fun descendants(view: View): List<View> = listOf(view) +
        if (view is ViewGroup) (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()

    private fun exercise(widthDp: Int, fontScale: Float = 1f, name: String, heightDp: Int = 780): Pair<HostActivity, LinearLayout> {
        val activity = Robolectric.buildActivity(HostActivity::class.java).setup().get()
        val configuration = android.content.res.Configuration(activity.resources.configuration).apply { this.fontScale = fontScale }
        @Suppress("DEPRECATION")
        activity.resources.updateConfiguration(configuration, activity.resources.displayMetrics)
        activity.getSharedPreferences("parcelbridge_ui", Context.MODE_PRIVATE).edit().putBoolean("reduce_motion", true).commit()
        val ui = ExpressiveUi(activity)
        val content = ui.page("Your delivery desk", "home", true, { true }, {})
        ui.info(content, "Hello, Ayesha", true)
        val button = ui.button(content, "Book a delivery with a preferred rider and saved pickup address", true) {}
        ui.field(content, "Full pickup address", "18 Hospital Road, Feni", android.text.InputType.TYPE_CLASS_TEXT)
        val choice = ui.choice(content, "Parcel size", listOf("small", "medium", "large"))
        ui.preference(content, "Automatically download verified updates on Wi-Fi", false) {}
        val decor = activity.window.decorView
        val density = activity.resources.displayMetrics.density
        val width = (widthDp * density).toInt()
        val height = (heightDp * density).toInt()
        decor.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
        decor.layout(0, 0, width, height)
        assertTrue("Button must remain a usable touch target", button.height >= (48 * density).toInt())
        assertEquals("Dropdown keeps the API value", "small", choice.text.toString())
        assertTrue("Fields and cards fit the content column", content.width <= width)
        if (widthDp <= 600) assertTrue("Long actions wrap instead of being truncated", button.layout.lineCount > 1)
        for (line in 0 until button.layout.lineCount) assertEquals("No ellipsis", 0, button.layout.getEllipsisCount(line))
        assertTrue("Large forms scroll", descendants(decor).any { it is ScrollView })
        System.getenv("UI_SCREENSHOTS_DIR")?.let { directory ->
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            decor.draw(Canvas(bitmap))
            File(directory).mkdirs()
            File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
        return activity to content
    }

    @Test @Config(qualifiers = "w320dp-h780dp-mdpi")
    fun narrowPhoneWithLargeText() {
        val (activity, _) = exercise(320, 2f, "phone-320-large-text")
        assertTrue(descendants(activity.window.decorView).any { it is BottomNavigationView })
        assertFalse(descendants(activity.window.decorView).any { it is NavigationRailView })
    }

    @Test @Config(qualifiers = "w360dp-h780dp-xhdpi")
    fun compactPhoneAtHighDensity() { exercise(360, name = "phone-360") }

    @Test @Config(qualifiers = "w600dp-h780dp-mdpi")
    fun tabletUsesRail() {
        val (activity, _) = exercise(600, name = "tablet-600")
        assertTrue(descendants(activity.window.decorView).any { it is NavigationRailView })
        assertFalse(descendants(activity.window.decorView).any { it is BottomNavigationView })
    }

    @Test @Config(qualifiers = "w1200dp-h780dp-night-mdpi")
    fun largeDarkTabletLimitsContentWidth() {
        val (_, content) = exercise(1200, name = "tablet-dark-1200")
        assertTrue(content.width <= 840)
    }

    @Test @Config(qualifiers = "w360dp-h780dp-mdpi")
    fun keyboardInsetsDoNotCoverFormsOrDoublePadNavigation() {
        val (activity, _) = exercise(360, name = "keyboard-base")
        val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        val insets = WindowInsetsCompat.Builder().setInsets(WindowInsetsCompat.Type.systemBars(), Insets.of(0, 24, 0, 24))
            .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, 280)).setVisible(WindowInsetsCompat.Type.ime(), true).build()
        ViewCompat.dispatchApplyWindowInsets(root, insets)
        assertEquals(280, root.paddingBottom)
        assertEquals(View.GONE, descendants(root).filterIsInstance<BottomNavigationView>().single().visibility)
    }

    @Test @Config(qualifiers = "w360dp-h780dp-mdpi")
    fun busyNavigationKeepsSelectionAndReduceMotionKeepsContentVisible() {
        val activity = Robolectric.buildActivity(HostActivity::class.java).setup().get()
        activity.getSharedPreferences("parcelbridge_ui", Context.MODE_PRIVATE).edit().putBoolean("reduce_motion", true).commit()
        val ui = ExpressiveUi(activity)
        val content = ui.page("Your delivery desk", "home", true, { false }, {})
        val nav = descendants(activity.window.decorView).filterIsInstance<BottomNavigationView>().single()
        nav.selectedItemId = 2
        assertEquals(1, nav.selectedItemId)
        assertFalse(ExpressiveMotion.enabled(activity))
        assertEquals(1f, content.alpha)
        assertEquals(0f, content.translationY)
        val form = ui.form()
        ui.field(form, "Confirmation code", "", android.text.InputType.TYPE_CLASS_NUMBER)
        val dialog = ExpressiveDialogBuilder(activity).setTitle("Confirm delivery").setView(ui.dialogContent(form)).setPositiveButton("Confirm", null).create()
        dialog.show()
        assertTrue(dialog.isShowing)
        assertEquals(1f, dialog.window!!.decorView.alpha)
        dialog.dismiss()
    }
    @Test @Config(sdk = [26], qualifiers = "w360dp-h780dp-mdpi")
    fun minimumAndroidVersionBuildsMaterialForms() { exercise(360, name = "android-26-phone") }

    @Test @Config(qualifiers = "w360dp-h780dp-mdpi")
    fun springsSettleAndPressStillClicks() {
        val activity = Robolectric.buildActivity(HostActivity::class.java).setup().get()
        activity.getSharedPreferences("parcelbridge_ui", Context.MODE_PRIVATE).edit().putBoolean("reduce_motion", false).commit()
        val content = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        activity.setContentView(content)
        var clicks = 0
        val button = ExpressiveUi(activity).button(content, "Book a delivery", true) { clicks++ }
        content.measure(View.MeasureSpec.makeMeasureSpec(360, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(600, View.MeasureSpec.EXACTLY))
        content.layout(0, 0, 360, 600)
        ExpressiveMotion.enter(content)
        content.viewTreeObserver.dispatchOnPreDraw()
        val looper = org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper())
        // Robolectric does not deliver these AndroidX Choreographer callbacks. Drive the
        // real running springs with deterministic frame timestamps; production uses vsync.
        val handlerClass = Class.forName("androidx.dynamicanimation.animation.AnimationHandler")
        val handler = org.robolectric.util.ReflectionHelpers.callStaticMethod<Any>(handlerClass, "getInstance")
        fun advance(milliseconds: Long) {
            repeat((milliseconds / 16).toInt()) {
                org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(16))
                val callbacks = org.robolectric.util.ReflectionHelpers.getField<List<*>>(handler, "mAnimationCallbacks")
                callbacks.toList().filterIsInstance<androidx.dynamicanimation.animation.DynamicAnimation<*>>()
                    .forEach { it.doAnimationFrame(android.os.SystemClock.uptimeMillis()) }
            }
        }
        advance(2000)
        assertEquals(1f, content.alpha, 0.01f)
        assertEquals(0f, content.translationY, 0.1f)
        fun touch(action: Int) {
            val time = android.os.SystemClock.uptimeMillis()
            val event = android.view.MotionEvent.obtain(time, time, action, 20f, 20f, 0)
            button.dispatchTouchEvent(event); event.recycle()
        }
        touch(android.view.MotionEvent.ACTION_DOWN)
        advance(100)
        assertTrue(button.scaleX < 1f)
        touch(android.view.MotionEvent.ACTION_UP)
        advance(2000)
        looper.idle()
        assertEquals(1f, button.scaleX, 0.01f)
        assertEquals(1, clicks)
    }

    @Test @Config(qualifiers = "w640dp-h320dp-land-mdpi")
    fun shortLandscapeWindowKeepsRailScrollable() {
        val (activity, _) = exercise(640, 2f, "landscape-640-large-text", 320)
        val rail = descendants(activity.window.decorView).filterIsInstance<NavigationRailView>().single()
        val parent = rail.parent as ScrollView
        assertTrue("All destinations remain reachable in a short window", parent.canScrollVertically(1))
    }

}
