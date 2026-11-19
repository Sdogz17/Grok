package io.github.sdogz17.screentime.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** UsageEvents.Event constants used by the collector. Values are the platform constants. */
const val ACTIVITY_RESUMED = 1
const val ACTIVITY_PAUSED = 2
const val SCREEN_INTERACTIVE = 15
const val SCREEN_NON_INTERACTIVE = 16
const val KEYGUARD_SHOWN = 17
const val KEYGUARD_HIDDEN = 18
const val DEVICE_SHUTDOWN = 26

val SYDNEY: ZoneId = ZoneId.of("Australia/Sydney")
const val SLACK_MS = 120_000L
const val LOOKBACK_MS = 2L * 24 * 60 * 60 * 1000
const val HISTORY_DAYS = 60L

private val RECORDED_AT: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

fun recordedAt(epochMs: Long): String = RECORDED_AT.format(Instant.ofEpochMilli(epochMs))

data class RawEvent(val type: Int, val timestamp: Long, val packageName: String?)

data class RawUsageStat(
    val packageName: String,
    val firstTimestamp: Long,
    val lastTimestamp: Long,
    val foregroundMs: Long,
    val visibleMs: Long?,
)

data class RawEventStat(
    val eventType: Int,
    val firstTimestamp: Long,
    val lastTimestamp: Long,
    val totalTimeMs: Long,
    val count: Int,
)

data class ObservationInput(
    val events: List<RawEvent>?,
    val eventStats: List<RawEventStat>?,
    val usageStats: List<RawUsageStat>?,
    val nowEpochMs: Long,
    val zone: ZoneId = SYDNEY,
)

enum class Outcome { UNAVAILABLE, EMPTY, OBSERVED }

data class AppDraft(
    val id: String,
    val label: String,
    val foregroundMs: Long,
    val visibleMs: Long? = null,
)

data class HourDraft(
    val hour: Int,
    val screenInteractiveMs: Long?,
    val unlockedInteractiveMs: Long?,
    val partial: Boolean,
    val apps: List<AppDraft>?,
)

data class DayDraft(
    val date: String,
    val deviceId: String,
    val recordedAt: String,
    val screenInteractiveMs: Long?,
    val unlockedInteractiveMs: Long?,
    val basis: String?,
    val method: String?,
    val partial: Boolean,
    val detail: String?,
    val apps: List<AppDraft>?,
    val appsMethod: String?,
    val appsPartial: Boolean,
    val appsDetail: String?,
    val hours: List<HourDraft>?,
)

data class AssembleResult(
    val outcome: Outcome,
    val days: List<DayDraft>,
    val droppedUnalignedDays: Int,
    val eventsRetainedFrom: Long?,
)

data class Span(val start: Long, val end: Long)

data class SpanResult(
    val spans: List<Span>,
    val unknownMs: Long,
    val hourOn: Map<Int, Long>,
    val hourOff: Map<Int, Long>,
    val hourUnknown: Map<Int, Long>,
)

fun dayBounds(date: LocalDate, zone: ZoneId = SYDNEY): Pair<Long, Long> {
    val start = date.atStartOfDay(zone).toInstant().toEpochMilli()
    val end = date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    return start to end
}

fun civilDate(epochMs: Long, zone: ZoneId = SYDNEY): LocalDate =
    Instant.ofEpochMilli(epochMs).atZone(zone).toLocalDate()

/** Next civil-hour boundary, including the DST gap and the repeated hour. */
fun nextHourEpoch(cursor: Long, zone: ZoneId = SYDNEY): Long {
    val zoned = Instant.ofEpochMilli(cursor).atZone(zone)
    val plus = zoned.truncatedTo(ChronoUnit.HOURS).plusHours(1).toInstant().toEpochMilli()
    val transition = zone.rules.nextTransition(Instant.ofEpochMilli(cursor))?.instant?.toEpochMilli()
    return listOfNotNull(plus.takeIf { it > cursor }, transition?.takeIf { it > cursor }).minOrNull()
        ?: (cursor + 3_600_000L)
}

