---
title: Bidra til Lumi
---

# Bidra til Lumi

Denne siden er for utviklere som jobber _på_ Lumi — ikke for de som integrerer Lumi i sin app.

## Monorepo-struktur

| Pakke | Beskrivelse |
| :--- | :--- |
| `apps/lumi-dashboard` | TanStack Start (React) dashboard |
| `apps/lumi-api` | Kotlin/Ktor backend (PostgreSQL + Flyway + Exposed) |
| `packages/lumi-survey` | Aksel-basert React survey-widget |
| `packages/lumi-types` | Delte TypeScript-typer |

## Forutsetninger

- **Node.js 20+** — for frontend og survey-widget
- **JDK 21** — for backend
- **Docker** — for lokal PostgreSQL

## Kommandoer

Alle kommandoer kjøres fra repo root:

### Frontend

```sh
npm run dev          # Start dashboard lokalt (http://localhost:3000)
npm run lint         # Biome lint
npm run lint:fix     # Biome autofix
npm run typecheck    # TypeScript typecheck (alle pakker)
npm test             # Vitest (frontend + shared)
npm run e2e          # Playwright E2E-tester
```

### Backend

```sh
npm run api:run      # Start Kotlin API lokalt (http://localhost:8080)
npm run api:test     # Kjør backend-tester
npm run api:build    # Bygg backend JAR
```

::: tip Kvalitetssjekker
Kjør alltid `npm run lint` og `npm run typecheck` før du committer. Ved logikkendringer: kjør også `npm test` (frontend) eller `npm run api:test` (backend).
:::

## Lokal utvikling

### Frontend (dashboard)

```sh
npm install
npm run dev
# Åpne http://localhost:3000
```

Dashboardet kobler til backend på `http://localhost:8080` som standard. Sett `LUMI_API_URL` for å peke mot en annen instans.

### Backend (API)

```sh
# Start lokal PostgreSQL
docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi -e POSTGRES_DB=lumi \
  -p 5432:5432 postgres:17

# Start API
npm run api:run
# API tilgjengelig på http://localhost:8080
```

::: details NAIS team-oppslag lokalt
For å teste dashboard-autorisasjon lokalt trenger du tilgang til NAIS Console GraphQL API:

```sh
# Alt 1: Via NAIS CLI proxy (anbefalt)
nais login -n
nais alpha api proxy  # lytter på localhost:4242

export NAIS_API_GRAPHQL_URL='http://localhost:4242/graphql'
export NAIS_API_KEY='dummy'
npm run api:run

# Alt 2: Direkte med API-nøkkel
export NAIS_API_GRAPHQL_URL='https://console.nav.cloud.nais.io/graphql'
export NAIS_API_KEY='<dev-api-key>'
npm run api:run
```
:::

## TanStack MCP (lokalt script)

Repoet har et script for TanStack MCP-oppslag:

```sh
npm run tanstack:mcp -- list-tools
npm run tanstack:mcp -- call-tool listTanStackAddOns '{"framework":"React"}'
npm run tanstack:mcp -- call-tool tanstack_search_docs '{"query":"hydration","library":"start","framework":"react","limit":3}'
```

::: info Nett-tilgang
`tanstack_search_docs` og `tanstack_doc` krever internettilgang.
:::

## Konvensjoner

- Bruk **npm** — ikke pnpm eller yarn.
- **Aksel v8** (`@navikt/ds-react`) — ingen Tailwind.
- Dashboard-state er **URL-drevet** via TanStack Router search params.
- Backend eier PII-redaksjon — frontend bare viser.
- Deployes til NAIS via GitHub Actions.

## Se også

- [Release-prosess](/utvikling/release) — publisering av `@navikt/lumi-survey`
