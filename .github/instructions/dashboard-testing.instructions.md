---
applyTo: "apps/lumi-dashboard/**/*.test.{ts,tsx},apps/lumi-dashboard/e2e/**/*.spec.ts"
---

# Testing (lumi-dashboard)

This repo is a TanStack Start app (React + TypeScript).

- Unit/integration tests: Vitest + Testing Library
- E2E tests: Playwright (in `apps/lumi-dashboard/e2e/`)

## Commands

```sh
pnpm run test
pnpm run e2e
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
- **Run E2E before marking work as done** — either locally (`pnpm run e2e` from repo root, or `pnpm run e2e` in `apps/lumi-dashboard`) or verify the CI run passes. If Playwright hangs locally, push and check CI, but do NOT skip verification entirely.

### Mock data and small samples

Internal dashboard statistics include samples with 1–4 responses, including
filtered results and individual trend buckets. Mock calculations must match
this behavior. Keep tests for empty results, team isolation, and labels that
may be absent when a field has no answers.

The frontend may still receive a masked response from an older backend during
rollout. Preserve defensive rendering tests for that response contract.
Analysis-product and export thresholds are separate from dashboard behavior.

## Boundaries

### ✅ Always

- Add tests for new logic
- Cover both happy path and failure path
- Run `pnpm run test` before opening a PR

### ⚠️ Ask First

- Changing the test stack (Vitest/Playwright)
- Adding new E2E suites beyond the feature scope

### 🚫 Never

- Commit failing tests
- Use Jest APIs in this repo