fun spanMs(spans: List<Span>): Long = spans.sumOf { (it.end - it.start).coerceAtLeast(0) }

fun intersect(left: List<Span>, right: List<Span>): List<Span> {
    val result = mutableListOf<Span>()
    for (a in left) {
        for (b in right) {
            val start = max(a.start, b.start)
            val end = min(a.end, b.end)
            if (end > start) result.add(Span(start, end))
        }
    }
    return result
}

fun unionSpans(spans: List<Span>): List<Span> {
    val sorted = spans.filter { it.end > it.start }.sortedBy { it.start }
    val out = mutableListOf<Span>()
    for (span in sorted) {
        val last = out.lastOrNull()
        if (last != null && span.start <= last.end) out[out.lastIndex] = Span(last.start, max(last.end, span.end))
        else out.add(span)
    }
    return out
}

/**
 * Builds spans where [onType] has turned the state on and [offType] has turned it off.
 * A shutdown clears the state. Time before the first known event stays unknown.
 */
fun buildSpans(
    events: List<RawEvent>,
    dayStart: Long,
    windowEnd: Long,
    onType: Int,
    offType: Int,
    zone: ZoneId = SYDNEY,
): SpanResult {
    val ordered = events.sortedBy { it.timestamp }
    val lookback = dayStart - LOOKBACK_MS
    var state: Boolean? = null
    for (event in ordered) {
        if (event.timestamp < lookback || event.timestamp >= dayStart) continue
        when (event.type) {
            onType -> state = true
            offType -> state = false
            DEVICE_SHUTDOWN -> state = null
        }
    }
    val hourOn = mutableMapOf<Int, Long>()
    val hourOff = mutableMapOf<Int, Long>()
    val hourUnknown = mutableMapOf<Int, Long>()
    val spans = mutableListOf<Span>()
    var cursor = dayStart
    var openAt: Long? = if (state == true) dayStart else null

    fun advance(to: Long) {
        var t = cursor
        while (t < to) {
            val next = min(to, nextHourEpoch(t, zone))
            if (next <= t) break
            val hour = Instant.ofEpochMilli(t).atZone(zone).hour
            val dt = next - t
            when (state) {
                true -> hourOn[hour] = (hourOn[hour] ?: 0L) + dt
                false -> hourOff[hour] = (hourOff[hour] ?: 0L) + dt
                null -> hourUnknown[hour] = (hourUnknown[hour] ?: 0L) + dt
            }
            t = next
        }
        cursor = to
    }

    for (event in ordered) {
        if (event.timestamp < dayStart || event.timestamp >= windowEnd) continue
        if (event.type != onType && event.type != offType && event.type != DEVICE_SHUTDOWN) continue
        advance(event.timestamp)
        when (event.type) {
            onType -> {
                state = true
                if (openAt == null) openAt = event.timestamp
            }
            offType -> {
                state = false
                val opened = openAt
                if (opened != null && event.timestamp > opened) spans.add(Span(opened, event.timestamp))
                openAt = null
            }
            DEVICE_SHUTDOWN -> {
                val opened = openAt
                if (opened != null && event.timestamp > opened) spans.add(Span(opened, event.timestamp))
                openAt = null
                state = null
            }
        }
    }
    advance(windowEnd)
    val opened = openAt
    if (opened != null && windowEnd > opened) spans.add(Span(opened, windowEnd))
    val unknown = hourUnknown.values.sum()
    return SpanResult(spans, unknown, hourOn, hourOff, hourUnknown)
}

private data class AppBuild(val apps: List<AppDraft>, val partial: Boolean, val hourApps: Map<Int, List<AppDraft>>)

