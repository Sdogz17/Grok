package io.github.sdogz17.screentime.model

import org.json.JSONArray
import org.json.JSONObject

data class StoredDevice(val id: String, val label: String, val platform: String)

data class StoredStatus(
    val usageAccess: String,
    val userUnlocked: Boolean?,
    val lastAttemptAt: String?,
    val lastSuccessAt: String?,
    val lastResult: String,
    val lastDetail: String,
    val deviceZone: String,
    val zoneMatches: Boolean,
    val eventsRetainedFrom: String?,
    val droppedUnalignedDays: Int,
)

data class StoredDocument(
    val devices: List<StoredDevice>,
    val days: List<DayDraft>,
    val status: StoredStatus,
)

fun emptyDocument(zone: String = "Australia/Sydney"): StoredDocument = StoredDocument(
    devices = emptyList(),
    days = emptyList(),
    status = StoredStatus(
        usageAccess = "unknown",
        userUnlocked = null,
        lastAttemptAt = null,
        lastSuccessAt = null,
        lastResult = "never",
        lastDetail = "This phone has not been read yet.",
        deviceZone = zone,
        zoneMatches = zone == "Australia/Sydney",
        eventsRetainedFrom = null,
        droppedUnalignedDays = 0,
    ),
)

sealed class Attempt {
    abstract val at: Long
    abstract val zone: String

    data class Denied(override val at: Long, override val zone: String) : Attempt()
    data class Locked(override val at: Long, override val zone: String) : Attempt()
    data class Unavailable(override val at: Long, override val zone: String) : Attempt()
    data class Failed(override val at: Long, override val zone: String, val detail: String) : Attempt()
    data class Empty(override val at: Long, override val zone: String) : Attempt()
    data class Observed(
        override val at: Long,
        override val zone: String,
        val days: List<DayDraft>,
        val droppedUnalignedDays: Int,
        val eventsRetainedFrom: Long?,
        val detail: String,
    ) : Attempt()
}

fun applyLabels(days: List<DayDraft>, labels: Map<String, String>): List<DayDraft> = days.map { day ->
    day.copy(
        apps = day.apps?.map { app -> app.copy(label = labels[app.id] ?: app.label) },
        hours = day.hours?.map { hour ->
            hour.copy(apps = hour.apps?.map { app -> app.copy(label = labels[app.id] ?: app.label) })
        },
    )
}

/**
 * A failed, locked, or empty read does not change stored days and does not write zeros.
 * A later observation for the same date and device replaces that day.
 */
fun applyAttempt(document: StoredDocument, attempt: Attempt, phone: StoredDevice? = null): StoredDocument {
    val at = recordedAt(attempt.at)
    val zoneMatches = attempt.zone == "Australia/Sydney"
    val base = document.status
    val status = when (attempt) {
        is Attempt.Denied -> base.copy(
            usageAccess = "denied",
            userUnlocked = null,
            lastAttemptAt = at,
            lastResult = "denied",
            lastDetail = "Usage access is off. Stored days were left as they were.",
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
        )
        is Attempt.Locked -> base.copy(
            usageAccess = "granted",
            userUnlocked = false,
            lastAttemptAt = at,
            lastResult = "locked",
            lastDetail = "The phone was locked, so usage stats were not read. Nothing was filled in as zero.",
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
        )
        is Attempt.Unavailable -> base.copy(
            usageAccess = "granted",
            userUnlocked = true,
            lastAttemptAt = at,
            lastResult = "unavailable",
            lastDetail = "Usage stats came back unavailable. Stored days were left as they were.",
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
        )
        is Attempt.Failed -> base.copy(
            usageAccess = "granted",
            userUnlocked = true,
            lastAttemptAt = at,
            lastResult = "error",
            lastDetail = attempt.detail.take(400),
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
        )
        is Attempt.Empty -> base.copy(
            usageAccess = "granted",
            userUnlocked = true,
            lastAttemptAt = at,
            lastSuccessAt = at,
            lastResult = "empty",
            lastDetail = "The read returned no usage rows. No day was set to zero.",
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
            droppedUnalignedDays = 0,
        )
        is Attempt.Observed -> base.copy(
            usageAccess = "granted",
            userUnlocked = true,
            lastAttemptAt = at,
            lastSuccessAt = at,
            lastResult = "ok",
            lastDetail = attempt.detail.take(400),
            deviceZone = attempt.zone,
            zoneMatches = zoneMatches,
            eventsRetainedFrom = attempt.eventsRetainedFrom?.let { recordedAt(it) },
            droppedUnalignedDays = attempt.droppedUnalignedDays,
        )
    }
    if (attempt !is Attempt.Observed) return document.copy(status = status)
    val devices = document.devices.toMutableList()
    if (phone != null && devices.none { it.id == phone.id }) devices.add(phone)
    else if (phone != null) {
        val index = devices.indexOfFirst { it.id == phone.id }
        if (index >= 0) devices[index] = phone
    }
    val days = document.days.associateBy { "${it.date}|${it.deviceId}" }.toMutableMap()
    for (day in attempt.days) days["${day.date}|${day.deviceId}"] = day
    return StoredDocument(
        devices = devices,
        days = days.values.sortedWith(compareBy({ it.date }, { it.deviceId })),
        status = status,
    )
}

