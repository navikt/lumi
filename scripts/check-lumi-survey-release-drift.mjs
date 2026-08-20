import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import semver from "semver";

const TAG_PREFIX = "lumi-survey-v";
const PACKAGE_DIR = path.join("packages", "lumi-survey");
const PACKAGE_JSON = path.join(PACKAGE_DIR, "package.json");
const SOURCE_DIR = path.join(PACKAGE_DIR, "src");
const PUBLISHED_INPUTS = [
  "LICENSE",
  SOURCE_DIR,
  path.join(PACKAGE_DIR, "LICENSE"),
  PACKAGE_JSON,
  path.join(PACKAGE_DIR, "README.md"),
  path.join(PACKAGE_DIR, "tsconfig.json"),
  path.join(PACKAGE_DIR, "tsconfig.typecheck.json"),
  path.join(PACKAGE_DIR, "tsup.config.ts"),
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`\n[lumi-survey release drift] ${message}`);
  process.exit(1);
}

function isPublishedInput(file) {
  return (
    !file.includes("/__tests__/") &&
    !file.includes("/stories/") &&
    !file.includes("/storybook/") &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
  );
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

function manifestChangedBeyondVersion(latestTag, currentPackageJson) {
  const releasedPackageJson = JSON.parse(
    git(["show", `${latestTag}:${PACKAGE_JSON}`]),
  );
  const { version: _releasedVersion, ...releasedManifest } =
    releasedPackageJson;
  const { version: _currentVersion, ...currentManifest } = currentPackageJson;

  return (
    JSON.stringify(stableJson(releasedManifest)) !==
    JSON.stringify(stableJson(currentManifest))
  );
}

function main() {
  const requireMeaningfulChange = process.argv
    .slice(2)
    .includes("--require-meaningful-change");
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--require-meaningful-change");
  if (unknownArguments.length > 0) {
    fail(`Unknown argument: ${unknownArguments.join(", ")}`);
  }

  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  const currentVersion = packageJson.version;

  if (typeof currentVersion !== "string" || currentVersion.length === 0) {
    fail(`${PACKAGE_DIR}/package.json does not contain a valid version.`);
  }
  if (!semver.valid(currentVersion)) {
    fail(`${currentVersion} is not a valid SemVer version.`);
  }

  const currentTag = `${TAG_PREFIX}${currentVersion}`;
  if (requireMeaningfulChange && git(["tag", "--list", currentTag])) {
    fail(`Tag already exists: ${currentTag}. Refusing to publish it again.`);
  }

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
  if (!semver.valid(releasedVersion)) {
    fail(`Release tag ${latestTag} does not contain a valid SemVer version.`);
  }

  const changedPublishedFiles = git([
    "diff",
    "--name-only",
    `${latestTag}..HEAD`,
    "--",
    ...PUBLISHED_INPUTS,
  ])
    .split("\n")
    .filter(Boolean)
    .filter(isPublishedInput);

  if (changedPublishedFiles.length === 0) {
    if (requireMeaningfulChange) {
      fail(`No meaningful published package changes since ${latestTag}.`);
    }
    console.log(
      `[lumi-survey release drift] No published package changes since ${latestTag}.`,
    );
    return;
  }

  if (currentVersion === releasedVersion) {
    fail(
      [
        `Published package inputs changed since ${latestTag}, but ${PACKAGE_DIR}/package.json still uses version ${currentVersion}.`,
        "Bump the package version before merging these changes.",
        "Changed published inputs:",
        ...changedPublishedFiles.map((file) => `- ${file}`),
      ].join("\n"),
    );
  }

  if (!semver.gt(currentVersion, releasedVersion)) {
    fail(
      `Package version ${currentVersion} must be newer than ${releasedVersion}.`,
    );
  }

  if (requireMeaningfulChange) {
    const meaningfulFiles = changedPublishedFiles.filter(
      (file) => file !== PACKAGE_JSON,
    );
    if (
      changedPublishedFiles.includes(PACKAGE_JSON) &&
      manifestChangedBeyondVersion(latestTag, packageJson)
    ) {
      meaningfulFiles.push(PACKAGE_JSON);
    }

    if (meaningfulFiles.length === 0) {
      fail(`No meaningful published package changes since ${latestTag}.`);
    }

    console.log(
      [
        `[lumi-survey release drift] Meaningful published package changes since ${latestTag}:`,
        ...meaningfulFiles.map((file) => `- ${file}`),
      ].join("\n"),
    );
    return;
  }

  console.log(
    `[lumi-survey release drift] Published package inputs changed and the version moved from ${releasedVersion} to ${currentVersion}.`,
  );
}

main();
