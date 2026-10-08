package com.parcelbridge.app
import org.junit.Assert.assertEquals
import org.junit.Test
class FormattingTest {
    @Test fun amountsKeepEveryPaisa() { assertEquals(12345L, minorAmount("123.45")); assertEquals("BDT 123.45", money(12345)); assertEquals(0L, minorAmount("")) }
    @Test(expected = IllegalArgumentException::class) fun rejectsNegativeCash() { minorAmount("-1") }
    @Test(expected = IllegalArgumentException::class) fun rejectsFractionalPaisa() { minorAmount("1.001") }
}
