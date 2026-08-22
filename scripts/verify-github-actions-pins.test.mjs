import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function findYamlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findYamlFiles(entryPath);
    return /\.ya?ml$/.test(entry.name) ? [entryPath] : [];
  });
}

function findUnpinnedExternalUses(content) {
  const violations = [];
  const visited = new Set();

  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (typeof value !== "object" || value === null || visited.has(value)) {
      return;
    }
    visited.add(value);

    for (const [key, child] of Object.entries(value)) {
      if (key !== "uses") {
        visit(child);
        continue;
      }

      if (typeof child !== "string") {
        violations.push({ reference: "<non-string uses value>" });
        continue;
      }

      const reference = child.trim();
      if (reference.startsWith("./")) continue;

      const isPinnedAction = /@[0-9a-f]{40}$/.test(reference);
      const isPinnedContainer = /^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/.test(
        reference,
      );

      if (!isPinnedAction && !isPinnedContainer) {
        violations.push({ reference });
      }
    }
  };

  visit(load(content));
  return violations;
}

test("detects movable references independent of YAML formatting", () => {
  const content = `
    jobs:
      reusable:
        "uses": navikt/example/.github/workflows/ci.yaml@main
      test:
        steps:
          - { uses: actions/checkout@v4 }
          - uses : ./.github/actions/local
          - uses: >-
              actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
          - uses: docker://alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  `;

  assert.deepEqual(findUnpinnedExternalUses(content), [
    {
      reference: "navikt/example/.github/workflows/ci.yaml@main",
    },
    { reference: "actions/checkout@v4" },
  ]);
});

test("all external GitHub Actions references use immutable commits", () => {
  const files = [
    ...findYamlFiles(path.join(repositoryRoot, ".github", "workflows")),
    ...findYamlFiles(path.join(repositoryRoot, ".github", "actions")),
  ];
  const violations = files.flatMap((filePath) =>
    findUnpinnedExternalUses(readFileSync(filePath, "utf8")).map(
      ({ reference }) => ({
        file: path.relative(repositoryRoot, filePath),
        reference,
      }),
    ),
  );

  assert.deepEqual(violations, []);
});
