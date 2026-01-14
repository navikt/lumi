---
description: Fix linting and formatting issues
---

# Lint & Format Workflow

// turbo-all

Use this workflow to fix code quality issues before committing.

## Step 1: Run Linter

```bash
cd lumi-dashboard
npm run lint
```

## Step 2: Auto-fix Linting Issues

```bash
npm run lint:fix
```

## Step 3: Check for Type Errors

```bash
npm run typecheck
```

## All-in-One Command

Run all checks:
```bash
npm run lint && npm run typecheck
```

## Common Issues

### Unused imports
Biome will flag unused imports. Remove them or use:
```bash
npx biome check --write .
```

### Import order
Biome enforces import sorting. Run `npm run lint:fix` to auto-fix.

### TypeScript any warnings
Avoid using `any`. Use proper types or `unknown` with type guards.
