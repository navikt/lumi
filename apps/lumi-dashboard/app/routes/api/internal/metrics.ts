import { createFileRoute } from "@tanstack/react-router";
import { collectDefaultMetrics, register } from "prom-client";

// Collect default Node.js metrics (event loop, heap, etc.)
collectDefaultMetrics();

export const Route = createFileRoute("/api/internal/metrics")({
  server: {
    handlers: {
      GET: async () => {
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
