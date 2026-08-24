---
title: Sikkerhet & personvern
---

# Sikkerhet & personvern

Lumi har innebygde sikkerhets- og personvernmekanismer. De reduserer risiko, men erstatter ikke ansvaret for å unngå personopplysninger i surveyen og konteksten.

## PII-maskering {#pii-maskering}

API-et maskerer kjente mønstre for personlig identifiserbar informasjon (PII) i fritekstsvar og utvalgte kontekstfelt. Maskeringen er mønsterbasert og er et sikkerhetsnett, ikke en garanti for at alle personopplysninger fanges opp.

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
| `context.tags` | PII-mønstre maskeres i både nøkler og verdier | Ingen ekstra maskering | Bruk kun lavkardinalitetsverdier, aldri identifikatorer |
| `context.debug` | PII-mønstre maskeres rekursivt i nøkler og verdier | Ingen ekstra maskering | Feltet finnes ikke i dagens lesemodell |
| `context.userAgent` | HTML fjernes, men PII-mønstre maskeres ikke | Ingen ekstra maskering | Sendes automatisk av widgeten og finnes ikke i dagens lesemodell |
| Surveydefinert metadata (`surveyId`, `fieldId`, spørsmålstekst/-beskrivelse og svaralternativenes ID/tekst) | PII-mønstre maskeres ikke | PII-mønstre maskeres ikke | Verdiene valideres, men må ikke inneholde personopplysninger |
| Strukturerte svar (rating, valgte alternativ-ID-er og dato) | PII-mønstre maskeres ikke | PII-mønstre maskeres ikke | Bruk bare svarverdier som ikke identifiserer personen |

::: info Dobbel maskering
Dobbel maskering gjelder bare fritekstsvar. Kontekstfeltene som er markert i tabellen maskeres ved lagring, men får ingen ny PII-kontroll ved lesing.
:::

## Rate limiting

API-et håndhever rate limiting på flere nivåer for å beskytte mot misbruk:

| Kategori | Grense | Beskrivelse |
| :--- | :--- | :--- |
| Innsending | 100 req/min | Per kaller-app |
| Innsending (per bruker) | 15 req/min | Per hashet sluttbruker innenfor samme kaller-app |
| Analyse | 300 req/min | Per validert team, app og bruker |
| Eksport | 30 req/min | Per validert team, app og bruker |
| Avvist eksportautentisering/-autorisasjon | 30 forsøk/min | Per kilde-IP |
| Global | 1000 req/min | Alle kall samlet |

::: info Nøkling av analyse og eksport
Ktor autentiserer analyse- og eksportkall før den beregner rate limit-nøkkelen. Gyldige kall nøkles derfor med validert klientidentitet og pseudonymisert brukeridentitet. Eksportkall reserverer i tillegg en tillatelse per kilde-IP før autentisering. Tillatelsen gis først tilbake når både klient- og teamautorisasjon lykkes, mens avviste kall beholder den. Dermed kan ikke en angriper omgå eksportgrensen ved å bytte ugyldig eller uautorisert token for hvert kall. På NAIS hentes kilde-IP fra første verdi i `X-Forwarded-For`.
:::

## Inndatavalidering

Alle submissions valideres nå strengt i API-et før lagring. Dette inkluderer lengdegrenser og formatsjekker på alle relevante felter, URL-validering med krav om `https`, validering av pathname-format, og begrensninger på størrelse/dybde i `debug`-objektet.

For integratører betyr dette at ugyldig payload avvises tidlig med tydelig valideringsfeil, i stedet for å bli lagret med uforutsigbar struktur.

## Direkte databasetilgang

Teamautorisasjonen i Lumi beskytter lesing gjennom API-et. Direkte tilgang til
PostgreSQL går utenom denne kontrollen og må derfor forvaltes separat.

Migreringene oppretter i dag rollen `esyfo-analyse` med lesetilgang til alle
tabeller i `public`-skjemaet. Standardprivilegier gir også rollen lesetilgang
til nye tabeller. Dette er ikke en teamavgrenset tilgangsmodell.

::: warning Uavklart analysebruk
Rollen er ikke deklarert som en ekstra databasebruker i Lumis
NAIS-manifester, og repoet dokumenterer verken aktiv tilkobling, ansvarlig eier
eller formålet med tilgangen. Kildekoden alene kan derfor ikke fastslå om rollen
brukes i dev eller prod.
:::

Før Lumi aktiveres for flere team må faktisk bruk verifiseres i hvert miljø,
og eventuell lesetilgang på tvers av team må ha navngitt eier, dokumentert
formål og minste nødvendige privilegier. En ubrukt rolle skal fjernes gjennom
en ny migrering; en rolle som fortsatt trengs skal avgrenses etter den avtalte
analysekontrakten. Se [runbook for Nav-bred utrulling](/runbooks/nav-wide-rollout).

## Penetrasjonstest

Lumi har gjennomgått en penetrasjonstest utført av Team SåPe, Navs interne sikkerhetstest-team.

Team SåPe gjennomførte testen i februar 2026. Testingen inkluderte kildekodegjennomgang av både backend og frontend (whitebox).

::: tip Hovedresultat
Ingen sårbarheter med høy eller kritisk alvorlighetsgrad ble funnet. Fundamentale sikkerhetsmekanismer som autentisering og autorisasjon fungerer etter hensikten.
:::

Rapporten fremhever at React sin innebygde auto-escaping gir god beskyttelse mot XSS, understøttet av tiltak mot CSV-injeksjon. Totalt ble 5 funn identifisert — 2 med middels alvorlighetsgrad og 3 informasjonelle. Alle funn er utbedret per mars 2026.

Oppfølgingen omfattet blant annet strengere inndatavalidering i API-et, HTML-sanitering av kontekstfelt før lagring, samt URL-hardening i dashboardet der kun gyldige `https://*.nav.no`-lenker vises som klikkbare.

## Risiko- og sårbarhetsanalyse (ROS)

Det er gjennomført risiko- og sårbarhetsanalyse (ROS) for Lumi. Analysen holdes oppdatert ved vesentlige endringer.

[Åpne ROS-analysen](https://apps.powerapps.com/play/e/default-62366534-1ec3-4962-8869-9b5535279d0b/a/f8517640-ea01-46e2-9c09-be6b05013566?tenantId=62366534-1ec3-4962-8869-9b5535279d0b) (krever Nav-innlogging).

## Se også

- [Bruksvilkår](/referanse/bruksvilkar) — vilkår, ansvar og sjekkliste for bruk av Lumi
- [Koble til backend](/kom-i-gang/koble-til-backend) — token exchange og NAIS-oppsett
- [Tilgang](/dashboard/tilgang) — hvem som har tilgang til dashboardet
