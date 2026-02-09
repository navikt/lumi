import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RouterManagedTag } from "@tanstack/router-core";

type ManifestLike = {
  routes: Record<
    string,
    {
      assets?: Array<RouterManagedTag>;
    }
  >;
};

const SRI_PREFIX = "sha384-";
const SRI_ASSET_EXTENSIONS = new Set([".js", ".css"]);
const SRI_LINK_RELS = new Set(["stylesheet", "modulepreload"]);
const patchedManifests = new WeakSet<ManifestLike>();

let cachedIntegrityMap: Map<string, string> | null = null;
let loadingIntegrityMap: Promise<Map<string, string>> | null = null;

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function normalizeAssetPathFromUrl(urlLike: string): string | null {
  try {
    const parsed = new URL(urlLike, "http://localhost");
    const pathname = parsed.pathname;
    const clientSegment = "/client/";
    const clientIndex = pathname.indexOf(clientSegment);
    if (clientIndex >= 0) {
      const relative = pathname.slice(clientIndex + clientSegment.length);
      if (relative.length > 0) {
        return `/${relative}`;
      }
    }

    return pathname;
  } catch {
    return null;
  }
}

function sha384Base64(content: Buffer): string {
  return createHash("sha384").update(content).digest("base64");
}

async function collectIntegrityEntries(
  directory: string,
  rootDirectory: string,
  map: Map<string, string>,
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectIntegrityEntries(absolutePath, rootDirectory, map);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (!SRI_ASSET_EXTENSIONS.has(extension)) {
      continue;
    }

    const fileContents = await fs.readFile(absolutePath);
    const relativePath = toPosixPath(
      path.relative(rootDirectory, absolutePath),
    );
    const assetPath = `/${relativePath}`;
    const integrity = `${SRI_PREFIX}${sha384Base64(fileContents)}`;
    map.set(assetPath, integrity);
  }
}

async function buildIntegrityMap(): Promise<Map<string, string>> {
  const publicOutputDirectory = path.resolve(process.cwd(), ".output/public");
  const map = new Map<string, string>();
  await collectIntegrityEntries(
    publicOutputDirectory,
    publicOutputDirectory,
    map,
  );
  return map;
}

async function getIntegrityMap(): Promise<Map<string, string>> {
  if (cachedIntegrityMap) {
    return cachedIntegrityMap;
  }

  if (!loadingIntegrityMap) {
    loadingIntegrityMap = buildIntegrityMap();
  }

  try {
    cachedIntegrityMap = await loadingIntegrityMap;
    return cachedIntegrityMap;
  } finally {
    loadingIntegrityMap = null;
  }
}

function integrityForUrl(
  urlLike: string,
  integrityByPath: Map<string, string>,
): string | undefined {
  const normalizedAssetPath = normalizeAssetPathFromUrl(urlLike);
  if (!normalizedAssetPath) {
    return undefined;
  }

  if (integrityByPath.has(normalizedAssetPath)) {
    return integrityByPath.get(normalizedAssetPath);
  }

  const assetsMarker = "/assets/";
  const markerIndex = normalizedAssetPath.indexOf(assetsMarker);
  if (markerIndex >= 0) {
    const assetsRelativePath = normalizedAssetPath.slice(markerIndex);
    return integrityByPath.get(assetsRelativePath);
  }

  return undefined;
}

function asStringAttribute(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function patchAssetTag(
  asset: RouterManagedTag,
  integrityByPath: Map<string, string>,
): RouterManagedTag {
  if (asset.tag === "script") {
    const attrs = { ...(asset.attrs ?? {}) } as Record<string, unknown>;
    const src = asStringAttribute(attrs.src);

    if (src) {
      const integrity = integrityForUrl(src, integrityByPath);
      if (integrity) {
        attrs.integrity = integrity;
        attrs.crossorigin = "anonymous";
      }
      return { ...asset, attrs };
    }
  }

  if (asset.tag === "link") {
    const attrs = { ...(asset.attrs ?? {}) } as Record<string, unknown>;
    const rel = asStringAttribute(attrs.rel);
    const href = asStringAttribute(attrs.href);

    if (!rel || !SRI_LINK_RELS.has(rel) || !href) {
      return asset;
    }

    const integrity = integrityForUrl(href, integrityByPath);
    if (!integrity) {
      return asset;
    }

    attrs.integrity = integrity;
    attrs.crossorigin = "anonymous";
    return { ...asset, attrs };
  }

  return asset;
}

export function resetSriStateForTests(): void {
  cachedIntegrityMap = null;
  loadingIntegrityMap = null;
}

export async function applySriToManifest(
  manifest: ManifestLike | undefined,
): Promise<void> {
  if (!manifest || patchedManifests.has(manifest)) {
    return;
  }

  let integrityByPath: Map<string, string>;
  try {
    integrityByPath = await getIntegrityMap();
  } catch (error) {
    // If the runtime output tree is unavailable, leave manifest unchanged.
    console.warn("[sri] Unable to build integrity map", error);
    return;
  }

  for (const route of Object.values(manifest.routes)) {
    route.assets = (route.assets ?? []).map((asset) =>
      patchAssetTag(asset, integrityByPath),
    );
  }

  patchedManifests.add(manifest);
}
