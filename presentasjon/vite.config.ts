import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Comments left in the deck with K, in development only. They are kept in
 * `.local-notes/kommentarer.json`, which git ignores, so the author and the
 * one fixing the slides share a list without a service.
 */
function comments(): Plugin {
  const file = resolve(here, ".local-notes/kommentarer.json");
  const read = (): Record<string, unknown>[] => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return [];
    }
  };
  const write = (all: Record<string, unknown>[]) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, `${JSON.stringify(all, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
  };
  const body = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((done, fail) => {
      let text = "";
      req.on("data", (chunk) => {
        text += chunk;
      });
      req.on("end", () => {
        try {
          done(text ? JSON.parse(text) : {});
        } catch (error) {
          fail(error);
        }
      });
    });
  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value));
  };

  return {
    name: "deck-comments",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__kommentarer", async (req, res) => {
        try {
          const id = (req.url ?? "/").replace(/^\/+|\/+$/g, "");
          const all = read();
          if (req.method === "GET") return send(res, 200, all);
          if (req.method === "POST" && !id) {
            const input = await body(req);
            const text = String(input.text ?? "").trim();
            if (!text) return send(res, 400, { error: "Tom kommentar" });
            const comment = {
              id: `k${Date.now().toString(36)}`,
              created: new Date().toISOString(),
              slideId: String(input.slideId ?? ""),
              step: Number(input.step ?? 0),
              room: input.room ?? null,
              style: input.style ?? null,
              x: Math.round(Number(input.x ?? 0)),
              y: Math.round(Number(input.y ?? 0)),
              target: String(input.target ?? ""),
              text,
              status: "open",
            };
            write([...all, comment]);
            return send(res, 201, comment);
          }
          const index = all.findIndex((comment) => comment.id === id);
          if (index === -1) return send(res, 404, { error: "Finnes ikke" });
          if (req.method === "PATCH") {
            const input = await body(req);
            const next = { ...all[index] };
            if (input.status === "open" || input.status === "fixed") {
              next.status = input.status;
            }
            if (typeof input.reply === "string") next.reply = input.reply;
            all[index] = next;
            write(all);
            return send(res, 200, next);
          }
          if (req.method === "DELETE") {
            write(all.filter((_, i) => i !== index));
            return send(res, 204, null);
          }
          return send(res, 405, { error: "Ikke støttet" });
        } catch (error) {
          return send(res, 500, { error: String(error) });
        }
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the built deck works from any sub-path.
  base: "./",
  plugins: [react(), comments()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // React, Aksel and the widget ship as one bundle on purpose: a talk
    // loads once and must not wait for chunks mid-way.
    chunkSizeWarningLimit: 800,
  },
});
