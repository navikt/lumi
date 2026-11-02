import { createFileRoute } from "@tanstack/react-router";
import { readinessResponse } from "~/server/readiness";

export const Route = createFileRoute("/api/internal/isReady")({
  server: {
    handlers: {
      GET: () => readinessResponse(),
    },
  },
});