private fun appSpans(
    events: List<RawEvent>,
    dayStart: Long,
    windowEnd: Long,
    screenSpans: List<Span>,
    screenKnown: Boolean,
    zone: ZoneId,
): AppBuild {
    val ordered = events.sortedBy { it.timestamp }
    val lookback = dayStart - LOOKBACK_MS
    val open = mutableMapOf<String, ArrayDeque<Long>>()
    var partial = false
    val raw = mutableMapOf<String, MutableList<Span>>()

    fun closeAllWithoutCounting() {
        if (open.values.any { it.isNotEmpty() }) partial = true
        open.clear()
    }

    for (event in ordered) {
        if (event.timestamp < lookback || event.timestamp >= dayStart) continue
        when (event.type) {
            ACTIVITY_RESUMED -> {
                val pkg = event.packageName ?: continue
                open.getOrPut(pkg) { ArrayDeque() }.addLast(event.timestamp)
            }
            ACTIVITY_PAUSED -> {
                val pkg = event.packageName ?: continue
                val stack = open[pkg]
                if (stack == null || stack.isEmpty()) partial = true else stack.removeLast()
            }
            DEVICE_SHUTDOWN -> closeAllWithoutCounting()
        }
    }

    fun addRaw(pkg: String, start: Long, end: Long) {
        val clippedStart = max(start, dayStart)
        val clippedEnd = min(end, windowEnd)
        if (clippedEnd > clippedStart) raw.getOrPut(pkg) { mutableListOf() }.add(Span(clippedStart, clippedEnd))
    }

    for (event in ordered) {
        if (event.timestamp < dayStart || event.timestamp >= windowEnd) continue
        when (event.type) {
            ACTIVITY_RESUMED -> {
                val pkg = event.packageName ?: continue
                open.getOrPut(pkg) { ArrayDeque() }.addLast(event.timestamp)
            }
            ACTIVITY_PAUSED -> {
                val pkg = event.packageName ?: continue
                val stack = open[pkg]
                if (stack == null || stack.isEmpty()) partial = true
                else addRaw(pkg, stack.removeLast(), event.timestamp)
            }
            DEVICE_SHUTDOWN -> closeAllWithoutCounting()
        }
    }
    for ((pkg, stack) in open) {
        for (start in stack) addRaw(pkg, start, windowEnd)
    }

    val clipToScreen = screenSpans.isNotEmpty() || screenKnown
    val apps = mutableListOf<AppDraft>()
    val hourApps = mutableMapOf<Int, MutableList<AppDraft>>()
    for ((pkg, spans) in raw) {
        val united = unionSpans(spans)
        val clipped = if (clipToScreen) intersect(united, screenSpans) else united
        if (clipToScreen && spanMs(clipped) < spanMs(united)) partial = true
        val total = spanMs(clipped)
        if (total <= 0L) continue
        apps.add(AppDraft(pkg, pkg, total))
        val byHour = mutableMapOf<Int, Long>()
        for (span in clipped) {
            var t = span.start
            while (t < span.end) {
                val next = min(span.end, nextHourEpoch(t, zone))
                if (next <= t) break
                val hour = Instant.ofEpochMilli(t).atZone(zone).hour
                byHour[hour] = (byHour[hour] ?: 0L) + (next - t)
                t = next
            }
        }
        for ((hour, ms) in byHour) {
            if (ms > 0L) hourApps.getOrPut(hour) { mutableListOf() }.add(AppDraft(pkg, pkg, ms))
        }
    }
    return AppBuild(apps.sortedByDescending { it.foregroundMs }, partial, hourApps)
}

private data class StatApps(val apps: List<AppDraft>, val partial: Boolean, val crossing: Boolean)

