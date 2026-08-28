import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPublishArguments,
  normalizeRegistryUrl,
  parseArguments,
  publicationDecision,
  publishedVersionDigests,
  readPackedManifest,
  registryPackageUrl,
  runPublication,
  tarballDigests,
} from "./publish-lumi-survey-registry.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function createTarball() {
  const temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), "lumi-registry-publish-"),
  );
  const packageDirectory = path.join(temporaryDirectory, "package");
  const tarballPath = path.join(temporaryDirectory, "lumi-survey.tgz");
  mkdirSync(packageDirectory);
  writeFileSync(
    path.join(packageDirectory, "package.json"),
    `${JSON.stringify({ name: "@navikt/lumi-survey", version: "2.1.1" })}\n`,
  );
  execFileSync("tar", ["-czf", tarballPath, "package"], {
    cwd: temporaryDirectory,
  });
  return tarballPath;
}

function registryResponse(status, metadata) {
  return {
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    ok: status >= 200 && status < 300,
    json: async () => metadata,
  };
}

test("allows only the two intended registries", () => {
  assert.equal(
    normalizeRegistryUrl("https://registry.npmjs.org/"),
    "https://registry.npmjs.org",
  );
  assert.equal(
    normalizeRegistryUrl("https://npm.pkg.github.com"),
    "https://npm.pkg.github.com",
  );
  assert.throws(
    () => normalizeRegistryUrl("https://registry.example.invalid"),
    /unsupported registry/i,
  );
});

test("encodes scoped package metadata lookups", () => {
  assert.equal(
    registryPackageUrl("https://registry.npmjs.org", "@navikt/lumi-survey"),
    "https://registry.npmjs.org/%40navikt%2Flumi-survey",
  );
});

test("builds explicit trusted-publish and mirror commands", () => {
  assert.deepEqual(
    buildPublishArguments("/tmp/lumi-survey.tgz", "https://registry.npmjs.org"),
    [
      "publish",
      "/tmp/lumi-survey.tgz",
      "--registry=https://registry.npmjs.org",
      "--@navikt:registry=https://registry.npmjs.org",
      "--access=public",
      "--ignore-scripts",
      "--provenance",
    ],
  );
  assert.doesNotMatch(
    buildPublishArguments(
      "/tmp/lumi-survey.tgz",
      "https://npm.pkg.github.com",
    ).join(" "),
    /--provenance/,
  );
});

test("parses only the documented CLI contract", () => {
  assert.deepEqual(
    parseArguments([
      "--mode=check",
      "--tarball=relative.tgz",
      "--registry=https://registry.npmjs.org",
    ]),
    {
      mode: "check",
      tarballPath: path.resolve("relative.tgz"),
      registryUrl: "https://registry.npmjs.org",
    },
  );
  assert.throws(
    () =>
      parseArguments([
        "--tarball=relative.tgz",
        "--registry=https://registry.npmjs.org",
        "--unexpected=true",
      ]),
    /usage/i,
  );
});

