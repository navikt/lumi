---
title: BigQuery og Metabase
---

# BigQuery og Metabase

Lumi kan legge en kopi av teamets svar i et BigQuery-datasett i teamets eget GCP-prosjekt. Lumi oppdaterer kopien hver natt. Derfra deler dere dataene på Datamarkedsplassen og bruker dem i Metabase og datafortellinger.

::: info Pilot
I produksjon er eksporten foreløpig åpen for team eSyfo og iSyfo. Skriv i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD) hvis teamet vil være med.
:::

## Før dere begynner

- Noen i teamet må kunne kjøre SQL i BigQuery i teamets GCP-prosjekt i prod.
- Oppdater teamets behandling i Behandlingskatalogen, kopien av etterlevelsesmalen E726, med at svarene lagres i BigQuery og deles på Datamarkedsplassen, og hvorfor. Se [spillereglene hos NADA](https://docs.knada.io/juridisk/spilleregler/).
- Bestem om fritekst skal være med. Les [Fritekst](#fritekst-valg) først.

## Slik setter dere opp eksporten

1. Velg **Eksporter** i menyen og deretter **Sett opp BigQuery-eksport**.
2. Kontroller **GCP-prosjekt** og **Datasett**. Lumi fyller inn teamets prosjekt fra Nais, og datasettet heter `lumi` hvis dere ikke endrer det.
3. Velg **Kopier SQL** og kjør SQL-en i BigQuery i Google Cloud-konsollet. **Åpne BigQuery** tar dere dit.
4. Velg **Sjekk tilkoblingen**. Siden viser hva som eventuelt mangler.
5. Velg om fritekst skal være med, og velg **Start eksporten**.

Første kjøring starter med en gang. Etterpå oppdaterer Lumi tabellene hver natt etter kl. 01. Velg **Oppdater nå** for å oppdatere med en gang, for eksempel etter at dere har slettet et svar i dashboardet.

SQL-en ser slik ut, med teamets prosjekt, teamnavnet og Lumis tjenestekonto fylt inn:

```sql
CREATE SCHEMA `team-esyfo-prod-1a2b.lumi`
  OPTIONS (
    location = 'europe-north1',
    labels = [('lumi-team', 'team-esyfo')],
    max_time_travel_hours = 48,
    description = 'Svar fra Lumi. Lumi oppdaterer tabellene hver natt.'
  );

GRANT `roles/bigquery.dataEditor`
  ON SCHEMA `team-esyfo-prod-1a2b.lumi`
  TO "serviceAccount:<Lumis tjenestekonto>";
```

::: details Hva hver del av SQL-en gjør
- `location`: Lumi skriver bare til datasett i `europe-north1`.
- `labels`: Labelen `lumi-team` viser hvilket team datasettet er satt opp for. Lumi skriver ikke til et datasett der labelen mangler eller viser et annet team.
- `max_time_travel_hours`: BigQuery tar vare på rader Lumi har erstattet, i 48 timer i stedet for sju døgn.
- `GRANT`: Lumi får rollen BigQuery Data Editor på dette datasettet og ingenting annet i prosjektet. Rollen gir ikke Lumi rett til å gi andre tilgang.

Har dere allerede et datasett dere vil bruke, legg til labelen `lumi-team` under **Edit details** i BigQuery, og kjør bare `GRANT`-setningen.
:::

## Tabellene {#kolonner}

Lumi skriver tabellene `svar` og `innsendinger`, og `fritekst` hvis dere har slått det på. Hver natt erstatter Lumi hele innholdet med svarene fra de siste 12 månedene. Kolonnebeskrivelsene står også i skjemaet i BigQuery og vises på Datamarkedsplassen.

Kolonnene som er felles for alle tabellene:

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `innsending_id` | STRING | Pseudonym ID for innsendingen. Den er lik i alle tabellene og endrer seg ikke mellom kjøringer. Den er en annen enn ID-en i filene fra **Eksporter**. |
| `innsendt_tidspunkt` | TIMESTAMP | Når Lumi tok imot svaret |
| `innsendt_dato` | DATE | Datoen Lumi tok imot svaret, i norsk tid. Samme dag som dashboardet bruker |
| `app` | STRING | Appen som sendte svaret |
| `survey_id` | STRING | Survey-ID-en |
| `survey_type` | STRING | `rating`, `topTasks`, `taskPriority`, `discovery` eller `custom` |
| `survey_arkivert` | BOOLEAN | Om surveyen er arkivert i dashboardet. Dashboardet skjuler arkiverte surveyer som standard |
| `enhetstype` | STRING | `mobile`, `tablet` eller `desktop` |
| `kontekst` | STRING | Segmenteringstagsene appen sendte med, som JSON. Les en verdi med `JSON_VALUE(kontekst, '$.rolle')` |
| `skjemaversjon` | STRING | Fingeravtrykk av surveydefinisjonen. Endres når spørsmål eller svaralternativer endres |
| `oppdatert_tidspunkt` | TIMESTAMP | Når Lumi skrev tabellen |

### svar

Én rad per svar på vurderings- og valgspørsmål. Flervalg gir én rad per valgt alternativ. Ubesvarte spørsmål gir ingen rad.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `sporsmal_id` | STRING | Spørsmålets ID (`fieldId`) |
| `sporsmal_tekst` | STRING | Den nyeste teksten for spørsmålet, slik dashboardet viser den |
| `sporsmal_type` | STRING | `RATING`, `SINGLE_CHOICE` eller `MULTI_CHOICE` |
| `rating_verdi` | INTEGER | Svaret på et vurderingsspørsmål. NPS går fra 0 til 10, tommel er 1 (ned) eller 2 (opp), emoji og stjerner går fra 1 til 5 |
| `rating_variant` | STRING | `emoji`, `stars`, `thumbs` eller `nps` |
| `rating_skala` | INTEGER | Antall trinn: 5 for emoji og stjerner, 2 for tommel og 11 for NPS |
| `valg_id` | STRING | ID-en til alternativet som ble valgt |
| `valg_tekst` | STRING | Den nyeste teksten for alternativet |

### innsendinger

Én rad per innsending. Bruk tabellen når dere teller svar eller trenger en nevner.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `antall_svar` | INTEGER | Antall spørsmål som ble besvart, også fritekst |
| `har_fritekst` | BOOLEAN | Om innsendingen har minst ett fritekstsvar |
| `varighet_sekunder` | INTEGER | Sekunder fra surveyen åpnet til svaret ble sendt, når appen sender det |

### fritekst

Én rad per fritekstsvar, bare når dere har slått på fritekst.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `sporsmal_id` | STRING | Spørsmålets ID |
| `sporsmal_tekst` | STRING | Den nyeste teksten for spørsmålet |
| `tekst` | STRING | Fritekstsvaret, med kjente mønstre for personopplysninger maskert |
| `maskert` | BOOLEAN | Om Lumi har maskert noe i innsendingen |

Dette er aldri med: URL og side, user agent, skjerm- og vindusstørrelse, debug, Lumis interne ID-er, tags dere har satt i dashboardet, og svar på datospørsmål.

## Fritekst {#fritekst-valg}

Fritekst er av som standard. Lumi maskerer kjente mønstre som fødselsnummer, e-post og telefonnummer, men ikke navn. Tekstene havner i en egen tabell, slik at dere kan dele `svar` uten å dele tekstene. Slår dere av fritekst under **Innstillinger**, sletter Lumi tabellen `fritekst`.

## Teamets ansvar {#ansvar}

Kopien i prosjektet er teamets. Dere bestemmer hvem som får tilgang på Datamarkedsplassen, hva dataene brukes til, og sørger for at behandlingen i Behandlingskatalogen dekker delingen.

- Svar dere sletter i dashboardet, og svar som blir eldre enn 12 måneder, forsvinner fra BigQuery ved neste kjøring.
- BigQuery tar vare på rader Lumi har erstattet, i 48 timer. Google tar vare på dem i sju dager til, uten at dere kan lese dem.
- Lumi oppdaterer ikke kopier dere lager selv, for eksempel lagrede resultater i Metabase, tabeller i notebooks og statiske datafortellinger.
- Tabellene forsvinner av seg selv sju dager etter siste vellykkede kjøring. Det skjer også hvis dere fjerner Lumis tilgang eller eksporten stopper.

Tabellene har ikke navn eller fødselsnummer. Tidspunkt, app, kontekst og svar kan likevel gjøre det mulig å kjenne igjen hvem som svarte i små grupper. Registrer derfor tabellene som personopplysninger.

## Del dataene på Datamarkedsplassen {#datamarkedsplassen}

1. Gå til [Datamarkedsplassen](https://data.ansatt.nav.no/dataproduct/new) og legg til et nytt dataprodukt. Velg teamets gruppe og skriv hva dataene kan brukes til.
2. Legg til tabellene `svar` og `innsendinger` som datasett i dataproduktet. Velg at de inneholder personopplysninger.
3. Gi tilgang til de som skal bruke dataene, eller la dem søke om tilgang. De som søker, må ha en behandling i Behandlingskatalogen.

Den som skal bruke dataene i Metabase, må få tilgang hver for seg. Tilgang gitt til en gruppe følger ikke med til Metabase. Se [Metabase hos NADA](https://docs.knada.io/analyse/metabase/).

## Bruk tabellene i Metabase {#metabase}

Velg **Legg til i Metabase** på datasettet på Datamarkedsplassen. Metabase lager en samling med samme tilgang som datasettet. Lagre spørsmål og dashboard der, ellers kan alle i Nav se dem.

Metabase kan ikke koble sammen tabeller som er tilgangsbegrenset. Bruk derfor `svar` til det meste. Den har spørsmålstekst og svartekst på hver rad og fungerer i spørringsbyggeren uten SQL:

- Fordeling: filtrer på `sporsmal_id` og tell rader per `rating_verdi` eller `valg_tekst`.
- Utvikling: ta snitt av `rating_verdi` per uke på `innsendt_dato`.

Spørringene under fungerer i Metabase og i BigQuery. Bytt ut prosjekt, datasett og spørsmåls-ID.

Fordeling på et vurderingsspørsmål:

```sql
SELECT rating_verdi, COUNT(*) AS antall
FROM `team-esyfo-prod-1a2b.lumi.svar`
WHERE sporsmal_id = 'opplevelse'
GROUP BY rating_verdi
ORDER BY rating_verdi
```

Snitt per uke:

```sql
SELECT DATE_TRUNC(innsendt_dato, ISOWEEK) AS uke,
       ROUND(AVG(rating_verdi), 2) AS snitt,
       COUNT(*) AS antall
FROM `team-esyfo-prod-1a2b.lumi.svar`
WHERE sporsmal_id = 'opplevelse'
GROUP BY uke
ORDER BY uke
```

NPS, andelen 9 og 10 minus andelen 0 til 6:

```sql
SELECT ROUND(100 * (COUNTIF(rating_verdi >= 9) - COUNTIF(rating_verdi <= 6)) / COUNT(*)) AS nps,
       COUNT(*) AS antall
FROM `team-esyfo-prod-1a2b.lumi.svar`
WHERE rating_variant = 'nps'
```

Andel som valgte hvert alternativ, av dem som svarte på spørsmålet. For flervalg kan summen bli over 100 prosent:

```sql
WITH besvart AS (
  SELECT COUNT(DISTINCT innsending_id) AS antall
  FROM `team-esyfo-prod-1a2b.lumi.svar`
  WHERE sporsmal_id = 'prioritering'
)
SELECT valg_tekst,
       COUNT(*) AS antall,
       ROUND(100 * COUNT(*) / ANY_VALUE(besvart.antall), 1) AS prosent
FROM `team-esyfo-prod-1a2b.lumi.svar`, besvart
WHERE sporsmal_id = 'prioritering'
GROUP BY valg_tekst
ORDER BY antall DESC
```

Antall innsendinger per dag, uten arkiverte surveyer:

```sql
SELECT innsendt_dato, app, survey_id, COUNT(*) AS innsendinger
FROM `team-esyfo-prod-1a2b.lumi.innsendinger`
WHERE NOT survey_arkivert
GROUP BY innsendt_dato, app, survey_id
ORDER BY innsendt_dato
```

## Lag en datafortelling {#datafortelling}

En datafortelling er et Quarto-dokument som teamet publiserer på Datamarkedsplassen med teamets token. Lumis tabeller leses som andre tabeller i BigQuery:

```python
from google.cloud import bigquery

client = bigquery.Client(project="team-esyfo-prod-1a2b")
svar = client.query(
    """
    SELECT innsendt_dato, rating_verdi
    FROM `team-esyfo-prod-1a2b.lumi.svar`
    WHERE app = 'bro-frontend' AND sporsmal_type = 'RATING'
    """
).to_dataframe()
```

Kjør fortellingen etter kl. 03, når nattens kjøring er ferdig. NADA beskriver hvordan dere publiserer og oppdaterer den med en Naisjob, Airflow eller Union i [Datafortellinger](https://docs.knada.io/analyse/datafortellinger/). Skal fortellingen deles med alle i Nav, vis bare aggregerte tall og aldri enkeltsvar eller fritekst.

## Endre eller stoppe eksporten {#stopp}

Under **Innstillinger** kan dere bytte datasett og slå fritekst av eller på. Lumi sjekker det nye datasettet før endringen lagres, og sletter Lumis tabeller i det gamle.

**Stopp eksporten** sletter Lumis tabeller og innstillingene. Datasettet og andre tabeller i det blir stående. Dataprodukter, Metabase-spørsmål og datafortellinger som bruker tabellene, slutter å virke.

## Når noe feiler {#feil}

Siden viser hva som stoppet siste kjøring. De vanligste årsakene:

| Melding | Hva dere gjør |
| :--- | :--- |
| **Prosjektet er ikke teamets eget** | Bruk prosjektet siden foreslår. Det er teamets prosjekt i Nais |
| **Lumi finner ikke datasettet** | Kjør SQL-en, og sjekk at prosjekt og datasett er skrevet likt |
| **Lumi har ikke tilgang til datasettet** | Kjør `GRANT`-setningen i SQL-en |
| **Datasettet ligger i feil region** | Lag et nytt datasett i `europe-north1` med SQL-en |
| **Datasettet mangler label for teamet** | Legg til labelen `lumi-team` med teamnavnet |
| **Datasettet er merket for et annet team** | Endre labelen til teamnavnet, eller bruk et annet datasett |
| **Lumi får ikke lage tabeller i datasettet** | Gi Lumis tjenestekonto rollen BigQuery Data Editor på datasettet |
| **Datasettet har allerede en tabell som heter …** | Bruk et eget datasett for Lumi. Lumi overskriver ikke tabeller den ikke har laget |

Feil på Lumis side gir varsel til team eSyfo, og Lumi prøver igjen automatisk. Står eksporten fast, skriv i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD).
