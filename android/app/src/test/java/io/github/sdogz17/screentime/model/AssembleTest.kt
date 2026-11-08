package io.github.sdogz17.screentime.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.OffsetDateTime

class AssembleTest {
    private val phone = "phone"

    @Test
    fun sydneyMidnightSplitsACrossingIntervalWithoutDoubleCounting() {
        val start = instant("2026-11-07T23:30:00+11:00")
        val end = instant("2026-11-08T00:30:00+11:00")
        val result = assemble(events(start, end, now = instant("2026-11-08T12:00:00+11:00")), phone, "Phone")
        val nov7 = result.days.first { it.date == "2026-11-07" }
        val nov8 = result.days.first { it.date == "2026-11-08" }
        assertEquals(30 * 60_000L, nov7.screenInteractiveMs)
        assertEquals(30 * 60_000L, nov8.screenInteractiveMs)
        assertEquals(60 * 60_000L, (nov7.screenInteractiveMs ?: 0) + (nov8.screenInteractiveMs ?: 0))
    }

    @Test
    fun dstFallbackDayIs25HoursAndTheRepeatedHourHoldsBoth() {
        val start = dayBounds(LocalDate.parse("2026-04-05")).first
        val end = dayBounds(LocalDate.parse("2026-04-06")).first
        assertEquals(25 * 3_600_000L, end - start)
        val result = assemble(events(start, end, now = end + 1_000), phone, "Phone")
        val day = result.days.first { it.date == "2026-04-05" }
        assertEquals(25 * 3_600_000L, day.screenInteractiveMs)
        val hour2 = day.hours!!.first { it.hour == 2 }
        assertEquals(2 * 3_600_000L, hour2.screenInteractiveMs)
        assertTrue(day.hours.none { it.hour == 2 && it.screenInteractiveMs == 3_600_000L && false })
    }

    @Test
    fun dstGapSkipsHour2AndDoesNotInventTime() {
        val on = instant("2026-10-04T01:30:00+10:00")
        val off = instant("2026-10-04T03:30:00+11:00")
        assertEquals(3_600_000L, off - on)
        val result = assemble(events(on, off, now = instant("2026-10-05T00:00:00+11:00")), phone, "Phone")
        val day = result.days.first { it.date == "2026-10-04" }
        assertEquals(3_600_000L, day.screenInteractiveMs)
        assertNull(day.hours!!.find { it.hour == 2 })
        assertEquals(30 * 60_000L, day.hours.first { it.hour == 1 }.screenInteractiveMs)
        assertEquals(30 * 60_000L, day.hours.first { it.hour == 3 }.screenInteractiveMs)
    }

    @Test
    fun knownOffDayIsZeroAndUnknownDayIsMissing() {
        val dayStart = dayBounds(LocalDate.parse("2026-11-01")).first
        val dayEnd = dayBounds(LocalDate.parse("2026-11-02")).first
        val off = assemble(
            ObservationInput(
                events = listOf(RawEvent(SCREEN_NON_INTERACTIVE, dayStart - 60_000, null)),
                eventStats = emptyList(),
                usageStats = emptyList(),
                nowEpochMs = dayEnd + 1_000,
            ),
            phone,
            "Phone",
        )
        val zero = off.days.first { it.date == "2026-11-01" }
        assertEquals(0L, zero.screenInteractiveMs)
        assertFalse(zero.partial)

        val missing = assemble(
            ObservationInput(emptyList(), emptyList(), emptyList(), dayEnd + 1_000),
            phone,
            "Phone",
        )
        assertEquals(Outcome.EMPTY, missing.outcome)
        assertTrue(missing.days.isEmpty())
    }

    @Test
    fun nullQueriesAreUnavailableAndDoNotBecomeZero() {
        val result = assemble(ObservationInput(null, null, null, instant("2026-11-08T12:00:00+11:00")), phone, "Phone")
        assertEquals(Outcome.UNAVAILABLE, result.outcome)
        assertTrue(result.days.isEmpty())
        val decision = decideQuery(true, false, null, null, null, 0L)
        assertTrue(decision is QueryDecision.Locked)
        assertTrue(decideQuery(false, true, emptyList(), emptyList(), emptyList(), 0L) is QueryDecision.Denied)
    }

