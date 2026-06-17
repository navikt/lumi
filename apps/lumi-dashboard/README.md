# Lumi Dashboard

> 📖 **Bruker dashboardet?** Se [Dashboard-dokumentasjonen](https://navikt.github.io/lumi/dashboard/tilgang) for tilgang og bruk.

Analyse-dashboard for Lumi survey-data. Bygget med TanStack Start.

## Kom i gang

```bash
# Forutsetninger: Node.js 24

# 1. Klon og installer
git clone https://github.com/navikt/lumi.git
cd lumi
pnpm install

# 2. Sett miljøvariabler (valgfritt – default fungerer lokalt)
export LUMI_API_URL=http://localhost:8080

# 3. Start dev-server
pnpm run dev
# Åpne http://localhost:3000
```

## Egenskaper

- 📊 **Dashboard** - Visuell oversikt med grafer og statistikk
- 📈 **Grafer** - Fordeling av rating, tidslinje, topp apper
- 🔍 **Avansert filtrering** - Dato, team, app, fritekstsøk, tags
- 📤 **Eksport** - Nedlasting som CSV, JSON og Excel
- 🔒 **Beskyttelse av sensitive data** - PII maskeres automatisk av backenden
- 🎨 **Aksel** - NAV designsystem

## Teknologistack

- **TanStack Start** - Fullstack React-rammeverk
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Håndtering av server state
- **@navikt/ds-react** - NAV Aksel-komponenter
- **Recharts** - Grafer og visualisering
- **@navikt/oasis** - Azure AD-autentisering

## Sider

| Rute        | Beskrivelse                                 |
| ----------- | ------------------------------------------- |
| `/`         | Dashboard med oversiktsgrafer og statistikk |
| `/feedback` | Detaljert tabell med filtre                 |
| `/export`   | Eksport i ulike formater                    |

## Utvikling

### Forutsetninger

- Node.js 22+
- pnpm 11+

### Oppsett

```bash
# Kjør fra repo-roten

# Installer avhengigheter
pnpm install

# Start dev-server
pnpm run dev

# Bygg for produksjon
pnpm --filter lumi-dashboard run build

# Start produksjonsserver
pnpm --filter lumi-dashboard run start
```

### Miljøvariabler

| Variabel            | Beskrivelse                   | Standard                                     |
| ------------------- | ----------------------------- | -------------------------------------------- |
| `LUMI_API_URL`      | URL til backend-API           | `http://localhost:8080`                      |
| `LUMI_API_AUDIENCE` | Azure AD-audience for OBO     | `api://dev-gcp.team-esyfo.lumi-api/.default` |
| `NAIS_CLUSTER_NAME` | NAIS cluster (aktiverer auth) | -                                            |

## Deploy

Deployes til NAIS via GitHub Actions.

### URLs

- **Dev**: https://lumi-dashboard.ansatt.dev.nav.no
- **Prod**: https://lumi-dashboard.ansatt.nav.no

## Authentication

Bruker Wonderwall + Azure AD for autentisering:

1. Bruker åpner appen
2. Wonderwall stopper og videresender til Azure AD-innlogging
3. Etter innlogging legger Wonderwall token på requests
4. Appen validerer token og bytter til OBO-token for å kalle backenden

## Prosjektstruktur

```
app/
├── routes/             # TanStack Router-ruter
│   ├── index.tsx       # Dashboard-side (entry)
│   └── feedback.tsx    # Tilbakemeldingsside (tabell)
├── components/
│   ├── dashboard/      # Dashboard-komponenter
│   │   ├── views/      # Views per survey-type
│   │   │   ├── Overview/       # Default "alle surveys"-view
│   │   │   ├── TopTasks/       # Top Tasks-survey
│   │   │   ├── Discovery/      # Discovery-survey
│   │   │   ├── TaskPriority/   # Task Priority-survey
│   │   │   └── Rating/         # Rating/Custom-survey
│   │   ├── DashboardComponents/
│   │   ├── StatsCards/
│   │   └── FieldStats/
│   ├── feedback/       # Tilbakemeldingstabell og relatert
│   └── shared/         # Felles utiler og grafer
├── hooks/              # Custom TanStack Query-hooks
├── types/              # TypeScript-grensesnitt og Zod-schema
├── server/             # Server-side logikk og API-kall
├── styles/             # Global CSS og tokens
└── mock/               # MSW mock-data og handlers
```
