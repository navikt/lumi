---
description: Fix linting and formatting issues
---

# Lint & Format Workflow

// turbo-all

Use this workflow to fix code quality issues before committing.

## Step 1: Run Linter

```bash
cd apps/lumi-dashboard
pnpm run lint
```

Or run the same command from the repo root:

```bash
pnpm --dir apps/lumi-dashboard run lint
```

## Step 2: Auto-fix Linting Issues

```bash
pnpm run lint:fix
```

## Step 3: Check for Type Errors

```bash
pnpm run typecheck
```

## All-in-One Command

Run all checks:
```bash
pnpm run lint && pnpm run typecheck
```

## Common Issues

### Unused imports
Biome will flag unused imports. Remove them or use:
```bash
pnpm exec biome check --write .
```

### Import order
Biome enforces import sorting. Run `pnpm run lint:fix` to auto-fix.

### TypeScript any warnings
Avoid using `any`. Use proper types or `unknown` with type guards.
