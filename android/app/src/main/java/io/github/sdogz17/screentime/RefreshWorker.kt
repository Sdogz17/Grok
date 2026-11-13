package io.github.sdogz17.screentime

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Best-effort refresh. WorkManager does not promise a clock time, and a locked phone writes nothing. */
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        UsageRefresh.refresh(applicationContext)
        return Result.success()
    }
}
