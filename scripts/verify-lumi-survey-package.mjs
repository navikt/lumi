import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate, parse, walk } from "css-tree";

const repoRoot = process.cwd();

const FORBIDDEN_STRINGS = [
  "@navikt/lumi-types",
  'from "@navikt/lumi-types"',
  "from '@navikt/lumi-types'",
  "zod",
  'from "zod"',
  "from 'zod'",
];

function fail(message) {
  console.error(`\n[verify:lumi-survey] ${message}`);
  process.exit(1);
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    fail(`Failed to read ${path.relative(repoRoot, filePath)}: ${details}`);
  }
}

async function scanFileForForbiddenStrings(filePath) {
  const content = await readText(filePath);
  for (const needle of FORBIDDEN_STRINGS) {
    if (content.includes(needle)) {
      fail(
        `${path.relative(repoRoot, filePath)} contains forbidden reference: ${JSON.stringify(needle)}`,
      );
    }
  }
}

function assertCssRuleOmitsProperty(css, selector, property) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`, "g");
  const propertyPattern = new RegExp(`\\b${property}\\s*:`);

  for (const match of css.matchAll(rulePattern)) {
    if (propertyPattern.test(match[0])) {
      fail(
        `packages/lumi-survey/dist/index.css must not set ${property} in ${selector}; use Aksel typography props instead`,
      );
    }
  }
}

export function findNonNamespacedCssSelectors(css) {
  const ast = parse(css);
  const invalidSelectors = [];

  walk(ast, {
    visit: "Rule",
    enter(node) {
      if (this.atrule?.name.toLowerCase().endsWith("keyframes")) {
        return;
      }

      if (node.prelude.type !== "SelectorList") {
        invalidSelectors.push(
          generate(node.prelude) || "<unparseable selector>",
        );
        return;
      }

      node.prelude.children.forEach((selectorNode) => {
        const selector = generate(selectorNode);
        const isScopedNestedSelector = this.rule && selector.startsWith("&");

        if (!selector.startsWith(".lumi-") && !isScopedNestedSelector) {
          invalidSelectors.push(selector);
        }
      });
    },
  });

  return [...new Set(invalidSelectors)];
}

function assertCssSelectorsAreNamespaced(css) {
  const invalidSelectors = findNonNamespacedCssSelectors(css);

  if (invalidSelectors.length > 0) {
    fail(
      `packages/lumi-survey/dist/index.css contains non-namespaced selectors: ${invalidSelectors.join(", ")}`,
    );
  }
}

async function scanDirRecursive(dirPath, predicate) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDirRecursive(entryPath, predicate);
      continue;
    }
    if (predicate(entryPath)) {
      await scanFileForForbiddenStrings(entryPath);
    }
  }
}

async function main() {
  const packageDir = path.join(repoRoot, "packages", "lumi-survey");
  const packageJsonPath = path.join(packageDir, "package.json");
  const typecheckTsconfigPath = path.join(
    packageDir,
    "tsconfig.typecheck.json",
  );
  const srcDir = path.join(packageDir, "src");
  const distDir = path.join(packageDir, "dist");
  const distIndexJs = path.join(distDir, "index.js");
  const distIndexDts = path.join(distDir, "index.d.ts");
  const distIndexCss = path.join(distDir, "index.css");

  // 1) package.json must not depend on internal workspace-only packages.
  const pkg = JSON.parse(await readText(packageJsonPath));
  const deps = pkg.dependencies ?? {};
  if (typeof deps !== "object" || deps === null) {
    fail("packages/lumi-survey/package.json has invalid dependencies shape");
  }
  if ("@navikt/lumi-types" in deps) {
    fail(
      "packages/lumi-survey/package.json must not depend on @navikt/lumi-types",
    );
  }
  if ("zod" in deps) {
    fail("packages/lumi-survey/package.json must not depend on zod");
  }

  // 2) typecheck config must not map internal workspace paths.
  const tsconfig = JSON.parse(await readText(typecheckTsconfigPath));
  const paths = tsconfig?.compilerOptions?.paths;
  if (paths && typeof paths === "object") {
    const keys = Object.keys(paths);
    const forbiddenKeys = keys.filter((key) =>
      key.startsWith("@navikt/lumi-types"),
    );
    if (forbiddenKeys.length > 0) {
      fail(
        `packages/lumi-survey/tsconfig.typecheck.json must not contain path mappings for @navikt/lumi-types (found: ${forbiddenKeys.join(", ")})`,
      );
    }
  }

  // 3) source must not import forbidden packages.
  await scanDirRecursive(
    srcDir,
    (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"),
  );

  // 4) dist must be present and must not reference forbidden packages.
  if (
    !(await fileExists(distIndexJs)) ||
    !(await fileExists(distIndexDts)) ||
    !(await fileExists(distIndexCss))
  ) {
    fail(
      "packages/lumi-survey/dist is missing build artifacts. Run: pnpm --filter @navikt/lumi-survey run build",
    );
  }

  await scanFileForForbiddenStrings(distIndexJs);
  await scanFileForForbiddenStrings(distIndexDts);

  const distCss = await readText(distIndexCss);
  assertCssSelectorsAreNamespaced(distCss);
  for (const selector of [
    ".ratingHeading",
    ".ratingDescription",
    ".lumi-survey-dock__rating-heading",
    ".lumi-survey-dock__rating-description",
  ]) {
    assertCssRuleOmitsProperty(distCss, selector, "font-size");
  }

  console.log("[verify:lumi-survey] OK");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