fun StoredDocument.toJson(): String {
    val root = JSONObject()
    root.put("schema", "screentime.v1")
    root.put("timezone", "Australia/Sydney")
    root.put("devices", JSONArray().apply {
        for (device in devices) {
            put(JSONObject().put("id", device.id).put("label", device.label).put("platform", device.platform))
        }
    })
    root.put("days", JSONArray().apply { for (day in days) put(day.toJson()) })
    root.put("status", status.toJson())
    return root.toString(2)
}

fun parseDocument(text: String): StoredDocument {
    val root = JSONObject(text)
    if (root.getString("schema") != "screentime.v1") error("schema")
    if (root.getString("timezone") != "Australia/Sydney") error("timezone")
    val devices = root.getJSONArray("devices").let { array ->
        (0 until array.length()).map { index ->
            val item = array.getJSONObject(index)
            StoredDevice(item.getString("id"), item.getString("label"), item.getString("platform"))
        }
    }
    val days = root.getJSONArray("days").let { array ->
        (0 until array.length()).map { index -> array.getJSONObject(index).toDay() }
    }
    val status = if (root.has("status")) root.getJSONObject("status").toStatus() else emptyDocument().status
    return StoredDocument(devices, days, status)
}

private fun DayDraft.toJson(): JSONObject {
    val obj = JSONObject()
    obj.put("date", date)
    obj.put("deviceId", deviceId)
    obj.put(
        "source",
        JSONObject().put("kind", "android-usage-stats").put("name", "UsageStatsManager").put("recordedAt", recordedAt),
    )
    if (screenInteractiveMs != null) obj.put("screenInteractiveMs", screenInteractiveMs)
    if (unlockedInteractiveMs != null) obj.put("unlockedInteractiveMs", unlockedInteractiveMs)
    if (basis != null && method != null && detail != null) {
        obj.put(
            "deviceTotal",
            JSONObject().put("basis", basis).put("method", method).put("partial", partial).put("detail", detail),
        )
    }
    if (!apps.isNullOrEmpty() && appsMethod != null && appsDetail != null) {
        obj.put("apps", JSONArray().apply { for (app in apps) put(app.toJson()) })
        obj.put(
            "appsNote",
            JSONObject().put("method", appsMethod).put("partial", appsPartial).put("detail", appsDetail),
        )
    }
    if (!hours.isNullOrEmpty()) obj.put("hours", JSONArray().apply { for (hour in hours) put(hour.toJson()) })
    return obj
}

private fun AppDraft.toJson(): JSONObject {
    val obj = JSONObject().put("id", id).put("label", label).put("foregroundMs", foregroundMs)
    if (visibleMs != null) obj.put("visibleMs", visibleMs)
    return obj
}

