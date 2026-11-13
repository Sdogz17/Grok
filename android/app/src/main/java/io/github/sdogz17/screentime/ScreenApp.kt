package io.github.sdogz17.screentime

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class ScreenApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val request = PeriodicWorkRequestBuilder<RefreshWorker>(12, TimeUnit.HOURS).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "screentime-refresh",
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}
