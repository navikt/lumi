import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-lumi-survey-release-drift.mjs",
);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function createTaggedPackage() {
  const cwd = mkdtempSync(path.join(tmpdir(), "lumi-release-drift-"));
  const packageDir = path.join(cwd, "packages", "lumi-survey");
  const sourceDir = path.join(packageDir, "src");

  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.0" }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(packageDir, "tsup.config.ts"),
    'export default { entry: ["src/index.ts"] };\n',
  );
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 1;\n");
  writeFileSync(path.join(cwd, "LICENSE"), "Released under the MIT license.\n");

  git(cwd, "init");
  git(cwd, "config", "user.name", "Release drift test");
  git(cwd, "config", "user.email", "release-drift@example.invalid");
  git(cwd, "add", "LICENSE", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Release 2.0.0");
  git(cwd, "tag", "lumi-survey-v2.0.0");

  return { cwd, packageDir, sourceDir };
}

test("fails when widget source changes without a version bump", () => {
  const { cwd, sourceDir } = createTaggedPackage();
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  git(cwd, "add", "packages/lumi-survey/src/index.ts");
  git(cwd, "commit", "-m", "Change widget source");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /still uses version 2\.0\.0/i);
  assert.match(result.stderr, /packages\/lumi-survey\/src\/index\.ts/);
});

test("passes when widget source changes with a version bump", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Prepare 2.0.1");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /version moved from 2\.0\.0 to 2\.0\.1/i);
});

test("fails when the package manifest changes without a version bump", () => {
  const { cwd, packageDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      { version: "2.0.0", exports: { ".": "./dist/index.js" } },
      null,
      2,
    )}\n`,
  );
  git(cwd, "add", "packages/lumi-survey/package.json");
  git(cwd, "commit", "-m", "Change package manifest");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /still uses version 2\.0\.0/i);
  assert.match(result.stderr, /packages\/lumi-survey\/package\.json/);
});

test("fails when the package build config changes without a version bump", () => {
  const { cwd, packageDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "tsup.config.ts"),
    'export default { entry: ["src/index.ts"], minify: true };\n',
  );
  git(cwd, "add", "packages/lumi-survey/tsup.config.ts");
  git(cwd, "commit", "-m", "Change package build config");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /still uses version 2\.0\.0/i);
  assert.match(result.stderr, /packages\/lumi-survey\/tsup\.config\.ts/);
});

test("fails when the packaged root license changes without a version bump", () => {
  const { cwd } = createTaggedPackage();
  writeFileSync(path.join(cwd, "LICENSE"), "Updated license terms.\n");
  git(cwd, "add", "LICENSE");
  git(cwd, "commit", "-m", "Change packaged license");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /still uses version 2\.0\.0/i);
  assert.match(result.stderr, /LICENSE/);
});

test("does not require a release for test-only changes", () => {
  const { cwd, sourceDir } = createTaggedPackage();
  const testDir = path.join(sourceDir, "__tests__");
  mkdirSync(testDir, { recursive: true });
  writeFileSync(path.join(testDir, "index.test.ts"), "// regression test\n");
  git(cwd, "add", "packages/lumi-survey/src/__tests__/index.test.ts");
  git(cwd, "commit", "-m", "Add test coverage");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no published package changes/i);
});

test("the publish guard treats the packaged root license as meaningful", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github/workflows/publish-lumi-survey.yaml"),
    "utf8",
  );

  assert.match(
    workflow,
    /node scripts\/check-lumi-survey-release-drift\.mjs --require-meaningful-change/,
  );
  assert.doesNotMatch(workflow, /CHANGED=\$\(git diff/);
});

test("pull request verification does not use the long-lived reader token", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github/workflows/ci.yaml"),
    "utf8",
  );

  assert.doesNotMatch(workflow, /secrets\.READER_TOKEN/);
  assert.match(workflow, /NPM_AUTH_TOKEN: \$\{\{ github\.token \}\}/);
});

test("publish verification is read-only and write access is main-only", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github/workflows/publish-lumi-survey.yaml"),
    "utf8",
  );
  const verifyStart = workflow.indexOf("\n  verify:\n");
  const publishStart = workflow.indexOf("\n  publish:\n");

  assert.notEqual(verifyStart, -1, "expected a separate verify job");
  assert.notEqual(publishStart, -1, "expected a separate publish job");
  assert.ok(verifyStart < publishStart, "verify must run before publish");

  const verifyJob = workflow.slice(verifyStart, publishStart);
  const publishJob = workflow.slice(publishStart);
  assert.match(verifyJob, /permissions:\n\s+contents: read\n\s+packages: read/);
  assert.doesNotMatch(verifyJob, /contents: write|packages: write/);
  assert.match(
    publishJob,
    /if:.*inputs\.dry_run == 'false'.*github\.ref_name == 'main'/,
  );
  assert.match(
    publishJob,
    /permissions:\n\s+contents: write\n\s+id-token: write\n\s+packages: write/,
  );
});

test("publish mode rejects a version-only release", () => {
  const { cwd, packageDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  git(cwd, "add", "packages/lumi-survey/package.json");
  git(cwd, "commit", "-m", "Bump version only");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--require-meaningful-change"],
    { cwd, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no meaningful published package changes/i);
});

test("publish mode rejects a test-only release", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  const testDir = path.join(sourceDir, "__tests__");
  mkdirSync(testDir, { recursive: true });
  writeFileSync(path.join(testDir, "index.test.ts"), "// regression test\n");
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Bump with tests only");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--require-meaningful-change"],
    { cwd, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no meaningful published package changes/i);
});

test("publish mode accepts a manifest-only release", () => {
  const { cwd, packageDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      { version: "2.0.1", exports: { ".": "./dist/index.js" } },
      null,
      2,
    )}\n`,
  );
  git(cwd, "add", "packages/lumi-survey/package.json");
  git(cwd, "commit", "-m", "Change manifest and bump");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--require-meaningful-change"],
    { cwd, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /package\.json/);
});

test("publish mode accepts a license-only release", () => {
  const { cwd, packageDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  writeFileSync(path.join(cwd, "LICENSE"), "Updated license terms.\n");
  git(cwd, "add", "LICENSE", "packages/lumi-survey/package.json");
  git(cwd, "commit", "-m", "Change license and bump");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--require-meaningful-change"],
    { cwd, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /LICENSE/);
});

test("publish mode rejects a version whose tag already exists", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Release 2.0.1");
  git(cwd, "tag", "lumi-survey-v2.0.1");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--require-meaningful-change"],
    { cwd, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /tag already exists.*lumi-survey-v2\.0\.1/i);
});

test("rejects a package version lower than the latest release", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "1.9.1" }, null, 2)}\n`,
  );
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Attempt downgrade");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be newer than 2\.0\.0/i);
});

test("rejects an invalid package version", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "next" }, null, 2)}\n`,
  );
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Use invalid version");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a valid SemVer version/i);
});

test("rejects an invalid latest release tag version", () => {
  const { cwd, packageDir, sourceDir } = createTaggedPackage();
  git(cwd, "tag", "-d", "lumi-survey-v2.0.0");
  git(cwd, "tag", "lumi-survey-vinvalid");
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ version: "2.0.1" }, null, 2)}\n`,
  );
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 2;\n");
  git(cwd, "add", "packages/lumi-survey");
  git(cwd, "commit", "-m", "Change after invalid tag");

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /release tag.*does not contain a valid SemVer version/i,
  );
});
