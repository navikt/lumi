---
applyTo: "**/*.test.{ts,tsx}"
---

# Testing (lumi-dashboard)

This repo is a TanStack Start app (React + TypeScript).

- Unit/integration tests: Vitest + Testing Library
- E2E tests: Playwright (in `e2e/`)

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
