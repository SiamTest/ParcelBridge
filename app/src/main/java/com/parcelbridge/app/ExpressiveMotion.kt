package com.parcelbridge.app

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.core.view.doOnPreDraw
import androidx.dynamicanimation.animation.DynamicAnimation
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce
import com.google.android.material.dialog.MaterialAlertDialogBuilder

object ExpressiveMotion {
    // Follow the Android system-wide animator setting; there is no app-specific
    // "Reduce motion" switch or preference read on every button press.
    fun enabled() = ValueAnimator.areAnimatorsEnabled()

    private fun spring(view: View, property: DynamicAnimation.ViewProperty, end: Float) =
        SpringAnimation(view, property, end).apply {
            spring = SpringForce(end).setStiffness(550f).setDampingRatio(0.82f)
        }

    fun enter(view: View) {
        if (!enabled()) return
        view.translationY = 18f * view.resources.displayMetrics.density
        view.alpha = 0f
        val translation = spring(view, DynamicAnimation.TRANSLATION_Y, 0f)
        val opacity = spring(view, DynamicAnimation.ALPHA, 1f).apply {
            spring!!.dampingRatio = SpringForce.DAMPING_RATIO_NO_BOUNCY
            setMinValue(0f); setMaxValue(1f)
        }
        // Spring animations only run for a compact element (e.g. the hero card),
        // never for a tall scrolling list that could redraw hundreds of children.
        val release = object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) = Unit
            override fun onViewDetachedFromWindow(v: View) {
                translation.cancel(); opacity.cancel()
                v.removeOnAttachStateChangeListener(this)
            }
        }
        view.addOnAttachStateChangeListener(release)
        view.doOnPreDraw {
            if (enabled() && view.isAttachedToWindow) { translation.start(); opacity.start() }
            else { view.translationY = 0f; view.alpha = 1f }
        }
    }

    @SuppressLint("ClickableViewAccessibility") // Observes touches; the Material view handles clicks because the listener returns false.
    fun press(view: View) {
        val x = spring(view, DynamicAnimation.SCALE_X, 1f)
        val y = spring(view, DynamicAnimation.SCALE_Y, 1f)
        // One detach listener per control (not one per spring axis).
        view.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) = Unit
            override fun onViewDetachedFromWindow(v: View) {
                x.cancel(); y.cancel()
                v.scaleX = 1f; v.scaleY = 1f
            }
        })
        view.setOnTouchListener { _, event ->
            if (enabled()) {
                val target = if (event.actionMasked == MotionEvent.ACTION_DOWN) 0.97f else 1f
                if (event.actionMasked == MotionEvent.ACTION_DOWN || event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
                    x.animateToFinalPosition(target); y.animateToFinalPosition(target)
                }
            } else { x.cancel(); y.cancel(); view.scaleX = 1f; view.scaleY = 1f }
            false // Preserve Material ripples, click handling, scrolling and accessibility actions.
        }
    }

    fun dialogShown(dialog: AlertDialog) {
        dialog.window?.decorView?.let { enter(it) }
        for (id in listOf(AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE, AlertDialog.BUTTON_NEUTRAL)) {
            dialog.getButton(id)?.let { press(it) }
        }
    }
}

class ExpressiveDialogBuilder(context: Context) : MaterialAlertDialogBuilder(context) {
    override fun create(): AlertDialog = super.create().apply {
        window?.setWindowAnimations(0)
        window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        setOnShowListener { ExpressiveMotion.dialogShown(this) }
    }
}
