import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const TAG_PREFIX = "lumi-survey-v";
const PACKAGE_DIR = path.join("packages", "lumi-survey");
const SOURCE_DIR = path.join(PACKAGE_DIR, "src");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`\n[lumi-survey release drift] ${message}`);
  process.exit(1);
}

function isPublishedSource(file) {
  return (
    !file.includes("/__tests__/") &&
    !file.includes("/stories/") &&
    !file.includes("/storybook/") &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
  );
}

function main() {
  const latestTag = git([
    "tag",
    "--merged",
    "HEAD",
    "--list",
    `${TAG_PREFIX}*`,
    "--sort=-v:refname",
  ])
    .split("\n")
    .find(Boolean);

  if (!latestTag) {
    console.log(
      "[lumi-survey release drift] No reachable release tag; nothing to compare.",
    );
    return;
  }

  const releasedVersion = latestTag.slice(TAG_PREFIX.length);
  const packageJson = JSON.parse(
    readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"),
  );
  const currentVersion = packageJson.version;

  if (typeof currentVersion !== "string" || currentVersion.length === 0) {
    fail(`${PACKAGE_DIR}/package.json does not contain a valid version.`);
  }

  const changedSourceFiles = git([
    "diff",
    "--name-only",
    `${latestTag}..HEAD`,
    "--",
    SOURCE_DIR,
  ])
    .split("\n")
    .filter(Boolean)
    .filter(isPublishedSource);

  if (changedSourceFiles.length === 0) {
    console.log(
      `[lumi-survey release drift] No widget source changes since ${latestTag}.`,
    );
    return;
  }

  if (currentVersion === releasedVersion) {
    fail(
      [
        `Widget source changed since ${latestTag}, but ${PACKAGE_DIR}/package.json still uses version ${currentVersion}.`,
        "Bump the package version before merging these source changes.",
        "Changed source files:",
        ...changedSourceFiles.map((file) => `- ${file}`),
      ].join("\n"),
    );
  }

  console.log(
    `[lumi-survey release drift] Widget source changed and the version moved from ${releasedVersion} to ${currentVersion}.`,
  );
}

main();
