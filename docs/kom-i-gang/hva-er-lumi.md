---
title: Hva er Lumi?
---

# Hva er Lumi?

Lumi er et verktøy for å kjøre personvernvennlige surveys i Nav-apper. Du definerer spørsmålene i TypeScript, widgeten kjører i din app, og all data forblir i Nav-clusteret.

## Hvorfor Lumi?

- **Survey as code** — definer spørsmål i TypeScript, rett i kodebasen din. Ingen ekstern tjeneste.
- **Privacy by design** — all data blir i Nav-clusteret, og personopplysninger maskeres automatisk.
- **Aksel-basert** — widgeten bruker Navs designsystem og følger WCAG.
- **Rask integrasjon** — installer en React-widget, koble til backend, ferdig.
- **Dashboard** — filtrer, segmenter og eksporter survey-data med teambasert tilgangsstyring.

## Arkitektur

Lumi består av tre deler: en frontend-widget som lever i *din* app, et API-lag som *du* eier (token exchange + videresending), og Lumi-plattformen som lagrer og visualiserer data.

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

## Pakkeoversikt

| Pakke | Beskrivelse | Tech Stack |
| :--- | :--- | :--- |
| [`@navikt/lumi-survey`](https://github.com/navikt/lumi/tree/main/packages/lumi-survey) | React-widget (Aksel) | React, CSS Modules |
| [`lumi-api`](https://github.com/navikt/lumi/tree/main/apps/lumi-api) | Backend & Analyse API | Kotlin, Ktor, Postgres |
| [`lumi-dashboard`](https://github.com/navikt/lumi/tree/main/apps/lumi-dashboard) | Admin-dashboard | TanStack Start, React |

Du trenger kun å forholde deg til **`@navikt/lumi-survey`** — de to andre pakkene driftes av Team eSyfo.

## Hvem er Lumi for?

Lumi er laget for **Nav-team som vil samle brukerinnsikt** i sine flater — enten det er en sluttbrukerflate på nav.no eller en intern løsning som Modia. Du trenger:

- En React-app som kjører på NAIS
- Mulighet til å gjøre token exchange (TokenX eller AzureAD) for å sende inn svar

## Neste steg

Klar til å komme i gang? Gå videre til [Installer widget](/kom-i-gang/installer-widget) for å sette opp pakken i prosjektet ditt.