private fun appsFromUsageStats(stats: List<RawUsageStat>, dayStart: Long, dayEnd: Long, now: Long): StatApps {
    val windowEnd = min(now, dayEnd)
    val kept = mutableListOf<RawUsageStat>()
    var crossing = false
    for (stat in stats) {
        if (stat.packageName.isBlank() || stat.foregroundMs <= 0L) continue
        val overlaps = stat.firstTimestamp < windowEnd && stat.lastTimestamp > dayStart
        if (!overlaps) continue
        val contained = stat.firstTimestamp >= dayStart - SLACK_MS && stat.lastTimestamp <= dayEnd + SLACK_MS
        if (!contained) {
            crossing = true
            continue
        }
        kept.add(stat)
    }
    val byPackage = kept.groupBy { it.packageName }
    val apps = mutableListOf<AppDraft>()
    var partial = crossing
    for ((pkg, buckets) in byPackage) {
        val sorted = buckets.sortedBy { it.firstTimestamp }
        var total = 0L
        var visible = 0L
        var sawVisible = true
        var cursorEnd = Long.MIN_VALUE
        for (bucket in sorted) {
            if (bucket.firstTimestamp < cursorEnd) {
                partial = true
                total = max(total, bucket.foregroundMs)
            } else {
                total += bucket.foregroundMs
            }
            cursorEnd = max(cursorEnd, bucket.lastTimestamp)
            if (bucket.visibleMs == null) sawVisible = false else visible += bucket.visibleMs
            val alignedStart = abs(bucket.firstTimestamp - dayStart) <= SLACK_MS
            val alignedEnd = abs(bucket.lastTimestamp - dayEnd) <= SLACK_MS
            if (!(alignedStart && alignedEnd)) partial = true
        }
        if (total <= 0L || total > 26L * 3_600_000L) {
            partial = true
            continue
        }
        val visibleMs = if (sawVisible && visible > 0L && visible <= 26L * 3_600_000L) visible else null
        apps.add(AppDraft(pkg, pkg, total, visibleMs))
    }
    return StatApps(apps.sortedByDescending { it.foregroundMs }, partial, crossing)
}

private data class EventStatHit(val totalMs: Long, val partial: Boolean)

private fun screenFromEventStats(
    stats: List<RawEventStat>,
    dayStart: Long,
    dayEnd: Long,
    now: Long,
): EventStatHit? {
    val windowEnd = min(now, dayEnd)
    val matches = stats.filter { row ->
        row.eventType == SCREEN_INTERACTIVE &&
            row.totalTimeMs >= 0L &&
            abs(row.firstTimestamp - dayStart) <= SLACK_MS &&
            row.lastTimestamp <= dayEnd + SLACK_MS &&
            row.lastTimestamp <= windowEnd + SLACK_MS &&
            row.firstTimestamp < row.lastTimestamp
    }
    if (matches.isEmpty()) return null
    val best = matches.maxBy { it.lastTimestamp - it.firstTimestamp }
    val aligned = abs(best.lastTimestamp - dayEnd) <= SLACK_MS && abs(best.firstTimestamp - dayStart) <= SLACK_MS
    if (!aligned && best.totalTimeMs == 0L) return null
    val disagree = matches.any { it.totalTimeMs != best.totalTimeMs }
    val today = now < dayEnd
    return EventStatHit(best.totalTimeMs, partial = !aligned || today || disagree)
}

fun assemble(input: ObservationInput, deviceId: String, deviceLabel: String): AssembleResult {
    if (input.events == null && input.eventStats == null && input.usageStats == null) {
        return AssembleResult(Outcome.UNAVAILABLE, emptyList(), 0, null)
    }
    val zone = input.zone
    val today = civilDate(input.nowEpochMs, zone)
    val eventsFrom = input.events?.minOfOrNull { it.timestamp }
    val days = mutableListOf<DayDraft>()
    var dropped = 0
    var date = today.minusDays(HISTORY_DAYS)
    while (!date.isAfter(today)) {
        val (dayStart, dayEnd) = dayBounds(date, zone)
        if (input.nowEpochMs > dayStart) {
            val windowEnd = min(input.nowEpochMs, dayEnd)
            val draft = draftForDay(
                date = date.toString(),
                dayStart = dayStart,
                dayEnd = dayEnd,
                windowEnd = windowEnd,
                input = input,
                deviceId = deviceId,
                recordedAt = recordedAt(input.nowEpochMs),
            )
            if (draft == null) {
                if (crossedDay(input, dayStart, dayEnd)) dropped += 1
            } else {
                days.add(draft.copy(apps = draft.apps?.map { it.copy(label = it.label.ifBlank { deviceLabel }) }))
            }
        }
        date = date.plusDays(1)
    }
    val outcome = when {
        days.isEmpty() && dropped == 0 -> Outcome.EMPTY
        else -> Outcome.OBSERVED
    }
    return AssembleResult(outcome, days, dropped, eventsFrom)
}

