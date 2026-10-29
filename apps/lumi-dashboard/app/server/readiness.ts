import { serverEnvSchema } from "~/serverEnvSchema";

export function readinessResponse(): Response {
  // Validate only our configuration. An API outage must not take the
  // dashboard itself out of service.
  const ready = serverEnvSchema.safeParse(process.env).success;
  return new Response(ready ? "OK" : "Invalid server configuration", {
    status: ready ? 200 : 503,
  });
}
