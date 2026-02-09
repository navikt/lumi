import type { Register } from "@tanstack/react-router";
import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { applySriToManifest } from "~/server/assetIntegrity";

const fetch = createStartHandler(async (ctx) => {
  if (process.env.NODE_ENV === "production") {
    await applySriToManifest(ctx.router.ssr?.manifest);
  }

  return defaultStreamHandler(ctx);
});

export type ServerEntry = { fetch: RequestHandler<Register> };

export default createServerEntry({ fetch } satisfies ServerEntry);