private fun crossedDay(input: ObservationInput, dayStart: Long, dayEnd: Long): Boolean {
    val stats = input.usageStats ?: return false
    return stats.any { stat ->
        stat.foregroundMs > 0L &&
            stat.firstTimestamp < dayEnd &&
            stat.lastTimestamp > dayStart &&
            (stat.firstTimestamp < dayStart - SLACK_MS || stat.lastTimestamp > dayEnd + SLACK_MS)
    }
}

private fun draftForDay(
    date: String,
    dayStart: Long,
    dayEnd: Long,
    windowEnd: Long,
    input: ObservationInput,
    deviceId: String,
    recordedAt: String,
): DayDraft? {
    val zone = input.zone
    val todayPartial = windowEnd < dayEnd
    var screenMs: Long? = null
    var unlockedMs: Long? = null
    var basis: String? = null
    var method: String? = null
    var partial = false
    var detail: String? = null
    var hours: List<HourDraft>? = null
    var eventApps: AppBuild? = null

    val events = input.events
    if (events != null) {
        val screen = buildSpans(events, dayStart, windowEnd, SCREEN_INTERACTIVE, SCREEN_NON_INTERACTIVE, zone)
        val known = (windowEnd - dayStart) - screen.unknownMs
        if (known > 0L) {
            screenMs = screen.hourOn.values.sum()
            partial = screen.unknownMs > 0L || todayPartial
            val hidden = buildSpans(events, dayStart, windowEnd, KEYGUARD_HIDDEN, KEYGUARD_SHOWN, zone)
            val keyguardKnown = hidden.unknownMs < (windowEnd - dayStart)
            if (keyguardKnown) {
                unlockedMs = spanMs(intersect(screen.spans, hidden.spans))
                if (unlockedMs!! > (screenMs ?: 0L)) unlockedMs = screenMs
                basis = "unlocked-interactive"
                if (hidden.unknownMs > 0L) partial = true
            } else {
                basis = "screen-interactive"
            }
            method = "events"
            detail = if (basis == "unlocked-interactive") {
                "Unlocked and interactive, from screen and keyguard events. It is one span of time, not a sum of apps."
            } else {
                "Screen interactive, from screen events. Keyguard events were not available, so this can include the lock screen. It is a duration, not a count of times the screen came on."
            }
            if (partial && screen.unknownMs > 0L) detail += " A gap with no event was left out."
            if (todayPartial) detail += " Today is still open."
            eventApps = appSpans(events, dayStart, windowEnd, screen.spans, known > 0L && screen.unknownMs == 0L, zone)
            hours = hourDrafts(screen, hidden, keyguardKnown, eventApps, todayPartial, input.nowEpochMs, zone, dayEnd)
        }
    }

    if (screenMs == null && input.eventStats != null) {
        val hit = screenFromEventStats(input.eventStats, dayStart, dayEnd, input.nowEpochMs)
        if (hit != null) {
            screenMs = hit.totalMs
            basis = "screen-interactive"
            method = "event-stats"
            partial = hit.partial
            detail = if (hit.partial) {
                "Screen interactive from Android event stats. The bucket does not cover this whole Sydney day, so only the contained part is kept. It is how long the event was active, not a count of times the screen came on."
            } else {
                "Screen interactive from Android event stats. The bucket timestamps match this Sydney day. It is how long the event was active, not a count of times the screen came on."
            }
        }
    }

    var apps = eventApps?.apps
    var appsPartial = eventApps?.partial == true
    var appsMethod: String? = if (!apps.isNullOrEmpty()) "events" else null
    var appsDetail: String? = if (!apps.isNullOrEmpty()) {
        "Foreground time is per app, with that app's own activities overlapped into one span. Apps can overlap each other on a fold. This is not the screen total."
    } else {
        null
    }
    if (apps.isNullOrEmpty() && input.usageStats != null) {
        val fromStats = appsFromUsageStats(input.usageStats, dayStart, dayEnd, input.nowEpochMs)
        if (fromStats.apps.isNotEmpty()) {
            apps = fromStats.apps
            appsPartial = fromStats.partial
            appsMethod = "usage-stats"
            appsDetail = "Foreground time from Android usage stats contained in this Sydney day. Buckets that crossed midnight were left out. Apps can overlap on a fold. This is not the screen total."
        }
    }

    if (screenMs == null && apps.isNullOrEmpty()) return null
    if (screenMs != null && screenMs > 26L * 3_600_000L) return null
    return DayDraft(
        date = date,
        deviceId = deviceId,
        recordedAt = recordedAt,
        screenInteractiveMs = if (basis == "unlocked-interactive") screenMs else screenMs,
        unlockedInteractiveMs = unlockedMs,
        basis = basis,
        method = method,
        partial = partial,
        detail = detail,
        apps = apps?.takeIf { it.isNotEmpty() },
        appsMethod = appsMethod,
        appsPartial = appsPartial,
        appsDetail = appsDetail,
        hours = hours?.takeIf { it.isNotEmpty() },
    )
}

