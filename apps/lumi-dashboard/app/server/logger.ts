/**
 * Server-side logger using NAV standard @navikt/pino-logger.
 *
 * Outputs JSON format compatible with logs.adeo.no and Grafana.
 * For local dev, pipe output through pino-pretty:
 *   node server.js | pino-pretty --messageKey=message
 */
export { logger } from "@navikt/pino-logger";
