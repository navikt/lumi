---
applyTo: "apps/lumi-dashboard/**/*.test.{ts,tsx},apps/lumi-dashboard/e2e/**/*.spec.ts"
---

# Testing (lumi-dashboard)

This repo is a TanStack Start app (React + TypeScript).

- Unit/integration tests: Vitest + Testing Library
- E2E tests: Playwright (in `apps/lumi-dashboard/e2e/`)

## Commands

```sh
npm run test
npm run e2e
```

## Vitest

- Prefer user-centric assertions (Testing Library).
- Use `vi.mock` / `vi.spyOn` (avoid Jest APIs).
- Keep tests deterministic (no real network).

```ts
import { describe, expect, it } from "vitest";

describe("number formatting", () => {
  it("uses no-NO explicitly", () => {
    expect((151354).toLocaleString("no-NO")).toBe("151\u00A0354");
  });
});
```

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorComponent } from "~/components/shared/ErrorComponent";

describe("ErrorComponent", () => {
  it("renders an error message", () => {
    render(<ErrorComponent />);
    expect(screen.getByText(/feil|error/i)).toBeInTheDocument();
  });
});
```

## Playwright

- Keep E2E tests focused on user-critical flows.
- Prefer accessible selectors (`getByRole`) over brittle CSS selectors.
- **Run E2E before marking work as done** — either locally (`npm run e2e` from `apps/lumi-dashboard`) or verify the CI run passes. If Playwright hangs locally, push and check CI, but do NOT skip verification entirely.

### Mock data and privacy masking

The dashboard masks aggregated stats (fieldStats, etc.) when results fall below `MIN_AGGREGATION_THRESHOLD` (5 items). This affects E2E tests:

- **Filter combinations** can reduce mock data below the threshold, causing fieldStats to be returned as `[]`.
- **Label resolution** depends on stats data — when masked, filter chips show fallback labels (e.g. "Valg: optionId" instead of "Rolle: Arbeidsgiver").
- **Never assert exact label text** when filters may trigger masking. Instead, assert on URL params, element presence, or ARIA attributes.

```ts
// ✅ Robust — tests state, not resolved labels
await expect
  .poll(() => new URL(page.url()).searchParams.get("choice"))
  .toBe("role:Arbeidsgiver");
await expect(
  page.getByRole("button", { name: /Fjern filter/ }),
).toBeVisible();

// ❌ Brittle — depends on stats not being masked
await expect(page.getByText("Rolle: Arbeidsgiver")).toBeVisible();
```

## Boundaries

### ✅ Always

- Add tests for new logic
- Cover both happy path and failure path
- Run `npm run test` before opening a PR

### ⚠️ Ask First

- Changing the test stack (Vitest/Playwright)
- Adding new E2E suites beyond the feature scope

### 🚫 Never

- Commit failing tests
- Use Jest APIs in this repo
