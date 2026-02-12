# Utvikling av Lumi

Utviklernotater for de som jobber _på_ Lumi (ikke _med_ Lumi som integratør).

## Kommandoer (repo root)

```sh
npm run dev          # Start dashboard lokalt
npm run lint         # Biome lint
npm run lint:fix     # Biome autofix
npm run typecheck    # TypeScript typecheck (alle pakker)
npm test             # Vitest (frontend + shared)
npm run e2e          # Playwright E2E

npm run api:run      # Start Kotlin API lokalt
npm run api:test     # Kjør backend-tester
npm run api:build    # Bygg backend JAR
```

## TanStack MCP (lokalt script)

For TanStack MCP-oppslag fra dette repoet, bruk scriptet:

- `npm run tanstack:mcp -- list-tools`
- `npm run tanstack:mcp -- call-tool listTanStackAddOns '{"framework":"React"}'`
- `npm run tanstack:mcp -- call-tool tanstack_search_docs '{"query":"hydration","library":"start","framework":"react","limit":3}'`

Merk: `tanstack_search_docs` og `tanstack_doc` krever nett-tilgang.

## Release

- `@navikt/lumi-survey`: se [`packages/lumi-survey/CONTRIBUTING.md`](../packages/lumi-survey/CONTRIBUTING.md)
