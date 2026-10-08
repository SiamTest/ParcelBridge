package com.parcelbridge.app

import java.math.BigDecimal
import java.math.RoundingMode

fun money(minor: Long, currency: String = "BDT"): String = "$currency ${BigDecimal.valueOf(minor, 2).toPlainString()}"
fun minorAmount(text: String): Long {
    val value = text.trim().ifEmpty { "0" }.toBigDecimal()
    require(value.signum() >= 0 && value.scale() <= 2) { "Use a positive amount with at most two decimal places" }
    return value.movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact()
}
