/**
 * ds-css sets black text on white with `!important` inside
 * `@layer aksel.print`. Layered `!important` rules win over all unlayered
 * deck CSS, so a PDF would lose the slide colours. The print view removes
 * that layer; Aksel's other print rules stay.
 */
export function removeAkselPrintLayer(): void {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin sheets cannot be read.
    }
    for (let index = rules.length - 1; index >= 0; index -= 1) {
      const rule = rules[index];
      if (rule instanceof CSSLayerBlockRule && rule.name === "aksel.print") {
        sheet.deleteRule(index);
      }
    }
  }
}
