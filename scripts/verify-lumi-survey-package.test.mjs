import assert from "node:assert/strict";
import test from "node:test";
import { findNonNamespacedCssSelectors } from "./verify-lumi-survey-package.mjs";

test("rejects global selectors at the root and in rule-list at-rules", () => {
  const css = `
    .container { color: red; }
    @media (width > 40rem) { .header { color: blue; } }
    @supports (display: grid) { .panel { display: grid; } }
    @layer widget { .active { font-weight: bold; } }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), [
    ".container",
    ".header",
    ".panel",
    ".active",
  ]);
});

test("rejects only the unscoped member of a grouped selector", () => {
  assert.deepEqual(
    findNonNamespacedCssSelectors(
      ".lumi-widget, .external-widget { color: red; }",
    ),
    [".external-widget"],
  );
});

test("accepts namespaced selectors at every rule-list depth", () => {
  const css = `
    .lumi-widget { color: red; }
    @media (width > 40rem) {
      @supports (display: grid) {
        .lumi-widget__panel:hover { display: grid; }
      }
    }
    @layer widget { .lumi-widget--active { font-weight: bold; } }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), []);
});

test("does not split selector lists on commas inside functions or attributes", () => {
  const css = `
    .lumi-widget:is(:hover, :focus) { color: red; }
    .lumi-widget[data-value="a,b"] { color: blue; }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), []);
});

test("does not let CSS escapes hide global selectors", () => {
  for (const selector of [
    String.raw`.container\(`,
    String.raw`.container\[`,
    String.raw`.container\"foo`,
    String.raw`.container\'foo`,
  ]) {
    assert.deepEqual(
      findNonNamespacedCssSelectors(`${selector} { color: red; }`),
      [selector],
    );
  }
});

test("does not split a namespaced selector on an escaped comma", () => {
  assert.deepEqual(
    findNonNamespacedCssSelectors(
      String.raw`.lumi-widget\,variant { color: red; }`,
    ),
    [],
  );
});

test("does not treat comment markers inside strings as comments", () => {
  const css = `
    @font-face { font-family: "/*"; }
    .container { color: red; }
    .lumi-widget { content: "*/"; }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), [".container"]);
});

test("uses CSS parser recovery so a bad string cannot hide a later rule", () => {
  const css = `@font-face { font-family: "unterminated
    ; }
    .container { color: red; }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), [".container"]);
});

test("accepts ampersand nesting under a namespaced selector", () => {
  const css = `
    .lumi-widget {
      &:hover, & .child { color: red; }
      @media (width > 40rem) { & .child { color: blue; } }
    }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), []);
});

test("rejects global selectors inside unknown rule-list at-rules", () => {
  assert.deepEqual(
    findNonNamespacedCssSelectors(
      "@future-rule widget { .container { color: red; } }",
    ),
    [".container"],
  );
});

test("fails closed when the parser cannot understand selector syntax", () => {
  assert.deepEqual(
    findNonNamespacedCssSelectors(".container || td { color: red; }"),
    [".container || td"],
  );
  assert.deepEqual(
    findNonNamespacedCssSelectors(".lumi-widget || td { color: red; }"),
    [".lumi-widget || td"],
  );
});

test("ignores keyframe steps and declaration-only at-rules", () => {
  const css = `
    @keyframes lumi-spin {
      from { transform: rotate(0deg); }
      50% { transform: rotate(180deg); }
      to { transform: rotate(360deg); }
    }
    @font-face {
      font-family: "Lumi";
      src: url("lumi.woff2");
    }
    @property --lumi-progress {
      syntax: "<percentage>";
      inherits: false;
      initial-value: 0%;
    }
  `;

  assert.deepEqual(findNonNamespacedCssSelectors(css), []);
});
