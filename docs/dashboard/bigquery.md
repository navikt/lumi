---
title: BigQuery og Metabase
---

# BigQuery og Metabase

Lumi kan legge en kopi av teamets svar i et BigQuery-datasett i teamets eget GCP-prosjekt. Et datasett i BigQuery er en mappe med tabeller. Lumi oppdaterer kopien hver natt, og derfra kan dere dele dataene på Datamarkedsplassen og bruke dem i Metabase og datafortellinger.

::: info Pilot
I produksjon blir eksporten først åpnet for team eSyfo og iSyfo. Skriv i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD) hvis teamet vil være med.
:::

## Før dere begynner

- SQL-en fra dashboardet må kjøres av noen som kan lage datasett og gi tilgang til dem i teamets GCP-prosjekt for produksjon.
- Oppdater teamets kopi av [etterlevelsesmalen E726](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) og behandlingen i Behandlingskatalogen. Skriv at svarene lagres i BigQuery og deles på Datamarkedsplassen, og hva de skal brukes til. Se [spillereglene hos NADA](https://docs.knada.io/juridisk/spilleregler/).
- Vurder på nytt om dere trenger en personvernkonsekvensvurdering (PVK). Er dere i tvil, avklar med personvernombudet.
- Bestem om fritekst skal være med. Les [Fritekst](#fritekst-valg) først.

## Fritekst {#fritekst-valg}

Fritekst er bare tilgjengelig for team som Lumi har åpnet det for, og i produksjon har ingen team det ennå. Teamet må ha en PVK som dekker fritekst i BigQuery. Vil dere ha fritekst med, ta kontakt i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD). Før Lumi har åpnet for teamet, vises ikke valget **Ta med fritekstsvar**.

Brukerne kan skrive navn og helseopplysninger i fritekst. Lumi maskerer kjente mønstre som fødselsnummer, e-post og telefonnummer, men ikke navn, se [PII-maskering](/referanse/sikkerhet#pii-maskering). Tekstene havner i en egen tabell, `fritekst`. Ikke del den utenfor teamet. Datamarkedsplassen lar dere velge at et datasett inneholder personopplysninger, men har ikke noe eget valg for særlige kategorier som helseopplysninger.

Slår dere av fritekst under **Innstillinger**, sletter Lumi tabellen `fritekst`.

## Slik setter dere opp eksporten

Oppsettet står under **Sett opp eksporten** på siden **BigQuery-eksport** og har trinnene **Opprett datasettet**, **Sjekk tilkoblingen** og **Velg innhold og start**.

1. Velg **Eksporter** i menyen og deretter **Gå til BigQuery-eksport**.
2. Kontroller **GCP-prosjekt** og **Datasett**. Lumi fyller inn teamets prosjekt fra Nais, og datasettet heter `lumi` hvis dere ikke endrer det.
3. Velg **Kopier SQL** og deretter **Åpne BigQuery**. Lim inn SQL-en i en ny spørring og velg **Run**.
4. Velg **Sjekk tilkoblingen**. Står det **Datasettet er klart. Lumi kan lage tabeller i det.**, kan dere gå videre.
5. Kryss av for **Ta med fritekstsvar** hvis fritekst skal være med og er åpnet for teamet, og velg **Start eksporten**.

Første kjøring starter med en gang. Se [Når Lumi oppdaterer tabellene](#oppdatering) for kjøringene etterpå.

### Hva SQL-en gjør {#sql}

Dashboardet fyller inn teamets prosjekt, datasettet, teamnavnet og Lumis tjenestekonto der det står `PROSJEKT`, `lumi`, `TEAM` og `LUMIS-TJENESTEKONTO`:

```sql
SET @@location = 'europe-north1';

CREATE SCHEMA IF NOT EXISTS `PROSJEKT.lumi`
  OPTIONS (location = 'europe-north1');

ALTER SCHEMA `PROSJEKT.lumi`
  SET OPTIONS (
    labels = [('lumi-team', 'TEAM')],
    max_time_travel_hours = 48,
    description = 'Svar fra Lumi. Lumi oppdaterer tabellene hver natt.'
  );

GRANT `roles/bigquery.dataEditor`
  ON SCHEMA `PROSJEKT.lumi`
  TO "serviceAccount:LUMIS-TJENESTEKONTO";
```

- `SET @@location` kjører SQL-en i `europe-north1`. Lumi skriver bare til datasett i den regionen.
- `CREATE SCHEMA IF NOT EXISTS` lager datasettet hvis det ikke finnes fra før.
- `ALTER SCHEMA` setter labelen `lumi-team` til teamnavnet, time travel til 48 timer og en beskrivelse av datasettet. Time travel er hvor lenge BigQuery tar vare på rader som er slettet eller erstattet. Lumi skriver ikke til et datasett der labelen mangler eller viser et annet team, eller der time travel er mer enn 48 timer.
- `GRANT` gir Lumis tjenestekonto rollen BigQuery Data Editor på datasettet. Lumi får ingen tilgang til resten av prosjektet, og rollen gir ikke Lumi rett til å gi andre tilgang.

Dere kan kjøre SQL-en på nytt. Da retter den tilgangen, labelen og time travel hvis noen har endret dem. Når eksporten er startet, finner dere SQL-en under **Innstillinger** og **Vis SQL-en**.

Bruk datasettet bare til Lumi. Rollen gjelder hele datasettet, så Lumis tjenestekonto kan lese og endre alle tabellene i det. Lumi godtar derfor ikke et datasett med tabeller som Lumi ikke har laget. Views går fint.

## Når Lumi oppdaterer tabellene {#oppdatering}

Lumi erstatter innholdet i tabellene med svarene fra de siste tolv månedene

- hver natt etter kl. 01
- når dere velger **Oppdater tabellene nå**
- når noen sletter svar i dashboardet
- når dere lagrer endringer under **Innstillinger**

Lumi kjører høyst én gang per fem minutter for hvert team, også når dere bytter datasett eller stopper eksporten og setter den opp igjen. Feiler en kjøring, prøver Lumi igjen etter én time, og ventetiden dobles for hver ny feil, opp til ett døgn.

Tabellene oppdateres én om gangen, den mest følsomme først: `fritekst`, `innsendinger` og `svar`. Feiler en kjøring underveis, kan tabellene komme fra ulike kjøringer. Kolonnen `oppdatert_tidspunkt` viser når Lumi skrev tabellen. Sjekk den før dere bruker tallene, se [Sjekk at tabellene er oppdatert](#ferskhet).

Er det ingen svar til en tabell, tømmer Lumi den. Tabellen og tilgangene på den blir stående. Lumi sletter ikke `svar` og `innsendinger` ved vanlige kjøringer. `fritekst` slettes når fritekst er slått av eller ikke er åpnet for teamet. Får ikke Lumi slettet `fritekst`, feiler kjøringen, og Lumi prøver igjen.

Velg **Åpne datasettet i BigQuery** for å se tabellene i Google Cloud-konsollen.

## Teamets ansvar {#ansvar}

Nav er behandlingsansvarlig. På vegne av Nav har dere ansvaret for kopien i teamets prosjekt: hvem som får tilgang på Datamarkedsplassen, hva dataene brukes til, og at behandlingen i Behandlingskatalogen dekker delingen. Lumi oppdaterer kopien etter beste evne. Team eSyfo drifter Lumi uten avtalt tjenestenivå (SLA).

- Sletter dere et svar i dashboardet, starter Lumi en ny kjøring. Svaret forsvinner fra BigQuery etter noen minutter når kjøringen lykkes. Feiler den, forsvinner svaret når Lumi har prøvd igjen og lykkes, se [Når Lumi oppdaterer tabellene](#oppdatering).
- Svar som blir eldre enn tolv måneder, forsvinner ved neste vellykkede kjøring.
- BigQuery tar vare på slettede rader i 48 timer (time travel). Google tar vare på dem i sju dager til (fail-safe), uten at dere kan lese dem.
- Lumi oppdaterer ikke kopier dere lager selv, for eksempel lagrede resultater i Metabase, tabeller i notebooks og statiske datafortellinger. Sletter dere et svar, må dere slette det der også og si fra til dem dere har delt dataene med.
- Hver tabell forsvinner sju dager etter at Lumi sist skrev den, for eksempel hvis dere fjerner Lumis tilgang eller kjøringene feiler.

`svar` og `innsendinger` har ingen kolonner for navn eller fødselsnummer, men `fritekst` kan inneholde det. Når få har svart, kan tidspunkt, app, enhetstype og svar likevel avsløre hvem som svarte. Registrer derfor tabellene som personopplysninger. Ikke koble tabellene med andre data om brukerne, for eksempel på tidspunkt, uten at PVK-en dekker det.

`innsending_id` er pseudonymisert, ikke anonymisert. Team eSyfo, som drifter Lumi, har nøkkelen og kan i prinsippet koble ID-en tilbake til svaret i Lumi.

## Del dataene på Datamarkedsplassen {#datamarkedsplassen}

Datamarkedsplassen kaller hver tabell eller view et datasett. Del views som er filtrert på app og survey. Lumis tabeller har svar fra alle teamets apper og surveyer, så de bør ikke deles direkte.

1. Lag et view i datasettet for det dere vil dele. Dette viewet har bare svarene fra appen `bro-frontend`:

   ```sql
   CREATE OR REPLACE VIEW `PROSJEKT.lumi.svar_bro_frontend` AS
   SELECT *
   FROM `PROSJEKT.lumi.svar`
   WHERE app = 'bro-frontend'
   ```

   Legg til `AND survey_id = 'SURVEY'` for å dele bare én survey. Skal `innsendinger` også deles, lager dere et view av den på samme måte.
2. Gå til [Datamarkedsplassen](https://data.ansatt.nav.no/dataproduct/new) og legg til et nytt dataprodukt. Velg teamets gruppe og skriv hva dataene kan brukes til. Skriv også dette i beskrivelsen: «Lumi vet ikke hvem som svarte, så svarene er ikke filtrert for kode 6 og 7.»
3. Legg til viewene som datasett i dataproduktet, og velg at de inneholder personopplysninger. Datamarkedsplassen autoriserer automatisk et view som bygger på tabeller i samme datasett.
4. Gi tilgang til dem som skal bruke dataene, eller la dem søke om tilgang. Tilgang kan gis til en bruker, en gruppe eller en service account. De som søker, må ha en behandling i Behandlingskatalogen.

Skal et annet team lese dataene fra Airflow eller Knada, gir dere tilgang til tjenestekontoen til det andre teamet. Det andre teamet kjører spørringen i sitt eget prosjekt.

Den som skal bruke dataene i Metabase, må få tilgang hver for seg. Tilgang gitt til en gruppe følger ikke med til Metabase. Se [Metabase hos NADA](https://docs.knada.io/analyse/metabase/) og [tilgangsstyring hos NADA](https://docs.knada.io/dataprodukter/tilgangsstyring/).

::: warning Tilgangene forsvinner med tabellen
Tilganger gitt på Datamarkedsplassen ligger på tabellen eller viewet. Når en tabell slettes eller utløper, forsvinner tilgangene til den. Det gjelder også når dere velger **Stopp eksporten** eller bytter datasett. Et view virker videre når Lumi tømmer tabellene, men ikke når tabellene er slettet. Mangler en tabell eller et view i sju dager, fjerner Datamarkedsplassen datasettet fra dataproduktet og databasen fra Metabase.
:::

## Lag grafer og dashboard i Metabase {#metabase}

Velg **Legg til i Metabase** på datasettet på Datamarkedsplassen. Metabase lager en samling med samme tilgang som datasettet. Lagre Metabase-spørsmål og -dashboard i den samlingen, ikke i en åpen samling.

Metabase kan ikke koble sammen tabeller som er tilgangsbegrenset. Bruk derfor `svar` til det meste. Den har spørsmålstekst og svartekst på hver rad, så dere kan lage grafer i spørringsbyggeren uten SQL. Filtrer på `app`, `survey_id` og `sporsmal_id`, og tell rader per `rating_verdi` eller `valg_tekst` for å få fordelingen. Utviklingen over tid får dere med snittet av `rating_verdi` per uke på `innsendt_dato`.

### Spørringer {#sporringer}

Spørringene fungerer i Metabase og i BigQuery. Bytt ut `PROSJEKT` med prosjektet, og `lumi` med datasettet hvis det heter noe annet. Bruker dere et view, bytter dere ut tabellnavnet med navnet på viewet.

En spørsmåls-ID er bare unik innenfor én app og én survey, og tabellene har svar fra alle teamets apper. Filtrer derfor alltid på `app`, `survey_id` og `sporsmal_id`. Denne spørringen viser ID-ene i en app:

```sql
SELECT survey_id,
       sporsmal_id,
       sporsmal_type,
       rating_variant,
       ANY_VALUE(sporsmal_tekst) AS sporsmal_tekst,
       COUNT(DISTINCT innsending_id) AS innsendinger,
       MIN(innsendt_dato) AS forste_dato,
       MAX(innsendt_dato) AS siste_dato
FROM `PROSJEKT.lumi.svar`
WHERE app = 'APP'
GROUP BY survey_id, sporsmal_id, sporsmal_type, rating_variant
ORDER BY survey_id, sporsmal_id
```

Bytt ut `APP`, `SURVEY` og `SPORSMAL` i spørringene under med verdiene dere fant.

Fordeling på et vurderingsspørsmål:

```sql
SELECT rating_verdi, COUNT(*) AS antall
FROM `PROSJEKT.lumi.svar`
WHERE app = 'APP' AND survey_id = 'SURVEY' AND sporsmal_id = 'SPORSMAL'
GROUP BY rating_verdi
ORDER BY rating_verdi
```

Snitt per uke. Uken begynner på mandag, som i dashboardet:

```sql
SELECT DATE_TRUNC(innsendt_dato, ISOWEEK) AS uke,
       ROUND(AVG(rating_verdi), 2) AS snitt,
       COUNT(*) AS antall
FROM `PROSJEKT.lumi.svar`
WHERE app = 'APP' AND survey_id = 'SURVEY' AND sporsmal_id = 'SPORSMAL'
GROUP BY uke
ORDER BY uke
```

NPS for ett spørsmål, andelen som svarte 9 eller 10 minus andelen som svarte fra 0 til 6:

```sql
SELECT ROUND(100 * SAFE_DIVIDE(
         COUNTIF(rating_verdi >= 9) - COUNTIF(rating_verdi <= 6),
         COUNT(*)
       )) AS nps,
       COUNT(*) AS antall
FROM `PROSJEKT.lumi.svar`
WHERE app = 'APP' AND survey_id = 'SURVEY' AND sporsmal_id = 'SPORSMAL'
```

Andel som valgte hvert alternativ, av dem som svarte på spørsmålet. Den som hoppet over spørsmålet eller ikke fikk se det, er ikke med. For flervalg kan summen bli over 100 prosent:

```sql
WITH sporsmal AS (
  SELECT *
  FROM `PROSJEKT.lumi.svar`
  WHERE app = 'APP' AND survey_id = 'SURVEY' AND sporsmal_id = 'SPORSMAL'
)
SELECT valg_id,
       ANY_VALUE(valg_tekst) AS valg_tekst,
       COUNT(*) AS antall,
       ROUND(100 * COUNT(*) / (SELECT COUNT(DISTINCT innsending_id) FROM sporsmal), 1) AS prosent
FROM sporsmal
GROUP BY valg_id
ORDER BY antall DESC
```

Antall innsendinger per dag i hver survey, uten arkiverte surveyer:

```sql
SELECT innsendt_dato, app, survey_id, COUNT(*) AS innsendinger
FROM `PROSJEKT.lumi.innsendinger`
WHERE NOT survey_arkivert
GROUP BY innsendt_dato, app, survey_id
ORDER BY innsendt_dato
```

Les [Dette påvirker tallene](#tolkning) før dere sammenligner med dashboardet eller med eldre spørringer.

## Lag en datafortelling {#datafortelling}

En datafortelling er et Quarto-dokument som teamet publiserer på Datamarkedsplassen med teamets token. Alle ansatte i Nav kan lese interne datafortellinger. Derfor gjelder dette:

- Regn ut tallene i SQL-en. Fortellingen skal bare hente ferdige tall.
- Vis bare grupper med minst fem svar, med `HAVING COUNT(*) >= 5`.
- Vis aldri enkeltsvar, fritekst eller `innsending_id`.
- Ikke publiser fortellingen på data.nav.no.

```python
from google.cloud import bigquery

# Prosjektet til teamet som kjører fortellingen
client = bigquery.Client(project="DERES-PROSJEKT")

uker = client.query(
    """
    SELECT DATE_TRUNC(innsendt_dato, ISOWEEK) AS uke,
           ROUND(AVG(rating_verdi), 2) AS snitt,
           COUNT(*) AS antall
    FROM `PROSJEKT.lumi.svar`
    WHERE app = 'APP' AND survey_id = 'SURVEY' AND sporsmal_id = 'SPORSMAL'
    GROUP BY uke
    HAVING COUNT(*) >= 5
    ORDER BY uke
    """
).to_dataframe()
```

Spørringen kjører i prosjektet dere oppgir i `bigquery.Client(project=...)`. Bruk teamets eget prosjekt der, også når dere leser et view som et annet team har delt. `to_dataframe()` krever at pakken `db-dtypes` er installert.

NADA beskriver hvordan dere publiserer og oppdaterer fortellingen med en Naisjob, Airflow eller Union i [Datafortellinger](https://docs.knada.io/analyse/datafortellinger/).

### Sjekk at tabellene er oppdatert {#ferskhet}

Kjør fortellingen etter at nattens kjøring er ferdig, og sjekk `oppdatert_tidspunkt`. Gjør det samme i Airflow-jobber som leser tabellene:

```sql
SELECT 'svar' AS tabell, DATETIME(MAX(oppdatert_tidspunkt), 'Europe/Oslo') AS oppdatert
FROM `PROSJEKT.lumi.svar`
UNION ALL
SELECT 'innsendinger', DATETIME(MAX(oppdatert_tidspunkt), 'Europe/Oslo')
FROM `PROSJEKT.lumi.innsendinger`
```

Tidspunktene er i norsk tid. Er de ulike, kommer tabellene fra ulike kjøringer. Er de fra før kl. 01 i natt, har nattens kjøring ikke lyktes ennå. La fortellingen eller jobben stoppe eller vise et varsel i begge tilfellene.

## Endre eller stoppe eksporten {#stopp}

Under **Innstillinger** kan dere bytte prosjekt eller datasett og slå fritekst av eller på. Når dere velger **Lagre endringer**, sjekker Lumi det nye datasettet før endringen lagres, og sletter Lumis tabeller i det gamle. Bytter dere prosjekt eller datasett, forsvinner tilgangene til de gamle tabellene, og `innsending_id` får nye verdier.

**Stopp eksporten** sletter Lumis tabeller og innstillingene. Datasettet og viewene i det blir stående. Tilgangene til Lumis tabeller forsvinner, og views, dataprodukter, Metabase-spørsmål og datafortellinger som bruker tabellene, slutter å virke. Setter dere opp eksporten igjen senere, får `innsending_id` nye verdier.

Stopper dere mens Lumi oppdaterer tabellene, venter Lumi til kjøringen er ferdig, og sletter tabellene etterpå. Siden viser **Eksporten stoppes** til det er gjort, som regel etter noen minutter. Så lenge kan dere ikke endre eller starte eksporten. Har ikke Lumi tilgang til datasettet lenger, eller får ikke slettet tabellene på to døgn, forsvinner tabellene av seg selv innen sju dager etter siste kjøring.

## Når noe feiler {#feil}

Feil ved oppsettet står under **Dette må ordnes først**, og feil i en kjøring under **Dette stoppet siste kjøring**. Lumi prøver mislykkede kjøringer igjen automatisk, men feil dere må rette selv, går ikke over før dere har rettet dem.

| Melding | Hva dere gjør |
| :--- | :--- |
| **Prosjektet er ikke teamets eget** | Bruk prosjektet siden foreslår. Det er teamets prosjekt i Nais. |
| **Lumi finner ikke datasettet** | Kjør SQL-en, og sjekk at prosjekt og datasett er skrevet likt i dashboardet og i SQL-en. |
| **Lumi har ikke tilgang til datasettet** | Kjør SQL-en på nytt. |
| **Datasettet ligger i feil region** | Lag et nytt datasett i `europe-north1` med SQL-en. |
| **Datasettet mangler label for teamet** | Kjør SQL-en på nytt. |
| **Datasettet er merket for et annet team** | Sjekk hvem datasettet er satt opp for. Er det teamets eget, kjør SQL-en på nytt. Ellers bruker dere et annet datasett. |
| **Datasettet tar vare på slettede data for lenge** | Kjør SQL-en på nytt. Den setter time travel til 48 timer. |
| **Datasettet har andre tabeller** | Bruk et eget datasett for Lumi, eller flytt tabellene Lumi ikke har laget. Views kan bli liggende. |
| **Datasettet har allerede en tabell som heter …** | Bruk et eget datasett for Lumi. Lumi overskriver ikke tabeller den ikke har laget. |
| **Lumi får ikke lage tabeller i datasettet** | Kjør SQL-en på nytt. |
| **Lumi fikk ikke sjekket prosjektet** | Prøv igjen om litt. Lumi fikk ikke slått opp prosjektet i Nais. |
| **BigQuery svarte ikke** | Prøv igjen om litt. |
| **Lumi fikk ikke kjøre eksporten** | Feilen er hos Lumi. Skjer den i en kjøring, får team eSyfo varsel. Skjer den ved oppsettet, skriv i #lumi. |
| **Lumi fikk ikke skrevet tabellene** | Dere trenger ikke gjøre noe. Feilen er hos Lumi, og team eSyfo får varsel. |
| **Lumi fikk ikke slettet tabellen fritekst** | Lumi prøver igjen, og team eSyfo får varsel. Vil dere ha tabellen bort med en gang, kan dere slette den selv i BigQuery. |
| **Noe gikk galt i Lumi** | Dere trenger ikke gjøre noe. Feilen er hos Lumi, og team eSyfo får varsel. |

Står eksporten fast, skriv i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD).

## Tabellene {#kolonner}

Lumi skriver tabellene `svar` og `innsendinger`, og `fritekst` hvis dere har slått det på. Kolonnebeskrivelsene står også i skjemaet i BigQuery og vises på Datamarkedsplassen.

Lumi kan legge til kolonner, men endrer eller fjerner dem ikke. En endring som ville ødelagt spørringer, får et nytt tabellnavn.

Kolonnene som er felles for alle tabellene:

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `innsending_id` | STRING | Pseudonym ID for innsendingen. Den er lik i alle tabellene og mellom kjøringer, men blir ny når dere bytter prosjekt eller datasett, eller stopper eksporten og setter den opp igjen. Den er en annen enn ID-en i filene fra **Eksporter**. |
| `innsendt_tidspunkt` | TIMESTAMP | Når Lumi tok imot svaret, i UTC og rundet ned til hel time. |
| `innsendt_dato` | DATE | Datoen Lumi tok imot svaret, i norsk tid. Samme dag som dashboardet bruker. |
| `app` | STRING | Appen som sendte svaret. |
| `survey_id` | STRING | Survey-ID-en. |
| `survey_type` | STRING | `rating`, `topTasks`, `taskPriority`, `discovery` eller `custom`. |
| `survey_arkivert` | BOOLEAN | Om surveyen er arkivert i dashboardet nå. Dashboardet skjuler arkiverte surveyer som standard. |
| `enhetstype` | STRING | `mobile`, `tablet` eller `desktop`. |
| `skjemaversjon` | STRING | Fingeravtrykk av strukturen i surveyen. |
| `oppdatert_tidspunkt` | TIMESTAMP | Når Lumi skrev tabellen. Alle rader i tabellen fra samme kjøring har samme tidspunkt. |

### Tabellen `svar`

Én rad per svar på vurderings- og valgspørsmål. Flervalg gir én rad per valgt alternativ.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `sporsmal_id` | STRING | Spørsmålets ID (`fieldId`). Den er bare unik innenfor én app og én survey. |
| `sporsmal_tekst` | STRING | Den nyeste teksten for spørsmålet, slik dashboardet viser den. |
| `sporsmal_type` | STRING | `RATING`, `SINGLE_CHOICE` eller `MULTI_CHOICE`. |
| `rating_verdi` | INTEGER | Svaret på et vurderingsspørsmål. NPS går fra 0 til 10, tommel er 1 (ned) eller 2 (opp), og emoji og stjerner går fra 1 til 5. |
| `rating_variant` | STRING | `emoji`, `stars`, `thumbs` eller `nps`. Kan mangle for gamle svar. |
| `rating_skala` | INTEGER | Antall trinn: 5 for emoji og stjerner, 2 for tommel og 11 for NPS. Kan mangle for gamle svar. |
| `valg_id` | STRING | ID-en til alternativet som ble valgt. |
| `valg_tekst` | STRING | Den nyeste teksten for alternativet. |

### Tabellen `innsendinger`

Én rad per innsending, det dashboardet kaller et svar. Bruk tabellen når dere teller svar eller regner ut andeler.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `antall_svar` | INTEGER | Antall besvarte spørsmål i innsendingen, også fritekst og dato. |
| `har_fritekst` | BOOLEAN | Om innsendingen har minst ett fritekstsvar. Kolonnen er med også når tabellen `fritekst` ikke er det. |
| `varighet_sekunder` | INTEGER | Sekunder fra surveyen ble vist til svaret ble sendt, rundet ned til hele sekunder. Tom når widgeten ikke sendte tiden. Widgeten sender den bare når det tok mellom ett sekund og 30 minutter. |

### Tabellen `fritekst`

Én rad per fritekstsvar. Tabellen finnes bare når fritekst er åpnet for teamet og dere har slått det på.

| Kolonne | Type | Innhold |
| :--- | :--- | :--- |
| `sporsmal_id` | STRING | Spørsmålets ID. |
| `sporsmal_tekst` | STRING | Den nyeste teksten for spørsmålet. |
| `tekst` | STRING | Fritekstsvaret, med kjente mønstre for personopplysninger maskert. |
| `maskert` | BOOLEAN | Om Lumi har maskert noe i innsendingen. |

Dette er aldri med i tabellene:

- URL og side
- nettleser (user agent)
- skjerm- og vindusstørrelse
- feilsøkingsdata (debug)
- Lumis interne ID-er
- tagger appen sender med (`tags` i konteksten)
- tagger dere har satt i dashboardet
- svar på datospørsmål

### Dette påvirker tallene {#tolkning}

- Spørsmål som ble hoppet over eller var skjult, gir ingen rad i `svar`. Andeler regnet fra `svar` gjelder dem som svarte på spørsmålet. Tabellene viser ikke hvor mange som så det.
- `antall_svar` teller alle besvarte spørsmål i innsendingen, også fritekst og dato.
- `survey_arkivert` viser om surveyen er arkivert i dag. Arkiverer dere en survey, blir verdien `true` for alle svarene på den, også de gamle.
- `sporsmal_tekst` og `valg_tekst` er den nyeste teksten. Endrer dere en tekst i surveyen, endres den på alle rader, også de gamle.
- `skjemaversjon` endres når spørsmål eller svaralternativer legges til, fjernes eller får ny type, men ikke når teksten endres. Den er tom for svar fra før Lumi begynte å lagre strukturen i surveyene.
- `innsending_id` får nye verdier når dere bytter prosjekt eller datasett, og når dere stopper eksporten og setter den opp igjen. ID-er dere har lagret andre steder, kan da ikke kobles til de nye.
- Gamle svar på vurderingsspørsmål kan mangle `rating_variant` og `rating_skala`.
- Med standardtekstene i widgeten er 1 «Veldig dårlig» og 5 «Veldig bra» på emoji-skalaen. Team kan bytte tekstene, så sjekk hva surveyen viser.
- Spørsmålstekst, svartekst og ID-ene i `survey_id`, `sporsmal_id` og `valg_id` er maskert med de samme mønstrene som fritekst. Et valgt alternativ er bare med når det står i listen over alternativer som fulgte med svaret. Mangler listen, for eksempel i svar fra eldre versjoner av widgeten, er ID-en med slik den ble sendt, maskert.