private fun hourDrafts(
    screen: SpanResult,
    hidden: SpanResult,
    keyguardKnown: Boolean,
    apps: AppBuild?,
    todayPartial: Boolean,
    now: Long,
    zone: ZoneId,
    dayEnd: Long,
): List<HourDraft> {
    val currentHour = if (todayPartial && now > 0L) Instant.ofEpochMilli(now - 1).atZone(zone).hour else null
    val unlockedByHour = if (keyguardKnown) {
        val slices = mutableMapOf<Int, Long>()
        for (span in intersect(screen.spans, hidden.spans)) {
            var t = span.start
            while (t < span.end) {
                val next = min(span.end, nextHourEpoch(t, zone))
                if (next <= t) break
                val hour = Instant.ofEpochMilli(t).atZone(zone).hour
                slices[hour] = (slices[hour] ?: 0L) + (next - t)
                t = next
            }
        }
        slices
    } else {
        emptyMap()
    }
    val hours = mutableListOf<HourDraft>()
    for (hour in 0..23) {
        val on = screen.hourOn[hour]
        val off = screen.hourOff[hour]
        val unknown = screen.hourUnknown[hour] ?: 0L
        val hourApps = apps?.hourApps?.get(hour)?.takeIf { it.isNotEmpty() }
        if (on == null && off == null && hourApps == null) continue
        val screenMs: Long? = when {
            on != null -> on
            off != null -> 0L
            else -> null
        }
        val unlocked = if (keyguardKnown && screenMs != null) min(unlockedByHour[hour] ?: 0L, screenMs) else null
        hours.add(
            HourDraft(
                hour = hour,
                screenInteractiveMs = screenMs,
                unlockedInteractiveMs = unlocked,
                partial = unknown > 0L || hour == currentHour,
                apps = hourApps,
            ),
        )
    }
    if (todayPartial && now >= dayEnd) return hours
    return hours
}

sealed class QueryDecision {
    data object Denied : QueryDecision()
    data object Locked : QueryDecision()
    data object Unavailable : QueryDecision()
    data class Ready(val input: ObservationInput) : QueryDecision()
}

/** Locked or null results never become an empty list that could be stored as zero. */
fun decideQuery(
    accessGranted: Boolean,
    userUnlocked: Boolean,
    events: List<RawEvent>?,
    eventStats: List<RawEventStat>?,
    usageStats: List<RawUsageStat>?,
    nowEpochMs: Long,
): QueryDecision {
    if (!accessGranted) return QueryDecision.Denied
    if (!userUnlocked) return QueryDecision.Locked
    if (events == null && eventStats == null && usageStats == null) return QueryDecision.Unavailable
    return QueryDecision.Ready(ObservationInput(events, eventStats, usageStats, nowEpochMs))
}
