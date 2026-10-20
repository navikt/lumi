---
title: Sikkerhet og personvern
---

# Sikkerhet og personvern

Lumi har blant annet maskering av personopplysninger, grenser for hvor mange kall API-et tar imot, validering av inndata og tilgang i dashboardet avgrenset til team. Det reduserer risikoen, men dere har fortsatt ansvaret for å unngå personopplysninger i surveyen og konteksten. Hva det innebærer, står i [bruksvilkårene](/referanse/bruksvilkar).

## PII-maskering {#pii-maskering}

API-et maskerer kjente mønstre for personlig identifiserbar informasjon (PII) i fritekstsvar og utvalgte kontekstfelt. Maskeringen er mønsterbasert og garanterer ikke at alle personopplysninger blir fanget opp. Navn og vanlige adresser maskeres ikke, og fødselsnummer maskeres bare når kontrollsifrene er gyldige.

| Mønster | Eksempel | Erstatning |
| :--- | :--- | :--- |
| Fødselsnummer | `01020349294` | `[FØDSELSNUMMER FJERNET]` |
| Nav-ident | `A123456` | `[NAVIDENT FJERNET]` |
| E-post | `test@nav.no` | `[E-POST FJERNET]` |
| Telefonnummer | `12345678` | `[TELEFON FJERNET]` |
| Kortnummer | `1234 5678 9012 3456` | `[KORTNUMMER FJERNET]` |
| Kontonummer | `1234.56.12345` | `[KONTONUMMER FJERNET]` |
| Hemmelig adresse | «hemmelig adresse» | `[HEMMELIG ADRESSE]` |

### Hvor og når maskering skjer {#pii-feltdekning}

