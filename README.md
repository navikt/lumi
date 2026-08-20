# Lumi

![Build Status](https://github.com/navikt/lumi/actions/workflows/ci.yaml/badge.svg)
![Publish @navikt/lumi-survey](https://github.com/navikt/lumi/actions/workflows/publish-lumi-survey.yaml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Personvernvennlig survey-infrastruktur for NAV.**
Lumi lar deg samle brukerinnsikt uten at data forlater clusteret, med full støtte for Zero Trust og universell utforming.

| Pakke | Beskrivelse | Tech Stack |
| :--- | :--- | :--- |
| [`@navikt/lumi-survey`](packages/lumi-survey) | React-widget (Aksel) | React, CSS Modules |
| [`lumi-api`](apps/lumi-api) | Backend & Analyse API | Kotlin, Ktor, Postgres |
| [`lumi-dashboard`](apps/lumi-dashboard) | Admin-dashboard | TanStack Start, React |

## Arkitektur

```mermaid
flowchart LR
	subgraph Client["Klient"]
		A["lumi-survey (i din app)"]
	end

	subgraph App["Din app"]
		B["API-route / server action"]
		C["Token exchange (TokenX / AzureAD)"]
	end

	subgraph Platform["Lumi"]
		D["lumi-api"]
		E["Dashboard / analytics"]
	end

	A --> B --> C --> D --> E

	classDef client fill:#E8F2FF,stroke:#0B5FFF,stroke-width:1px,color:#0B2E66;
	classDef app fill:#E9F8F0,stroke:#1C7C54,stroke-width:1px,color:#0F3D2E;
	classDef platform fill:#FFF2E8,stroke:#CC4F00,stroke-width:1px,color:#6A2A00;

	class A client;
	class B,C app;
	class D,E platform;
```

## Dokumentasjon

📖 **[navikt.github.io/lumi/](https://navikt.github.io/lumi/)** — Fullstendig integrasjonsguide, widget-referanse og dashboard-dokumentasjon.

### Hurtigstart

```bash
pnpm add @navikt/lumi-survey
# eller
npm install @navikt/lumi-survey
# eller
yarn add @navikt/lumi-survey
```

Se [Kom i gang](https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi) for komplett guide.

## Utvikling

Repoet bruker [mise](https://mise.jdx.dev/) til å holde Node og Java på samme versjon for alle. Pnpm-versjonen kommer fra `packageManager` i `package.json` via Corepack. Kjør `mise trust`, `mise install` og deretter `mise run setup` første gang du kloner repoet. Bruk `mise tasks` for å se oppdaterte utviklings-, test- og byggoppgaver.

### Lokal full-chain-demo

Oppgaven `local-up` starter Postgres, API, submission-proxy, dashboard og en ekte `@navikt/lumi-survey`-testside.

Åpne deretter:

- testbenk: <http://localhost:3001>
- dashboard med ekte lokale data: <http://localhost:3000>

Se [den lokale testguiden](scripts/README.md#full-chain-demo-med-ekte-widget) for variantmatrise, feilsøking og teardown.

## For Nav-ansatte

Spørsmål om utvikling og drift kan tas i [#esyfo på Slack](https://nav-it.slack.com/archives/C012X796B4L).