test("CLI entrypoint runs when the script path crosses a filesystem symlink", () => {
  const canonicalScriptPath = path.join(
    repositoryRoot,
    "scripts/publish-lumi-survey-registry.mjs",
  );
  const symlinkedScriptPath = canonicalScriptPath.replace(
    /^\/private\/tmp\//,
    "/tmp/",
  );
  const result = spawnSync(
    process.execPath,
    [
      symlinkedScriptPath,
      "--tarball=missing.tgz",
      "--registry=https://registry.example.invalid",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported registry/i);
});

test("publishes missing versions and skips only byte-identical versions", () => {
  const digests = {
    shasum: "a".repeat(40),
    integrity: `sha512-${"A".repeat(86)}==`,
  };
  assert.equal(publicationDecision(digests, undefined), "publish");
  assert.equal(publicationDecision(digests, digests), "skip");
  assert.throws(
    () =>
      publicationDecision(digests, {
        ...digests,
        integrity: `sha512-${"B".repeat(86)}==`,
      }),
    /different tarball digest/i,
  );
});

test("reads version digests from full registry metadata", () => {
  const shasum = "A".repeat(40);
  const integrity = `sha512-${"B".repeat(86)}==`;
  const metadata = {
    versions: { "2.1.0": { dist: { shasum, integrity } } },
  };

  assert.deepEqual(publishedVersionDigests(metadata, "2.1.0"), {
    shasum: shasum.toLowerCase(),
    integrity,
  });
  assert.equal(publishedVersionDigests(metadata, "2.1.1"), undefined);
  assert.throws(
    () => publishedVersionDigests({ versions: { "2.1.0": {} } }, "2.1.0"),
    /no valid dist\.shasum/i,
  );
});

test("reads package identity and hashes the packed tarball", () => {
  const tarballPath = createTarball();

  assert.deepEqual(readPackedManifest(tarballPath), {
    name: "@navikt/lumi-survey",
    version: "2.1.1",
  });
  assert.match(tarballDigests(tarballPath).shasum, /^[0-9a-f]{40}$/);
  assert.match(tarballDigests(tarballPath).integrity, /^sha512-/);
});

test("check mode performs a read-only preflight", async () => {
  const tarballPath = createTarball();
  let requestedUrl;
  let requestedOptions;

  const decision = await runPublication({
    tarballPath,
    registryUrl: "https://registry.npmjs.org",
    mode: "check",
    environment: {
      NODE_AUTH_TOKEN: "must-not-be-sent-to-npmjs",
      NPM_AUTH_TOKEN: "must-not-be-sent-to-npmjs",
    },
    fetchImplementation: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return registryResponse(404);
    },
    spawnImplementation: () => {
      throw new Error("preflight must not invoke npm");
    },
  });

  assert.equal(decision, "publish");
  assert.equal(
    requestedUrl,
    "https://registry.npmjs.org/%40navikt%2Flumi-survey",
  );
  assert.deepEqual(requestedOptions.headers, { accept: "application/json" });
});

test("verify mode requires an identical published version", async () => {
  const tarballPath = createTarball();
  const localDigests = tarballDigests(tarballPath);
  const unexpectedSpawn = () => {
    throw new Error("verify mode must never invoke npm");
  };

  await assert.rejects(
    runPublication({
      tarballPath,
      registryUrl: "https://registry.npmjs.org",
      mode: "verify",
      fetchImplementation: async () => registryResponse(404),
      spawnImplementation: unexpectedSpawn,
    }),
    /expected an identical published version/i,
  );

  assert.equal(
    await runPublication({
      tarballPath,
      registryUrl: "https://registry.npmjs.org",
      mode: "verify",
      fetchImplementation: async () =>
        registryResponse(200, {
          versions: { "2.1.1": { dist: localDigests } },
        }),
      spawnImplementation: unexpectedSpawn,
    }),
    "skip",
  );
});

test("orchestration skips identical versions and blocks digest mismatches", async () => {
  const tarballPath = createTarball();
  const localDigests = tarballDigests(tarballPath);
  let spawnCount = 0;
  const spawnImplementation = () => {
    spawnCount += 1;
    return { status: 0 };
  };

  const metadataResponse = (digests) =>
    registryResponse(200, {
      versions: { "2.1.1": { dist: digests } },
    });

  assert.equal(
    await runPublication({
      tarballPath,
      registryUrl: "https://registry.npmjs.org",
      fetchImplementation: async () => metadataResponse(localDigests),
      spawnImplementation,
    }),
    "skip",
  );
  assert.equal(spawnCount, 0);

  await assert.rejects(
    runPublication({
      tarballPath,
      registryUrl: "https://registry.npmjs.org",
      fetchImplementation: async () =>
        metadataResponse({
          ...localDigests,
          shasum: "b".repeat(40),
        }),
      spawnImplementation,
    }),
    /different tarball digest/i,
  );
  assert.equal(spawnCount, 0);
});

