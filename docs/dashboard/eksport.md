---
title: Eksport
---

# Eksport

Under **Eksporter** i menyen laster dere ned svarene som CSV, Excel eller JSON. Filen får med svarene som passer med filtrene i filterlinjen.

## Slik eksporterer dere

1. Velg **Eksporter** i menyen. Filtrene fra **Dashboard** eller **Tilbakemeldinger** følger med.
2. Juster team, app, survey, periode og de andre [filtrene](/dashboard/filtrering). Kortet **Aktive filtre** viser hva som blir med.
3. Velg format under **Velg format**: **CSV**, **Excel (XLSX)** eller **JSON**.
4. Velg knappen **Last ned**, for eksempel **Last ned CSV**.

Filen får navnet `lumi-export-` med dagens dato. Svar fra arkiverte surveyer er bare med når bryteren **Arkiverte** er på, se [Arkiverte surveyer](/dashboard/visninger#arkiverte).

## Hvor mange svar som blir med {#maks}

En eksport har opptil 10 000 svar. Når filtrene treffer flere svar, får dere de 10 000 nyeste, uten beskjed om at resten er utelatt. Sjekk derfor antallet under **Tilbakemeldinger** før dere eksporterer, og del opp perioden hvis det er over 10 000.

Sidene under **Tilbakemeldinger** påvirker ikke eksporten.

## Hva filene inneholder {#innhold}

### CSV og Excel

CSV- og Excel-filen har én rad per innsending og de samme kolonnene:

| Kolonne i CSV | Kolonne i Excel | Innhold |
| :--- | :--- | :--- |
| `id` | ID | Svarets ID |
| `submittedAt` | Tidspunkt | Når svaret ble sendt inn |
| `app` | App | Appen som sendte svaret |
| `surveyId` | Survey | Survey-ID-en |
| `rating` | Vurdering | Svaret på det første vurderingsspørsmålet |
| `feedback` | Tilbakemelding | Svaret på det første fritekstspørsmålet |
| `sensitiveDataRedacted` | Sensitiv data fjernet | Om Lumi har maskert tekst som så ut som personopplysninger. `true` eller `false` i CSV, Ja eller Nei i Excel |
| `screenWidth` | Skjermbredde | Skjermbredden i piksler |
| `screenHeight` | Skjermhøyde | Skjermhøyden i piksler |

Filene har bare ett vurderingssvar og ett fritekstsvar per innsending. Svar på valgspørsmål, oppgavene i Top Tasks og Task Priority, enhet, side og tags finnes bare i JSON-filen.

Begynner en verdi med `=`, `+`, `-` eller `@`, står det en apostrof foran den. Da leser ikke regnearket verdien som en formel.

### JSON

JSON-filen har én oppføring per innsending med alle svarene. For hvert svar står spørsmålsteksten og svaralternativene. I tillegg har hver oppføring survey-ID, surveytype og surveyversjon, konteksten fra appen (side, adresse, enhet, skjerm- og vindusstørrelse og segmenteringstags), tagsene teamet har lagt til, og om tekst er maskert.

### Maskert tekst

Eksporten har fritekstsvarene slik de ble lagret, med kjente mønstre for personopplysninger maskert. Sjekk filen før dere deler den. Hva som maskeres, står under [PII-maskering](/referanse/sikkerhet#pii-maskering).

## Grense for antall eksporter

Hver bruker kan eksportere 30 ganger per minutt. Går dere over grensen, viser eksportsiden en feilmelding med knappen **Prøv igjen**. Alle grensene står under [Rate limiting](/referanse/sikkerhet#rate-limiting).

::: details For utviklere: endepunktet
Dashboardet henter filen fra `GET /api/v1/intern/export`. `format` er `csv`, `json` eller `excel`, og et ukjent format gir CSV. De andre parameterne er de samme filtrene som dashboardet bruker: `team`, `includeArchived`, `app`, `surveyId`, `fromDate`, `toDate`, `hasText`, `lowRating`, `query`, `tag`, `deviceType`, `segment`, `theme`, `task`, `choice`, `rating` og `phrase`. `tag`, `segment`, `choice` og `rating` kan gjentas. `choice` har formatet `fieldId:optionId`, og `rating` har formatet `fieldId:verdi`.
:::
