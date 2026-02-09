import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RouterManagedTag } from "@tanstack/router-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySriToManifest,
  resetSriStateForTests,
} from "~/server/assetIntegrity";

type ManifestLike = NonNullable<Parameters<typeof applySriToManifest>[0]>;

const SRI_PREFIX = "sha384-";

function sha384(value: string): string {
  return `${SRI_PREFIX}${createHash("sha384").update(value).digest("base64")}`;
}

async function createAsset(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolutePath = path.join(root, ".output/public", relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf-8");
}

describe("applySriToManifest", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-sri-"));
    await fs.mkdir(path.join(tempRoot, ".output/public"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
    resetSriStateForTests();
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    resetSriStateForTests();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("adds integrity + crossorigin for script, stylesheet and modulepreload", async () => {
    await createAsset(tempRoot, "assets/main.js", "console.log('main');");
    await createAsset(tempRoot, "assets/main.css", "body{color:black;}");
    await createAsset(tempRoot, "assets/chunk.js", "console.log('chunk');");

    const manifest: ManifestLike = {
      routes: {
        "/": {
          assets: [
            {
              tag: "script",
              attrs: {
                src: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/main.js",
              },
            },
            {
              tag: "link",
              attrs: {
                rel: "stylesheet",
                href: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/main.css",
              },
            },
            {
              tag: "link",
              attrs: {
                rel: "modulepreload",
                href: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/chunk.js",
              },
            },
          ] satisfies Array<RouterManagedTag>,
        },
      },
    };

    await applySriToManifest(manifest);

    const [script, stylesheet, modulepreload] =
      manifest.routes["/"].assets ?? [];
    if (!script.attrs || !stylesheet.attrs || !modulepreload.attrs) {
      throw new Error("Expected attrs on patched assets");
    }

    expect(script.attrs.integrity).toBe(sha384("console.log('main');"));
    expect(stylesheet.attrs.integrity).toBe(sha384("body{color:black;}"));
    expect(modulepreload.attrs.integrity).toBe(sha384("console.log('chunk');"));

    expect(script.attrs.crossorigin).toBe("anonymous");
    expect(stylesheet.attrs.crossorigin).toBe("anonymous");
    expect(modulepreload.attrs.crossorigin).toBe("anonymous");
  });

  it("keeps assets unchanged when integrity hash is missing", async () => {
    const manifest: ManifestLike = {
      routes: {
        "/": {
          assets: [
            {
              tag: "script",
              attrs: {
                src: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/missing.js",
              },
            },
            {
              tag: "link",
              attrs: {
                rel: "stylesheet",
                href: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/missing.css",
              },
            },
          ] satisfies Array<RouterManagedTag>,
        },
      },
    };

    await applySriToManifest(manifest);

    const [script, stylesheet] = manifest.routes["/"].assets ?? [];
    if (!script.attrs || !stylesheet.attrs) {
      throw new Error("Expected attrs on assets");
    }

    expect(script.attrs.integrity).toBeUndefined();
    expect(script.attrs.crossorigin).toBeUndefined();
    expect(stylesheet.attrs.integrity).toBeUndefined();
    expect(stylesheet.attrs.crossorigin).toBeUndefined();
  });

  it("does not add integrity for non-SRI link rel values", async () => {
    await createAsset(tempRoot, "assets/font.woff2", "binary-ish");

    const manifest: ManifestLike = {
      routes: {
        "/": {
          assets: [
            {
              tag: "link",
              attrs: {
                rel: "preconnect",
                href: "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/font.woff2",
              },
            },
          ] satisfies Array<RouterManagedTag>,
        },
      },
    };

    await applySriToManifest(manifest);

    const [link] = manifest.routes["/"].assets ?? [];
    if (!link.attrs) {
      throw new Error("Expected attrs on asset");
    }

    expect(link.attrs.integrity).toBeUndefined();
    expect(link.attrs.crossorigin).toBeUndefined();
  });
});