private fun HourDraft.toJson(): JSONObject {
    val obj = JSONObject().put("hour", hour).put("partial", partial)
    if (screenInteractiveMs != null) obj.put("screenInteractiveMs", screenInteractiveMs)
    if (unlockedInteractiveMs != null) obj.put("unlockedInteractiveMs", unlockedInteractiveMs)
    if (!apps.isNullOrEmpty()) obj.put("apps", JSONArray().apply { for (app in apps) put(app.toJson()) })
    return obj
}

private fun StoredStatus.toJson(): JSONObject = JSONObject()
    .put("usageAccess", usageAccess)
    .put("userUnlocked", userUnlocked ?: JSONObject.NULL)
    .put("lastAttemptAt", lastAttemptAt ?: JSONObject.NULL)
    .put("lastSuccessAt", lastSuccessAt ?: JSONObject.NULL)
    .put("lastResult", lastResult)
    .put("lastDetail", lastDetail)
    .put("deviceZone", deviceZone)
    .put("zoneMatches", zoneMatches)
    .put("eventsRetainedFrom", eventsRetainedFrom ?: JSONObject.NULL)
    .put("droppedUnalignedDays", droppedUnalignedDays)

private fun JSONObject.toDay(): DayDraft {
    val total = optJSONObject("deviceTotal")
    val note = optJSONObject("appsNote")
    val apps = optJSONArray("apps")?.toApps()
    val hours = optJSONArray("hours")?.let { array ->
        (0 until array.length()).map { index -> array.getJSONObject(index).toHour() }
    }
    return DayDraft(
        date = getString("date"),
        deviceId = getString("deviceId"),
        recordedAt = getJSONObject("source").getString("recordedAt"),
        screenInteractiveMs = if (has("screenInteractiveMs")) getLong("screenInteractiveMs") else null,
        unlockedInteractiveMs = if (has("unlockedInteractiveMs")) getLong("unlockedInteractiveMs") else null,
        basis = total?.getString("basis"),
        method = total?.getString("method"),
        partial = total?.optBoolean("partial") ?: false,
        detail = total?.getString("detail"),
        apps = apps,
        appsMethod = note?.getString("method"),
        appsPartial = note?.optBoolean("partial") ?: false,
        appsDetail = note?.getString("detail"),
        hours = hours,
    )
}

private fun JSONObject.toHour(): HourDraft = HourDraft(
    hour = getInt("hour"),
    screenInteractiveMs = if (has("screenInteractiveMs")) getLong("screenInteractiveMs") else null,
    unlockedInteractiveMs = if (has("unlockedInteractiveMs")) getLong("unlockedInteractiveMs") else null,
    partial = getBoolean("partial"),
    apps = optJSONArray("apps")?.toApps(),
)

private fun JSONArray.toApps(): List<AppDraft> = (0 until length()).map { index ->
    val item = getJSONObject(index)
    AppDraft(
        id = item.getString("id"),
        label = item.getString("label"),
        foregroundMs = item.getLong("foregroundMs"),
        visibleMs = if (item.has("visibleMs")) item.getLong("visibleMs") else null,
    )
}

private fun JSONObject.toStatus(): StoredStatus = StoredStatus(
    usageAccess = getString("usageAccess"),
    userUnlocked = if (isNull("userUnlocked")) null else getBoolean("userUnlocked"),
    lastAttemptAt = if (isNull("lastAttemptAt")) null else getString("lastAttemptAt"),
    lastSuccessAt = if (isNull("lastSuccessAt")) null else getString("lastSuccessAt"),
    lastResult = getString("lastResult"),
    lastDetail = getString("lastDetail"),
    deviceZone = getString("deviceZone"),
    zoneMatches = getBoolean("zoneMatches"),
    eventsRetainedFrom = if (isNull("eventsRetainedFrom")) null else getString("eventsRetainedFrom"),
    droppedUnalignedDays = getInt("droppedUnalignedDays"),
)
