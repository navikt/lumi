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

## Se også

- [Koble til backend](/kom-i-gang/koble-til-backend) — token exchange og NAIS-oppsett
- [Tilgang](/dashboard/tilgang) — hvem som har tilgang til dashboardet
