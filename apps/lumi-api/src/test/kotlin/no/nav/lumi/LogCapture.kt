package no.nav.lumi

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import org.slf4j.LoggerFactory

/**
 * Collects the formatted messages a named logger writes while it is open.
 */
internal class CapturedLogs(loggerName: String) : AutoCloseable {
    private val logger = LoggerFactory.getLogger(loggerName) as Logger
    private val originalLevel: Level? = logger.level
    private val appender = ListAppender<ILoggingEvent>().apply { start() }

    init {
        logger.level = Level.DEBUG
        logger.addAppender(appender)
    }

    val messages: List<String>
        get() = appender.list.map { it.formattedMessage }

    /** Class names and messages of every logged throwable and its causes. */
    val throwableTexts: List<String>
        get() = appender.list.flatMap { event ->
            generateSequence(event.throwableProxy) { it.cause }
                .map { "${it.className}: ${it.message}" }
                .toList()
        }

    override fun close() {
        logger.detachAppender(appender)
        logger.level = originalLevel
    }
}
