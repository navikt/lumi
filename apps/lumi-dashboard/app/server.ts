import type { Register } from "@tanstack/react-router";
import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";

const fetch = createStartHandler(async (ctx) => {
  // Temporary diagnostic: disable runtime manifest mutation while isolating hydration mismatch.
  return defaultStreamHandler(ctx);
});

export type ServerEntry = { fetch: RequestHandler<Register> };

export default createServerEntry({ fetch } satisfies ServerEntry);
