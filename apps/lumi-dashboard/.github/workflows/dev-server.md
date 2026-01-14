---
description: Start the development server for local testing
---

# Development Server Workflow

// turbo-all

## Start the Dev Server

1. Navigate to the project directory:
```bash
cd /Users/kreps1/IdeaProjects/lumi-dashboard
```

2. Install dependencies (if needed):
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```
cd lumi-dashboard
4. Open the browser to http://localhost:3000

## Mock Mode

The app runs with mock data by default in development. This is controlled by the `DEMO_MODE` environment variable.

To run with real API:
```bash
DEMO_MODE=false npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Biome
- `npm test` - Run tests
- `npm run lint` - Run Biome checks
- `npm run lint:fix` - Auto-fix Biome issues
- `npm run typecheck` - TypeScript check
- `npm run test` - Run unit/integration tests (Vitest)
- `npm run e2e` - Run E2E tests (Playwright)
### Port already in use
```bash
# Find and kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Clear cache and reinstall
```bash
rm -rf node_modules .vinxi
npm install
npm run dev
```