| Felt | Ved lagring | Ved lesing | Merknad |
| :--- | :--- | :--- | :--- |
| Fritekstsvar (`answers[].value.text`) | PII-mønstre maskeres | PII-mønstre maskeres på nytt | Det eneste feltet med dobbel maskering |
| `context.url` | PII-mønstre maskeres i path, query-parametere og fragment | Ingen ekstra maskering | Maskeringen dekoder URL-verdier for å fange kodede mønstre |
| `context.pathname` | PII-mønstre maskeres etter URL-dekoding | Ingen ekstra maskering | Samle helst en statisk eller allerede renset path |
| `context.tags` | PII-mønstre maskeres i både nøkler og verdier | Ingen ekstra maskering | Bruk bare verdier med få varianter, aldri identifikatorer |
| `context.debug` | PII-mønstre maskeres rekursivt i nøkler og verdier | Ingen ekstra maskering | Vises ikke i dashboardet eller eksporten |
| `context.userAgent` | HTML fjernes, men PII-mønstre maskeres ikke | Ingen ekstra maskering | Sendes automatisk av widgeten og vises ikke i dashboardet eller eksporten |
| Surveydefinert metadata (`surveyId`, `fieldId`, spørsmålstekst/-beskrivelse og svaralternativenes ID/tekst) | PII-mønstre maskeres ikke | PII-mønstre maskeres ikke | Verdiene valideres, men må ikke inneholde personopplysninger. [BigQuery-eksporten](/dashboard/bigquery#tolkning) maskerer PII-mønstre i ID-ene og tekstene den tar med |
| Strukturerte svar (rating, valgte alternativ-ID-er og dato) | PII-mønstre maskeres ikke | PII-mønstre maskeres ikke | Bruk bare svarverdier som ikke identifiserer personen |

::: info Dobbel maskering
Dobbel maskering gjelder bare fritekstsvar. Kontekstfeltene som er markert i tabellen, maskeres ved lagring, men får ingen ny PII-kontroll ved lesing.
:::

## Hvem som svarte

Lumi API lagrer ikke hvem som svarte. Tokenet fra appens backend brukes til å sjekke at kallet kommer fra en app med tilgang. En hash av brukerens ID holdes bare i minnet, for å begrense hvor mange svar én bruker kan sende inn. Nav-identen i tokenet fra interne apper lagres ikke.

Hvert svar lagres med team, app, tidspunkt og konteksten widgeten sender, som enhetstype, skjermstørrelse og user agent. I små brukergrupper kan dette til sammen gjøre det mulig å kjenne igjen hvem som har svart.

## Lagringstid og sletting {#lagringstid}

- Svar slettes automatisk når de er eldre enn tolv måneder. Jobben kjører én gang i døgnet og sletter opptil 500 svar. Kommer det over tid inn flere enn 500 svar i døgnet, kan svar bli liggende lenger enn tolv måneder.
- Svar dere sletter i dashboardet, slettes fra databasen med en gang.
- Surveydefinisjonen, altså spørsmålene og svaralternativene, slettes ikke automatisk.
- Databasen sikkerhetskopieres hver natt etter Nais' standardoppsett, og sju sikkerhetskopier beholdes. Et slettet svar kan derfor finnes i sikkerhetskopiene i opptil sju døgn. I tillegg tar Nais en daglig katastrofekopi til et miljø utenfor Google Cloud.
- Har dere satt opp [BigQuery-eksport](/dashboard/bigquery), erstatter Lumi tabellene i teamets datasett hver natt. Sletter dere et svar i dashboardet, starter Lumi en ny kjøring med en gang, og svaret forsvinner fra BigQuery når kjøringen lykkes. Svar eldre enn tolv måneder forsvinner ved neste vellykkede kjøring. BigQuery tar vare på slettede rader i 48 timer, og Google i sju dager til. Tabellene forsvinner sju dager etter siste vellykkede kjøring. Kopier dere lager selv, har dere ansvaret for, se [Teamets ansvar](/dashboard/bigquery#ansvar).

## Små utvalg i dashboardet

Dashboardet viser statistikk også når utvalget har 1–4 svar. Med så få svar kan ett enkelt svar gi store utslag, så tolk små utvalg varsomt.

## Rate limiting

API-et begrenser antall kall på flere nivåer for å hindre misbruk:

| Kategori | Grense | Beskrivelse |
| :--- | :--- | :--- |
| Innsending | 100 req/min | Per kaller-app |
| Innsending (per bruker) | 15 req/min | Per hashet sluttbruker innenfor samme kaller-app |
| Analyse | 300 req/min | Per kallende klient og bruker |
| Eksport | 30 req/min | Per kallende klient og bruker |
| Endringer i BigQuery-eksport | 20 req/min | Per kallende klient og bruker, i tillegg til grensen for analyse |
| Avvist eksportautentisering/-autorisasjon | 30 forsøk/min | Per kilde-IP |
| Global | 10 000 req/min | Per kilde-IP |

I dev går innsendinger fra apper i tenanten `trygdeetaten.no` via `lumi-submission-proxy`. Da gjelder grensen for innsending for proxyen samlet, og grensen per bruker brukes ikke.

::: details Slik telles analyse- og eksportkall
Gyldige kall telles per kallende klient og per pseudonymisert bruker. Eksportkall reserverer i tillegg en plass per kilde-IP før autentiseringen. Plassen gis tilbake når kallet er godkjent, mens avviste kall beholder den. Kilde-IP er socket-adressen til den som kaller. Forwarding-headere som `X-Forwarded-For` brukes ikke.
:::

## Inndatavalidering

Alle innsendinger valideres strengt i API-et før lagring. API-et sjekker lengde og format på alle relevante felt, krever `https` i URL-er, validerer formatet på pathname og begrenser størrelsen og dybden på `debug`-objektet.

Sender appens backend ugyldig payload, blir innsendingen avvist med en tydelig valideringsfeil før noe lagres. Oppsettet av backend står i [Koble til backend](/kom-i-gang/koble-til-backend).

## Penetrasjonstest

Team SåPe, Navs interne team for sikkerhetstesting, gjorde en penetrasjonstest av Lumi i februar 2026. Det var en whitebox-test med gjennomgang av kildekoden i både backend og frontend.

::: tip Hovedresultat
Testen fant ingen sårbarheter med høy eller kritisk alvorlighetsgrad. Grunnleggende sikkerhetsmekanismer som autentisering og autorisasjon fungerer etter hensikten.
:::

Ifølge rapporten beskytter Reacts automatiske escaping mot XSS, og Lumi har i tillegg tiltak mot CSV-injeksjon. Testen ga til sammen 5 funn: 2 med middels alvorlighetsgrad og 3 informasjonelle. Alle funnene var utbedret i mars 2026.

Etter testen ble blant annet inndatavalideringen i API-et strammet inn. Kontekstfelt blir nå HTML-sanert før lagring, og dashboardet viser bare gyldige `https://*.nav.no`-lenker som klikkbare.

## Risiko- og sårbarhetsanalyse (ROS)

ROS-analysen for Lumi blir oppdatert ved vesentlige endringer.

[Åpne ROS-analysen](https://apps.powerapps.com/play/e/default-62366534-1ec3-4962-8869-9b5535279d0b/a/f8517640-ea01-46e2-9c09-be6b05013566?tenantId=62366534-1ec3-4962-8869-9b5535279d0b) (krever Nav-innlogging).
