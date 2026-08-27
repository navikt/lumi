import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPublishArguments,
  normalizeRegistryUrl,
  publicationDecision,
  publishedVersionDigests,
  readPackedManifest,
  registryPackageUrl,
  tarballDigests,
} from "./publish-lumi-survey-registry.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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

  assert.deepEqual(readPackedManifest(tarballPath), {
    name: "@navikt/lumi-survey",
    version: "2.1.1",
  });
  assert.match(tarballDigests(tarballPath).shasum, /^[0-9a-f]{40}$/);
  assert.match(tarballDigests(tarballPath).integrity, /^sha512-/);
});

test("release workflow publishes npmjs first and tags after both registries", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github/workflows/publish-lumi-survey.yaml"),
    "utf8",
  );
  const publishJob = workflow.slice(workflow.indexOf("\n  publish:\n"));
  const npmjsPublish = publishJob.indexOf(
    "--registry=https://registry.npmjs.org",
  );
  const githubPublish = publishJob.indexOf(
    "--registry=https://npm.pkg.github.com",
  );
  const releaseTag = publishJob.indexOf("- name: Tag release");

  assert.match(
    publishJob,
    /permissions:\n\s+contents: write\n\s+id-token: write\n\s+packages: write/,
  );
  assert.match(publishJob, /npm install --global npm@11\.19\.0/);
  assert.ok(npmjsPublish > -1, "expected npmjs publication");
  assert.ok(githubPublish > npmjsPublish, "npmjs must be published first");
  assert.ok(releaseTag > githubPublish, "tag must be created last");
  assert.doesNotMatch(publishJob, /secrets\.NPM[^\s}]*/);
  assert.doesNotMatch(publishJob, /--tarball=\$\{\{/);
  assert.match(
    publishJob,
    /TARBALL: \$\{\{ steps\.pack\.outputs\.tarball \}\}/,
  );
  assert.match(publishJob, /repos\/\$\{GITHUB_REPOSITORY\}\/git\/tags/);

  const workflowCheckoutHardening = workflow.match(
    /persist-credentials: false/g,
  );
  assert.equal(workflowCheckoutHardening?.length, 2);
});
