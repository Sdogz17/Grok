package io.github.sdogz17.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Process
import android.os.UserManager
import io.github.sdogz17.screentime.model.AppDraft
import io.github.sdogz17.screentime.model.Attempt
import io.github.sdogz17.screentime.model.ObservationInput
import io.github.sdogz17.screentime.model.Outcome
import io.github.sdogz17.screentime.model.QueryDecision
import io.github.sdogz17.screentime.model.RawEvent
import io.github.sdogz17.screentime.model.RawEventStat
import io.github.sdogz17.screentime.model.RawUsageStat
import io.github.sdogz17.screentime.model.StoredDevice
import io.github.sdogz17.screentime.model.StoredDocument
import io.github.sdogz17.screentime.model.applyAttempt
import io.github.sdogz17.screentime.model.applyLabels
import io.github.sdogz17.screentime.model.assemble
import io.github.sdogz17.screentime.model.decideQuery
import io.github.sdogz17.screentime.model.emptyDocument
import io.github.sdogz17.screentime.model.parseDocument
import io.github.sdogz17.screentime.model.toJson
import java.io.File
import java.time.Duration
import java.time.ZoneId
import java.util.UUID

object UsageRefresh {
    fun repository(context: Context): StoreRepository =
        StoreRepository(File(context.filesDir, "screentime.json"))

    fun refresh(context: Context, now: Long = System.currentTimeMillis()): String {
        val repo = repository(context)
        val existing = try {
            repo.read()
        } catch (_: Exception) {
            return emptyDocument().copy(
                status = emptyDocument().status.copy(
                    lastResult = "error",
                    lastDetail = "Saved screen time could not be read. It was not overwritten.",
                ),
            ).toJson()
        }
        val zone = ZoneId.systemDefault().id
        val access = hasUsageAccess(context)
        val unlocked = isUserUnlocked(context)
        val decision = when {
            !access -> QueryDecision.Denied
            !unlocked -> QueryDecision.Locked
            else -> load(context, now)
        }
        val phone = phoneFor(existing, deviceLabel())
        val attempt = attemptFor(decision, now, zone, phone, context)
        return repo.update { current ->
            applyAttempt(current, attempt, phone.takeIf { attempt is Attempt.Observed })
        }.toJson()
    }

    fun delete(context: Context) {
        repository(context).delete()
        File(context.cacheDir, "exports/screentime.json").delete()
    }

    private fun attemptFor(
        decision: QueryDecision,
        now: Long,
        zone: String,
        phone: StoredDevice,
        context: Context,
    ): Attempt = when (decision) {
        QueryDecision.Denied -> Attempt.Denied(now, zone)
        QueryDecision.Locked -> Attempt.Locked(now, zone)
        QueryDecision.Unavailable -> Attempt.Unavailable(now, zone)
        is QueryDecision.Ready -> {
            val result = assemble(decision.input, phone.id, phone.label)
            val labeled = applyLabels(result.days, labelsFor(context, result.days.flatMap { it.apps.orEmpty() }))
            when (result.outcome) {
                Outcome.UNAVAILABLE -> Attempt.Unavailable(now, zone)
                Outcome.EMPTY -> Attempt.Empty(now, zone)
                Outcome.OBSERVED -> Attempt.Observed(
                    at = now,
                    zone = zone,
                    days = labeled,
                    droppedUnalignedDays = result.droppedUnalignedDays,
                    eventsRetainedFrom = result.eventsRetainedFrom,
                    detail = observedDetail(result, zone),
                )
            }
        }
    }

    private fun load(context: Context, now: Long): QueryDecision {
        val manager = context.getSystemService(UsageStatsManager::class.java) ?: return QueryDecision.Unavailable
        val begin = now - Duration.ofDays(62).toMillis()
        return try {
            val usage = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, begin, now)
            val events = manager.queryEvents(begin, now)
            val eventStats = manager.queryEventStats(UsageStatsManager.INTERVAL_DAILY, begin, now)
            decideQuery(
                accessGranted = true,
                userUnlocked = true,
                events = events?.toRawEvents(),
                eventStats = eventStats?.map { stat ->
                    RawEventStat(
                        eventType = stat.eventType,
                        firstTimestamp = stat.firstTimeStamp,
                        lastTimestamp = stat.lastTimeStamp,
                        totalTimeMs = stat.totalTime,
                        count = stat.count,
                    )
                },
                usageStats = usage?.mapNotNull { stat ->
                    val name = stat.packageName ?: return@mapNotNull null
                    if (name.isBlank()) return@mapNotNull null
                    RawUsageStat(
                        packageName = name,
                        firstTimestamp = stat.firstTimeStamp,
                        lastTimestamp = stat.lastTimeStamp,
                        foregroundMs = stat.totalTimeInForeground,
                        visibleMs = stat.totalTimeVisible.takeIf { it > 0L },
                    )
                },
                nowEpochMs = now,
            )
        } catch (_: SecurityException) {
            QueryDecision.Denied
        } catch (_: Exception) {
            QueryDecision.Unavailable
        }
    }
}

internal fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(AppOpsManager::class.java) ?: return false
    val mode = appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
}

internal fun isUserUnlocked(context: Context): Boolean {
    val users = context.getSystemService(UserManager::class.java) ?: return false
    return users.isUserUnlocked
}

internal fun deviceLabel(): String {
    val maker = android.os.Build.MANUFACTURER.replaceFirstChar { it.titlecase() }
    return "$maker ${android.os.Build.MODEL}".trim().take(80).ifBlank { "Android phone" }
}

internal fun phoneFor(document: StoredDocument, label: String): StoredDevice {
    val existing = document.devices.firstOrNull { it.platform == "android" }
    if (existing != null) return existing.copy(label = label)
    return StoredDevice(UUID.randomUUID().toString(), label, "android")
}

private fun labelsFor(context: Context, apps: List<AppDraft>): Map<String, String> {
    val manager = context.packageManager
    return apps.map { it.id }.distinct().associateWith { id ->
        try {
            val info = manager.getApplicationInfo(id, 0)
            manager.getApplicationLabel(info)?.toString()?.take(80)?.ifBlank { id } ?: id
        } catch (_: PackageManager.NameNotFoundException) {
            id
        }
    }
}

private fun observedDetail(result: io.github.sdogz17.screentime.model.AssembleResult, zone: String): String {
    val dropped = if (result.droppedUnalignedDays > 0) {
        " ${result.droppedUnalignedDays} buckets crossed a Sydney midnight and were left out."
    } else {
        ""
    }
    val zoneNote = if (zone == "Australia/Sydney") "" else " This phone is set to $zone."
    return "Read ${result.days.size} days from usage stats.$dropped$zoneNote".take(400)
}

private fun UsageEvents.toRawEvents(): List<RawEvent> {
    val out = mutableListOf<RawEvent>()
    val event = UsageEvents.Event()
    while (hasNextEvent()) {
        getNextEvent(event)
        out.add(RawEvent(event.eventType, event.timeStamp, event.packageName))
    }
    return out
}

class StoreRepository(private val file: File) {
    private val lock = Any()

    fun read(): StoredDocument = synchronized(lock) {
        if (!file.exists() || file.length() == 0L) return emptyDocument()
        parseDocument(file.readText())
    }

    fun update(block: (StoredDocument) -> StoredDocument): StoredDocument = synchronized(lock) {
        val next = block(read())
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(next.toJson())
        if (!tmp.renameTo(file)) {
            file.writeText(tmp.readText())
            tmp.delete()
        }
        next
    }

    fun delete() {
        synchronized(lock) { file.delete() }
    }
}
