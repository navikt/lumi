---
description: Start the development server for local testing
---

# Development Server Workflow

// turbo-all

## Start the Dev Server

1. Navigate to the project directory:
```bash
cd apps/lumi-dashboard
```

2. Install dependencies (if needed):
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm run dev
```
4. Open the browser to http://localhost:3000

## Mock Mode

The app runs with mock data by default in development. This is controlled by the `DEMO_MODE` environment variable.

To run with real API:
```bash
DEMO_MODE=false pnpm run dev
```

## Available Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run lint` - Run Biome checks
- `pnpm run lint:fix` - Auto-fix Biome issues
- `pnpm run start` - Start production server
- `pnpm run typecheck` - TypeScript check
- `pnpm run test` - Run unit/integration tests (Vitest)
- `pnpm run e2e` - Run E2E tests (Playwright)
### Port already in use
```bash
# Find and kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Clear cache and reinstall
```bash
rm -rf node_modules .vinxi
pnpm install
pnpm run dev
```