test("publishing scopes credentials to GitHub Packages", async () => {
  const tarballPath = createTarball();
  const invocations = [];
  const requestedHeaders = [];
  const environment = {
    NODE_AUTH_TOKEN: "github-package-token",
    NPM_AUTH_TOKEN: "github-package-token",
    SAFE_VALUE: "preserved",
  };
  const fetchImplementation = async (_url, options) => {
    requestedHeaders.push(options.headers);
    return registryResponse(404);
  };
  const spawnImplementation = (command, args, options) => {
    invocations.push({ command, args, options });
    return { status: 0 };
  };

  await runPublication({
    tarballPath,
    registryUrl: "https://registry.npmjs.org",
    environment,
    fetchImplementation,
    spawnImplementation,
  });
  await runPublication({
    tarballPath,
    registryUrl: "https://npm.pkg.github.com",
    environment,
    fetchImplementation,
    spawnImplementation,
  });

  assert.deepEqual(requestedHeaders, [
    { accept: "application/json" },
    {
      accept: "application/json",
      authorization: "Bearer github-package-token",
    },
  ]);
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].command, "npm");
  assert.equal(invocations[0].options.env.NODE_AUTH_TOKEN, undefined);
  assert.equal(invocations[0].options.env.NPM_AUTH_TOKEN, undefined);
  assert.equal(invocations[0].options.env.SAFE_VALUE, "preserved");
  assert.equal(
    invocations[1].options.env.NODE_AUTH_TOKEN,
    "github-package-token",
  );
});

test("release workflow preflights once and separates publish privileges", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github/workflows/publish-lumi-survey.yaml"),
    "utf8",
  );
  const npmjsJobStart = workflow.indexOf("\n  publish_npmjs:\n");
  const githubJobStart = workflow.indexOf("\n  publish_github_packages:\n");
  const tagJobStart = workflow.indexOf("\n  tag_release:\n");
  const verifyJob = workflow.slice(0, npmjsJobStart);
  const npmjsJob = workflow.slice(npmjsJobStart, githubJobStart);
  const githubJob = workflow.slice(githubJobStart, tagJobStart);
  const tagJob = workflow.slice(tagJobStart);

  assert.ok(npmjsJobStart > -1, "expected npmjs publish job");
  assert.ok(githubJobStart > npmjsJobStart, "expected mirror after npmjs");
  assert.ok(tagJobStart > githubJobStart, "expected tag job last");
  assert.match(
    verifyJob,
    /--mode=check[^\n]+registry\.npmjs\.org[\s\S]+--mode=check[^\n]+npm\.pkg\.github\.com/,
  );
  assert.match(verifyJob, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(verifyJob, /overwrite: true/);
  assert.match(
    npmjsJob,
    /environment: npm-publish[\s\S]+permissions:\n\s+contents: read\n\s+id-token: write/,
  );
  assert.match(
    githubJob,
    /needs: \[verify, publish_npmjs\][\s\S]+permissions:\n\s+contents: read\n\s+packages: write/,
  );
  assert.match(
    tagJob,
    /needs: \[verify, publish_github_packages\][\s\S]+permissions:\n\s+contents: write/,
  );
  assert.match(npmjsJob, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(githubJob, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(npmjsJob, /--registry=https:\/\/registry\.npmjs\.org/);
  assert.match(githubJob, /--registry=https:\/\/npm\.pkg\.github\.com/);
  assert.doesNotMatch(npmjsJob, /NPM_AUTH_TOKEN|NODE_AUTH_TOKEN/);
  assert.doesNotMatch(npmjsJob, /pnpm install|npm install/);
  assert.match(npmjsJob, /expected at least 11\.5\.1/);
  assert.doesNotMatch(githubJob, /pnpm install|npm install/);
  assert.doesNotMatch(workflow, /secrets\.NPM[^\s}]*/);
  assert.doesNotMatch(workflow, /--tarball=\$\{\{/);
  assert.match(workflow, /lumi-survey-release\/lumi-survey\.tgz/g);
  assert.match(tagJob, /repos\/\$\{GITHUB_REPOSITORY\}\/git\/tags/);
  assert.equal((workflow.match(/id-token: write/g) ?? []).length, 1);
  assert.equal((workflow.match(/packages: write/g) ?? []).length, 1);
  assert.equal((workflow.match(/contents: write/g) ?? []).length, 1);

  const workflowCheckoutHardening = workflow.match(
    /persist-credentials: false/g,
  );
  assert.equal(workflowCheckoutHardening?.length, 3);
});