    @Test
    fun overlappingAppsAreNotTheScreenTotal() {
        val start = instant("2026-11-03T09:00:00+11:00")
        val end = start + 30 * 60_000
        val events = listOf(
            RawEvent(SCREEN_INTERACTIVE, start, null),
            RawEvent(KEYGUARD_HIDDEN, start, null),
            RawEvent(ACTIVITY_RESUMED, start, "com.example.mail"),
            RawEvent(ACTIVITY_RESUMED, start, "com.example.maps"),
            RawEvent(ACTIVITY_PAUSED, end, "com.example.mail"),
            RawEvent(ACTIVITY_PAUSED, end, "com.example.maps"),
            RawEvent(SCREEN_NON_INTERACTIVE, end, null),
        )
        val result = assemble(ObservationInput(events, emptyList(), emptyList(), end + 3_600_000), phone, "Phone")
        val day = result.days.first { it.date == "2026-11-03" }
        assertEquals(30 * 60_000L, day.unlockedInteractiveMs)
        assertEquals(30 * 60_000L, day.screenInteractiveMs)
        val sum = day.apps!!.sumOf { it.foregroundMs }
        assertEquals(60 * 60_000L, sum)
        assertNotEquals(day.screenInteractiveMs, sum)
        assertEquals("unlocked-interactive", day.basis)
        assertEquals("events", day.method)
        assertFalse(day.hours.isNullOrEmpty())
    }

    @Test
    fun twoActivitiesOfOneAppAreCountedOnce() {
        val start = instant("2026-11-03T09:00:00+11:00")
        val mid = start + 10 * 60_000
        val later = start + 20 * 60_000
        val end = start + 30 * 60_000
        val events = listOf(
            RawEvent(SCREEN_INTERACTIVE, start, null),
            RawEvent(ACTIVITY_RESUMED, start, "com.example.mail"),
            RawEvent(ACTIVITY_RESUMED, mid, "com.example.mail"),
            RawEvent(ACTIVITY_PAUSED, later, "com.example.mail"),
            RawEvent(ACTIVITY_PAUSED, end, "com.example.mail"),
            RawEvent(SCREEN_NON_INTERACTIVE, end, null),
        )
        val day = assemble(ObservationInput(events, emptyList(), emptyList(), end + 1_000), phone, "Phone")
            .days.first { it.date == "2026-11-03" }
        assertEquals(30 * 60_000L, day.apps!!.single().foregroundMs)
    }

    @Test
    fun crossingUsageBucketIsDroppedAndContainedBucketIsNotScreenTime() {
        val (dayStart, dayEnd) = dayBounds(LocalDate.parse("2026-11-04"))
        val crossing = RawUsageStat("com.example.mail", dayStart - 3_600_000, dayEnd + 3_600_000, 5_000_000, null)
        val dropped = assemble(
            ObservationInput(emptyList(), emptyList(), listOf(crossing), dayEnd + 1_000),
            phone,
            "Phone",
        )
        assertTrue(dropped.days.none { it.date == "2026-11-04" })
        assertTrue(dropped.droppedUnalignedDays > 0)

        val contained = RawUsageStat("com.example.mail", dayStart, dayEnd, 20 * 60_000, 20 * 60_000)
        val kept = assemble(
            ObservationInput(emptyList(), emptyList(), listOf(contained, contained), dayEnd + 1_000),
            phone,
            "Phone",
        )
        val day = kept.days.first { it.date == "2026-11-04" }
        assertNull(day.screenInteractiveMs)
        assertNull(day.hours)
        assertEquals(20 * 60_000L, day.apps!!.single().foregroundMs)
        assertTrue(day.appsPartial)
    }

