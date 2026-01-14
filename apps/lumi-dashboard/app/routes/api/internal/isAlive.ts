import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/isAlive")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("OK", { status: 200 });
      },
    },
  },
});
