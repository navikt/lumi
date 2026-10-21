import { collectDefaultMetrics, register } from "@prometheus-io/client";
import { createFileRoute } from "@tanstack/react-router";

// @navikt/oasis counts token exchanges in this registry too, so it must be the
// same package and version as the one oasis depends on.

// Collect default Node.js metrics (event loop, heap, etc.)
collectDefaultMetrics();

/**
 * Metrics should only be scraped internally (for example by Prometheus).
 * Requests arriving through public ingress typically include forwarded headers.
 */
export function isIngressRequest(request: Request): boolean {
  return Boolean(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("x-forwarded-proto"),
  );
}

export const Route = createFileRoute("/api/internal/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (isIngressRequest(request)) {
          return new Response("Not Found", { status: 404 });
        }

        const metrics = await register.metrics();
        return new Response(metrics, {
          headers: {
            "Content-Type": register.contentType,
          },
        });
      },
    },
  },
});
