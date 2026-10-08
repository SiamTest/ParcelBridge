package com.parcelbridge.app

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.color.MaterialColors
import com.google.android.material.navigation.NavigationBarView
import com.google.android.material.navigationrail.NavigationRailView
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.google.android.material.shape.ShapeAppearanceModel
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.textfield.MaterialAutoCompleteTextView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.android.material.textview.MaterialTextView
import com.google.android.material.R as MaterialR

/** Shared components keep every seller, rider and operator screen on the same design system. */
class ExpressiveUi(private val activity: AppCompatActivity) {
    private var root: LinearLayout? = null
    private lateinit var toolbar: MaterialToolbar
    private lateinit var scroll: ScrollView
    private var navigation: NavigationBarView? = null
    private var authenticated = false
    private var updatingSelection = false
    private val wide get() = activity.resources.configuration.screenWidthDp >= 600
    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
    private fun color(attr: Int) = MaterialColors.getColor(activity, attr, Color.BLACK)
    private fun margins() = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) }
    private fun text(value: String, appearance: Int = R.style.TypeBody) = MaterialTextView(activity).apply {
        setTextAppearance(appearance); text = value; setTextColor(color(MaterialR.attr.colorOnSurface))
        setTextIsSelectable(true); isSingleLine = false; setLineSpacing(dp(2).toFloat(), 1f)
    }

    fun page(title: String, key: String, signedIn: Boolean, navigate: (String) -> Boolean, back: () -> Unit): LinearLayout {
        activity.currentFocus?.let { focus ->
            (activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(focus.windowToken, 0)
        }
        if (root == null || authenticated != signedIn) {
            authenticated = signedIn
            WindowCompat.setDecorFitsSystemWindows(activity.window, false)
            val layout = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL; setBackgroundColor(color(MaterialR.attr.colorSurface))
            }
            toolbar = MaterialToolbar(activity).apply {
                addView(text("ParcelBridge · Feni", R.style.TypeTitle).apply {
                    setTextIsSelectable(false); setPadding(0, dp(12), 0, dp(12))
                }, androidx.appcompat.widget.Toolbar.LayoutParams(-1, -2))
                minimumHeight = dp(64); setBackgroundColor(color(MaterialR.attr.colorSurface))
                setNavigationOnClickListener { back() }
            }
            layout.addView(toolbar, LinearLayout.LayoutParams(-1, -2))
            val body = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL }
            navigation = if (signedIn) {
                val nav: NavigationBarView = if (wide) NavigationRailView(activity).apply {
                    menuGravity = Gravity.TOP; itemMinimumHeight = dp(if (resources.configuration.fontScale > 1.3f) 120 else 80)
                } else BottomNavigationView(activity).apply {
                    isItemHorizontalTranslationEnabled = false
                    minimumHeight = dp(if (resources.configuration.fontScale > 1.3f) 112 else 80)
                }
                listOf(Triple(1, "Home", R.drawable.ic_home), Triple(2, "Orders", R.drawable.ic_orders), Triple(3, "Settings", R.drawable.ic_settings)).forEach { (id, label, icon) ->
                    nav.menu.add(0, id, id, label).setIcon(icon)
                }
                nav.labelVisibilityMode = NavigationBarView.LABEL_VISIBILITY_LABELED
                nav.setLabelMaxLines(2)
                nav.setLabelFontScalingEnabled(true)
                nav.setBackgroundColor(color(MaterialR.attr.colorSurfaceContainerLow))
                for (id in 1..3) nav.findViewById<View>(id)?.let { ExpressiveMotion.press(it) }
                nav.setOnItemSelectedListener { item ->
                    updatingSelection || navigate(when (item.itemId) { 2 -> "orders"; 3 -> "settings"; else -> "home" })
                }
                nav
            } else null
            if (wide) navigation?.let { rail ->
                // Short landscape windows and the keyboard must not clip rail destinations.
                val railScroll = ScrollView(activity).apply {
                    isFillViewport = true; isVerticalScrollBarEnabled = false
                    addView(rail, FrameLayout.LayoutParams(-1, -2))
                }
                body.addView(railScroll, LinearLayout.LayoutParams(dp(104), -1))
            }
            scroll = ScrollView(activity).apply { isFillViewport = true; clipToPadding = false }
            body.addView(scroll, LinearLayout.LayoutParams(0, -1, 1f))
            layout.addView(body, LinearLayout.LayoutParams(-1, 0, 1f))
            if (!wide) navigation?.let { layout.addView(it, LinearLayout.LayoutParams(-1, -2)) }
            ViewCompat.setOnApplyWindowInsetsListener(layout) { view, insets ->
                val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
                val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
                view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
                if (!wide) navigation?.visibility = if (insets.isVisible(WindowInsetsCompat.Type.ime())) View.GONE else View.VISIBLE
                WindowInsetsCompat.CONSUMED
            }
            val night = activity.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES
            WindowCompat.getInsetsController(activity.window, layout).apply {
                isAppearanceLightStatusBars = !night; isAppearanceLightNavigationBars = !night
            }
            root = layout; activity.setContentView(layout); ViewCompat.requestApplyInsets(layout)
        }
        toolbar.navigationIcon = if (key in listOf("home", "orders", "auth")) null else activity.getDrawable(R.drawable.ic_back)?.apply { setTint(color(MaterialR.attr.colorOnSurface)) }
        toolbar.navigationContentDescription = "Back to delivery desk"
        updatingSelection = true
        navigation?.selectedItemId = when (key) { "orders", "order", "chat", "rating" -> 2; "settings", "password" -> 3; else -> 1 }
        updatingSelection = false
        val column = ContentColumn(activity).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(12), dp(20), dp(28))
        }
        val frame = FrameLayout(activity).apply {
            addView(column, FrameLayout.LayoutParams(-1, -2, Gravity.TOP or Gravity.CENTER_HORIZONTAL))
        }
        scroll.removeAllViews(); scroll.addView(frame, FrameLayout.LayoutParams(-1, -2)); scroll.scrollTo(0, 0)
        hero(column, title)
        ExpressiveMotion.enter(column)
        return column
    }

    private fun hero(parent: LinearLayout, title: String) {
        val card = MaterialCardView(activity).apply {
            setCardBackgroundColor(color(MaterialR.attr.colorPrimaryContainer)); strokeWidth = 0
            shapeAppearanceModel = ShapeAppearanceModel.builder().setAllCornerSizes(dp(32).toFloat())
                .setBottomLeftCornerSize(dp(12).toFloat()).build()
        }
        val body = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(20), dp(24), dp(20), dp(24)) }
        val headline = text(title, R.style.TypeHeadline).apply { setTextColor(color(MaterialR.attr.colorOnPrimaryContainer)); setTextIsSelectable(false); ViewCompat.setAccessibilityHeading(this, true) }
        body.addView(headline, LinearLayout.LayoutParams(0, -2, 1f))
        if (activity.resources.configuration.fontScale <= 1.3f && activity.resources.configuration.screenWidthDp >= 360) {
            body.addView(ImageView(activity).apply {
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                background = activity.getDrawable(R.drawable.bg_clover)?.apply { setTint(color(MaterialR.attr.colorTertiaryContainer)) }
                setImageResource(R.drawable.ic_delivery_package); imageTintList = ColorStateList.valueOf(color(MaterialR.attr.colorOnTertiaryContainer)); setPadding(dp(14), dp(14), dp(14), dp(14))
            }, LinearLayout.LayoutParams(dp(64), dp(64)).apply { marginStart = dp(16) })
        }
        card.addView(body); parent.addView(card, margins())
    }

    fun info(parent: LinearLayout, value: String, prominent: Boolean = false): TextView {
        val label = text(value, if (prominent) R.style.TypeTitle else R.style.TypeBody)
        val card = MaterialCardView(activity).apply {
            setCardBackgroundColor(color(if (prominent) MaterialR.attr.colorSecondaryContainer else MaterialR.attr.colorSurfaceContainerLow))
            strokeWidth = 0; shapeAppearanceModel = ShapeAppearanceModel.builder(activity, R.style.AppShape_Card, 0).build()
        }
        label.setPadding(dp(18), dp(16), dp(18), dp(16))
        if (prominent) label.setTextColor(color(MaterialR.attr.colorOnSecondaryContainer))
        card.addView(label); parent.addView(card, margins())
        return label
    }

    fun button(parent: LinearLayout, value: String, primary: Boolean = false, action: () -> Unit): MaterialButton {
        val button = MaterialButton(activity).apply {
            text = value; isAllCaps = false; isSingleLine = false; maxLines = Int.MAX_VALUE; ellipsize = null
            minHeight = dp(56); minimumHeight = dp(56); setPaddingRelative(dp(24), dp(14), dp(24), dp(14))
            if (!primary) {
                backgroundTintList = ColorStateList.valueOf(color(MaterialR.attr.colorSecondaryContainer))
                setTextColor(color(MaterialR.attr.colorOnSecondaryContainer))
            }
            setOnClickListener { action() }
        }
        ExpressiveMotion.press(button); parent.addView(button, margins())
        return button
    }

    fun field(parent: LinearLayout, name: String, value: String, type: Int): EditText {
        // A wrapping label keeps long address/amount captions readable at large font scales.
        val caption = text(name, R.style.TypeLabel).apply { setTextIsSelectable(false) }
        parent.addView(caption, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(6) })
        val layout = TextInputLayout(activity).apply {
            isHintEnabled = false; boxBackgroundMode = TextInputLayout.BOX_BACKGROUND_OUTLINE
            if ((type and android.text.InputType.TYPE_MASK_VARIATION) in listOf(android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD)) endIconMode = TextInputLayout.END_ICON_PASSWORD_TOGGLE
        }
        val edit = TextInputEditText(layout.context).apply {
            id = View.generateViewId(); setTextAppearance(R.style.TypeBody); inputType = type
            setText(value); minHeight = dp(56); isSingleLine = false
            if ((type and android.text.InputType.TYPE_MASK_VARIATION) in listOf(android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD)) isSingleLine = true
        }
        caption.labelFor = edit.id
        layout.addView(edit, LinearLayout.LayoutParams(-1, -2)); parent.addView(layout, margins())
        return edit
    }

    fun choice(parent: LinearLayout, name: String, values: List<String>): MaterialAutoCompleteTextView {
        val caption = text(name, R.style.TypeLabel).apply { setTextIsSelectable(false) }
        parent.addView(caption, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(6) })
        val layout = TextInputLayout(activity).apply {
            isHintEnabled = false; boxBackgroundMode = TextInputLayout.BOX_BACKGROUND_OUTLINE
            endIconMode = TextInputLayout.END_ICON_DROPDOWN_MENU
        }
        val edit = MaterialAutoCompleteTextView(layout.context).apply {
            id = View.generateViewId(); setTextAppearance(R.style.TypeBody); inputType = android.text.InputType.TYPE_NULL
            setAdapter(ArrayAdapter(context, android.R.layout.simple_list_item_1, values)); setText(values.first(), false)
            minHeight = dp(56); setPaddingRelative(dp(16), dp(16), dp(16), dp(16))
        }
        caption.labelFor = edit.id
        layout.addView(edit, LinearLayout.LayoutParams(-1, -2)); parent.addView(layout, margins()); return edit
    }

    fun preference(parent: LinearLayout, label: String, checked: Boolean, change: (Boolean) -> Unit): MaterialSwitch {
        val toggle = MaterialSwitch(activity).apply {
            text = label; isChecked = checked; minHeight = dp(64); setTextAppearance(R.style.TypeBody)
            setPadding(dp(16), dp(12), dp(16), dp(12)); setOnCheckedChangeListener { _, value -> change(value) }
        }
        val card = MaterialCardView(activity).apply { setCardBackgroundColor(color(MaterialR.attr.colorSurfaceContainerLow)); strokeWidth = 0 }
        card.addView(toggle); parent.addView(card, margins()); return toggle
    }

    fun progress(): LinearProgressIndicator = LinearProgressIndicator(activity).apply {
        isIndeterminate = true; contentDescription = "Working"; setPadding(0, dp(6), 0, dp(6))
        layoutParams = margins()
    }

    fun form() = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(8), dp(20), dp(8)) }
    fun dialogContent(form: LinearLayout) = ScrollView(activity).apply { addView(form) }

    private class ContentColumn(context: Context) : LinearLayout(context) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val maximum = (840 * resources.displayMetrics.density).toInt()
            val width = minOf(MeasureSpec.getSize(widthMeasureSpec), maximum)
            super.onMeasure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.getMode(widthMeasureSpec)), heightMeasureSpec)
        }
    }
}
