---
title: Filtrering
---

# Filtrering

Dashboardet gir deg avanserte filtreringsmuligheter for å finne relevante tilbakemeldinger raskt.

## Tilgjengelige filtre

### Team og app

Når du åpner dashboardet, velges standardteamet ditt automatisk. Du kan bytte team i team-velgeren (kun team du er medlem av vises).

Innenfor et team kan du filtrere ned på spesifikke **apper** for å se data fra én enkelt tjeneste.

### Tidsperiode

Velg tidsperiode med dato-velgerne:

- **Fra-dato** — startdato (inklusiv)
- **Til-dato** — sluttdato (inklusiv)

Datoer tolkes i tidssone `Europe/Oslo`.

### Fritekstsøk

Bruk søkefeltet for å gjøre **fulltekstsøk** i fritekst-tilbakemeldinger. Søket matcher mot innholdet i brukerens svar.

::: tip
Sensitive data som fødselsnummer og e-post er maskert av backend, så disse vil ikke dukke opp i søkeresultater. Se [PII-maskeringen](/sikkerhet/arkitektur#pii-maskering) for detaljer.
:::

### Forhåndsdefinerte filtre

| Filter | Beskrivelse |
| :--- | :--- |
| **Kun fritekst** | Vis bare tilbakemeldinger som inneholder fritekst-svar |
| **Lave ratinger** | Vis bare tilbakemeldinger med rating 1–2 |

### Tags

Filtrer på én eller flere tags som er lagt til tilbakemeldingene. Tags kan kombineres — kun tilbakemeldinger med alle valgte tags vises.

### Enhetstype

Filtrer på brukerens enhetstype:

- `mobile`
- `tablet`
- `desktop`

### Segmenter

Filtrer på segmenterings-tags som ble sendt med fra widgeten, f.eks. `rolle:arbeidsgiver` eller `harSykmelding:true`.

### Survey-ID

Filtrer ned til en spesifikk survey ved å velge survey-ID.

### Top Tasks drill-down

For Top Tasks-surveys kan du filtrere på en spesifikk oppgave (task) for å se detaljstatistikk.

## Sortering og paginering

Resultatlisten pagineres med konfigurerbar sidestørrelse. API-et bruker 0-indeksert paginering.

## URL-drevne filtre

Alle filtre er **URL-drevne** — de lagres i URL-en som query-parametere via TanStack Router. Det betyr at du kan:

- **Dele en filtrert visning** ved å kopiere URL-en
- **Bruke nettleserhistorikk** for å navigere mellom filterstater
- **Bokmerke** en bestemt filtrering du bruker ofte

## Se også

- [API query-parametre](/referanse/api-endepunkter#query-parametre) — full oversikt over alle filtreringsparametre
- [Eksport](/dashboard/eksport) — eksporter filtrerte resultater
