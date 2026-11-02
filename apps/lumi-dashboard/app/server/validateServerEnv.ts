import { definePlugin } from "nitro";

import { serverEnvSchema } from "../serverEnvSchema";

/** Refuse invalid configuration before Nitro starts accepting requests. */
export default definePlugin(() => {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
  }
});
