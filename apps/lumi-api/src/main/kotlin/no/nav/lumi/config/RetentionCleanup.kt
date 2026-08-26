package no.nav.lumi.config

import io.ktor.server.application.Application
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import no.nav.lumi.service.FeedbackRetentionService
import org.slf4j.LoggerFactory
import java.time.Duration

private val retentionLog = LoggerFactory.getLogger("RetentionCleanup")

fun Application.configureRetentionCleanup(
    service: FeedbackRetentionService = FeedbackRetentionService(),
    interval: Duration = Duration.ofDays(1),
) {
    if (!ServerEnv.current.nais.isNais) {
        retentionLog.info("Automatic retention scheduler is disabled outside NAIS")
        return
    }

    launch {
        while (isActive) {
            runCatching {
                withContext(Dispatchers.IO) { service.runOnce() }
            }
            delay(interval.toMillis())
        }
    }
}