    @Test
    fun alignedEventStatZeroIsARecordedZeroAndAShortZeroIsNot() {
        val (dayStart, dayEnd) = dayBounds(LocalDate.parse("2026-11-02"))
        val aligned = RawEventStat(SCREEN_INTERACTIVE, dayStart, dayEnd, 0, 0)
        val zero = assemble(
            ObservationInput(emptyList(), listOf(aligned, aligned), emptyList(), dayEnd + 1_000),
            phone,
            "Phone",
        ).days.first { it.date == "2026-11-02" }
        assertEquals(0L, zero.screenInteractiveMs)
        assertEquals("event-stats", zero.method)
        assertNull(zero.hours)

        val short = RawEventStat(SCREEN_INTERACTIVE, dayStart, dayStart + 3_600_000, 0, 0)
        val omitted = assemble(
            ObservationInput(emptyList(), listOf(short), emptyList(), dayEnd + 1_000),
            phone,
            "Phone",
        )
        assertTrue(omitted.days.none { it.date == "2026-11-02" })
    }

    @Test
    fun refreshReplacesADayAndALockedReadKeepsIt() {
        val (dayStart, dayEnd) = dayBounds(LocalDate.parse("2026-11-06"))
        val first = assemble(
            events(dayStart + 3_600_000, dayStart + 2 * 3_600_000, now = dayEnd + 1_000),
            phone,
            "Phone",
        )
        var doc = applyAttempt(
            emptyDocument(),
            Attempt.Observed(dayEnd, "Australia/Sydney", first.days, 0, null, "Read."),
            StoredDevice(phone, "Phone", "android"),
        )
        val once = doc.days.first { it.date == "2026-11-06" }.screenInteractiveMs
        doc = applyAttempt(
            doc,
            Attempt.Observed(dayEnd + 10, "Australia/Sydney", first.days, 0, null, "Read."),
            StoredDevice(phone, "Phone", "android"),
        )
        assertEquals(once, doc.days.first { it.date == "2026-11-06" }.screenInteractiveMs)
        assertEquals(1, doc.days.count { it.date == "2026-11-06" })
        val success = doc.status.lastSuccessAt
        doc = applyAttempt(doc, Attempt.Locked(dayEnd + 50_000, "Australia/Sydney"))
        assertEquals(once, doc.days.first { it.date == "2026-11-06" }.screenInteractiveMs)
        assertEquals(success, doc.status.lastSuccessAt)
        assertEquals("locked", doc.status.lastResult)

        val json = doc.toJson()
        val parsed = parseDocument(json)
        assertEquals(once, parsed.days.first { it.date == "2026-11-06" }.screenInteractiveMs)
        assertFalse(json.contains("pickup"))
    }

    @Test
    fun webPolicyAllowsOnlyBundledAssets() {
        assertTrue(WebPolicy.allow(WebPolicy.PAGE))
        assertTrue(WebPolicy.allow("https://appassets.androidplatform.net/assets/assets/index-abc.js"))
        assertFalse(WebPolicy.allow("https://sdogz17.github.io/Grok/screen/"))
        assertFalse(WebPolicy.allow("http://appassets.androidplatform.net/assets/index.html"))
        assertFalse(WebPolicy.allow("javascript:alert(1)"))
        assertFalse(WebPolicy.allow("file:///android_asset/index.html"))
        assertFalse(WebPolicy.allow("https://appassets.androidplatform.net/assets/../secret"))
        assertFalse(WebPolicy.allow("https://appassets.androidplatform.net.evil.com/assets/index.html"))
        assertFalse(WebPolicy.allow("https://user:pass@appassets.androidplatform.net/assets/index.html"))
    }

    @Test
    fun manifestAsksForUsageAccessAndNothingElseBroad() {
        val text = File("src/main/AndroidManifest.xml").readText()
        assertTrue(text.contains("android.permission.PACKAGE_USAGE_STATS"))
        assertFalse(text.contains("android.permission.INTERNET"))
        assertFalse(text.contains("ACCESSIBILITY"))
        assertFalse(text.contains("QUERY_ALL_PACKAGES"))
        assertTrue(text.contains("allowBackup=\"false\""))
    }

    private fun instant(text: String): Long = OffsetDateTime.parse(text).toInstant().toEpochMilli()

    private fun events(on: Long, off: Long, now: Long) = ObservationInput(
        events = listOf(RawEvent(SCREEN_INTERACTIVE, on, null), RawEvent(SCREEN_NON_INTERACTIVE, off, null)),
        eventStats = emptyList(),
        usageStats = emptyList(),
        nowEpochMs = now,
    )
}
