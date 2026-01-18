# Aksel v8 migration review (Lumi)

Use this prompt when reviewing or finishing an Aksel v8 upgrade (or when someone has attempted one and you want a focused checklist).

## Commands

Run from repo root:

- `npm run lint`
- `npm run typecheck`
- `npm test`

Optional (visual/manual):

- `npm run dev` (dashboard)
- `npm -w packages/lumi-survey run storybook` (if available)

## Fast grep checks

Look for common v7 leftovers and v8 gotchas:

- `@navikt/ds-css/darkside` (v7 import path)
- `Box.New` (removed in v8)
- Deprecated `variant` values: `danger`, `tertiary-neutral`, `secondary-neutral`
- Spacing without tokens: `gap="0"`, `paddingInline="0"`, `marginBlock="... 0"`
- Old token typo: `--a-` (should usually be `--ax-` in v8)

## Aksel v8 checklist

### CSS + theming

- CSS import uses `@navikt/ds-css` (not `@navikt/ds-css/darkside`).
- Dark/light mode toggling still works (verify both themes render correct colors).
- If you see “unstyled” components, check Aksel CSS layering/scoping requirements and ensure the app root matches the expected setup.

### Component API

- Replace all `Box.New` usages with `Box`.
- Replace `BoxNewProps` and other `*.New` prop typings with `ComponentProps<typeof Box>`.

### Spacing + radii

- Use spacing tokens everywhere: `space-*` (including `space-0`).
- If `borderRadius="large" | "medium"` fails typing, prefer numeric tokens like `"8"`, `"12"`.

### Colors / variants

- Avoid deprecated variants like `variant="danger"`, `variant="tertiary-neutral"`, `variant="secondary-neutral"`.
- Prefer `data-color` + a standard variant:
  - Destructive: `data-color="danger" variant="primary"`
  - Neutral tertiary: `data-color="neutral" variant="tertiary"`
  - Tags/chips: often `data-color="neutral" variant="outline"`

### Regression checks

- Delete flows (dialogs/buttons) still look destructive and accessible.
- Focus states: keyboard navigation still works for rating controls and action menus.
- No console errors about missing tokens/styles.

## Workspace note

This VS Code workspace contains other repos that may still be on Aksel v7. Don’t copy v8-specific patterns into those repos until their `@navikt/ds-react`/`@navikt/ds-css` dependencies are upgraded.
