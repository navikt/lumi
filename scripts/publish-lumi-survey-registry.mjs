import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@navikt/lumi-survey";
const NPMJS_REGISTRY = "https://registry.npmjs.org";
const GITHUB_REGISTRY = "https://npm.pkg.github.com";
const ALLOWED_REGISTRIES = new Set([NPMJS_REGISTRY, GITHUB_REGISTRY]);
const ALLOWED_MODES = new Set(["check", "publish", "verify"]);

function fail(message) {
  throw new Error(`[publish:lumi-survey] ${message}`);
}

export function normalizeRegistryUrl(registryUrl) {
  const normalized = registryUrl.replace(/\/+$/, "");
  if (!ALLOWED_REGISTRIES.has(normalized)) {
    fail(`Unsupported registry: ${registryUrl}`);
  }
  return normalized;
}

export function registryPackageUrl(registryUrl, name) {
  return `${normalizeRegistryUrl(registryUrl)}/${encodeURIComponent(name)}`;
}

export function publicationDecision(localDigests, publishedDigests) {
  if (publishedDigests === undefined) return "publish";
  if (
    publishedDigests.shasum === localDigests.shasum &&
    publishedDigests.integrity === localDigests.integrity
  ) {
    return "skip";
  }
  fail(
    "Version already exists with a different tarball digest. Refusing to continue.",
  );
}

export function publishedVersionDigests(metadata, version) {
  const publishedVersion = metadata?.versions?.[version];
  if (publishedVersion === undefined) return undefined;

  const shasum = publishedVersion?.dist?.shasum;
  if (typeof shasum !== "string" || !/^[0-9a-f]{40}$/i.test(shasum)) {
    fail(`Registry metadata for version ${version} has no valid dist.shasum.`);
  }
  const integrity = publishedVersion?.dist?.integrity;
  if (
    typeof integrity !== "string" ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)
  ) {
    fail(
      `Registry metadata for version ${version} has no valid dist.integrity.`,
    );
  }
  return { shasum: shasum.toLowerCase(), integrity };
}

export function readPackedManifest(tarballPath) {
  let manifest;
  try {
    manifest = execFileSync(
      "tar",
      ["-xOf", tarballPath, "package/package.json"],
      { encoding: "utf8" },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    fail(`Could not read package/package.json from ${tarballPath}: ${details}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    fail(`${tarballPath} contains an invalid package.json.`);
  }

  if (parsed.name !== PACKAGE_NAME) {
    fail(`Expected ${PACKAGE_NAME}, found ${String(parsed.name)}.`);
  }
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    fail(`${tarballPath} does not contain a valid package version.`);
  }

  return { name: parsed.name, version: parsed.version };
}

export function tarballDigests(tarballPath) {
  const tarball = readFileSync(tarballPath);
  return {
    shasum: createHash("sha1").update(tarball).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
  };
}

export function buildPublishArguments(tarballPath, registryUrl) {
  const normalizedRegistryUrl = normalizeRegistryUrl(registryUrl);
  const publishArguments = [
    "publish",
    tarballPath,
    `--registry=${normalizedRegistryUrl}`,
    `--@navikt:registry=${normalizedRegistryUrl}`,
    "--access=public",
    "--ignore-scripts",
  ];
  if (normalizedRegistryUrl === NPMJS_REGISTRY) {
    publishArguments.push("--provenance");
  }
  return publishArguments;
}

async function publishedDigests({
  registryUrl,
  name,
  version,
  token,
  fetchImplementation = fetch,
}) {
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetchImplementation(
    registryPackageUrl(registryUrl, name),
    { headers },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) {
    fail(
      `Registry lookup failed with HTTP ${response.status} ${response.statusText}.`,
    );
  }

  const metadata = await response.json();
  return publishedVersionDigests(metadata, version);
}

export function parseArguments(arguments_) {
  const values = new Map();
  for (const argument of arguments_) {
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator === -1) {
      fail(`Unknown argument: ${argument}`);
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }

  const tarballPath = values.get("tarball");
  const registryUrl = values.get("registry");
  const mode = values.get("mode") ?? "publish";
  const hasUnknownKey = [...values.keys()].some(
    (key) => !["tarball", "registry", "mode"].includes(key),
  );
  if (
    !tarballPath ||
    !registryUrl ||
    hasUnknownKey ||
    !ALLOWED_MODES.has(mode) ||
    values.size < 2 ||
    values.size > 3
  ) {
    fail(
      "Usage: --tarball=<path> --registry=<url> [--mode=check|publish|verify]",
    );
  }
  return {
    tarballPath: path.resolve(tarballPath),
    registryUrl: normalizeRegistryUrl(registryUrl),
    mode,
  };
}

export async function runPublication({
  tarballPath,
  registryUrl,
  mode = "publish",
  environment = process.env,
  fetchImplementation = fetch,
  spawnImplementation = spawnSync,
}) {
  if (!ALLOWED_MODES.has(mode)) {
    fail(`Unsupported mode: ${mode}`);
  }

  const normalizedRegistryUrl = normalizeRegistryUrl(registryUrl);
  const { name, version } = readPackedManifest(tarballPath);
  const localDigests = tarballDigests(tarballPath);
  const isGitHubPackages = normalizedRegistryUrl === GITHUB_REGISTRY;
  const readToken = isGitHubPackages ? environment.NODE_AUTH_TOKEN : undefined;

  if (isGitHubPackages && !readToken) {
    fail("NODE_AUTH_TOKEN is required for GitHub Packages.");
  }

  const remoteDigests = await publishedDigests({
    registryUrl: normalizedRegistryUrl,
    name,
    version,
    token: readToken,
    fetchImplementation,
  });
  const decision = publicationDecision(localDigests, remoteDigests);
  if (decision === "skip") {
    console.log(
      `[publish:lumi-survey] ${name}@${version} already exists in ${normalizedRegistryUrl} with the same tarball; skipping.`,
    );
    return decision;
  }

  if (mode === "verify") {
    fail(
      `${name}@${version} is not published in ${normalizedRegistryUrl}; expected an identical published version.`,
    );
  }

  if (mode === "check") {
    console.log(
      `[publish:lumi-survey] ${name}@${version} is not published in ${normalizedRegistryUrl}; preflight passed.`,
    );
    return decision;
  }

  const publishEnvironment = { ...environment };
  if (!isGitHubPackages) {
    delete publishEnvironment.NODE_AUTH_TOKEN;
    delete publishEnvironment.NPM_AUTH_TOKEN;
  }

  const result = spawnImplementation(
    "npm",
    buildPublishArguments(tarballPath, normalizedRegistryUrl),
    {
      env: publishEnvironment,
      stdio: "inherit",
    },
  );
  if (result.error)
    fail(`Could not start npm publish: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`npm publish exited with status ${String(result.status)}.`);
  }
  return decision;
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  await runPublication(arguments_);
}

if (
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
