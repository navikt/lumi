---
title: Sikkerhet & personvern
---

# Sikkerhet & personvern

Lumi håndterer sikkerhet og personvern automatisk — du trenger ikke gjøre noe spesielt i din integrasjon.

## PII-maskering {#pii-maskering}

API-et maskerer automatisk personlig identifiserbar informasjon (PII) i fritekst-svar. Maskering skjer **ved lagring**, slik at sensitive data aldri finnes i klartekst i databasen.

| Mønster | Eksempel | Erstatning |
| :--- | :--- | :--- |
| Fødselsnummer | `12345678901` | `[FØDSELSNUMMER FJERNET]` |
| Nav-ident | `A123456` | `[NAVIDENT FJERNET]` |
| E-post | `test@nav.no` | `[E-POST FJERNET]` |
| Telefonnummer | `12345678` | `[TELEFON FJERNET]` |
| Kortnummer | `1234 5678 9012 3456` | `[KORTNUMMER FJERNET]` |
| Kontonummer | `1234.56.12345` | `[KONTONUMMER FJERNET]` |
| Hemmelig adresse | «hemmelig adresse» | `[HEMMELIG ADRESSE]` |

::: info Dobbel maskering
PII-redaksjon kjøres både ved lagring og ved lesing. Selv om et mønster slipper gjennom ved lagring, fanges det ved visning.
:::

## Rate limiting

API-et håndhever rate limiting på flere nivåer for å beskytte mot misbruk:

| Kategori | Grense | Beskrivelse |
| :--- | :--- | :--- |
| Innsending | 100 req/min | Per kaller-app |
| Analyse | 300 req/min | Per bruker |
| Eksport | 30 req/min | Per bruker |
| Global | 1000 req/min | Alle kall samlet |

## Inndatavalidering

Alle submissions valideres nå strengt i API-et før lagring. Dette inkluderer lengdegrenser og formatsjekker på alle relevante felter, URL-validering med krav om `https`, validering av pathname-format, og begrensninger på størrelse/dybde i `debug`-objektet.

For integratører betyr dette at ugyldig payload avvises tidlig med tydelig valideringsfeil, i stedet for å bli lagret med uforutsigbar struktur.

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

- [Koble til backend](/kom-i-gang/koble-til-backend) — token exchange og NAIS-oppsett
- [Tilgang](/dashboard/tilgang) — hvem som har tilgang til dashboardet
