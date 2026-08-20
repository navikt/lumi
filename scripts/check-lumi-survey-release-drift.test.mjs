import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-lumi-survey-release-drift.mjs",
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
  writeFileSync(path.join(sourceDir, "index.ts"), "export const value = 1;\n");

  git(cwd, "init");
  git(cwd, "config", "user.name", "Release drift test");
  git(cwd, "config", "user.email", "release-drift@example.invalid");
  git(cwd, "add", "packages/lumi-survey");
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
  assert.match(result.stdout, /no widget source changes/i);
});
