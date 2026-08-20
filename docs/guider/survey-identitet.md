---
title: Survey-identitet og endringer
---

# Survey-identitet og endringer

`surveyId` er en kontrakt med analysen. Behold samme ID når surveyen fortsatt
måler det samme på en sammenlignbar måte. Bruk en ny ID når du endrer
strukturen eller betydningen av svarene.

## Hva identifiserer `surveyId`?

En `surveyId` identifiserer én sammenhengende analyseserie innenfor et team.
ID-en er ikke global, men apper i samme team bør bare dele ID når de med vilje
skal dele definisjon og analyse.

Etter den første innsendingen lagrer Lumi API surveydefinisjonen. Senere
innsendinger med samme `surveyId` kontrolleres mot denne definisjonen. En
strukturelt inkompatibel innsending får HTTP 409 og lagres ikke.

Velg derfor en stabil ID per survey og bruksmønster, for eksempel
`sykepenger-kvittering`. Ikke lag en ny ID for hver utrulling.

## Kan jeg beholde samme `surveyId`?

Tabellen gjelder den nåværende widgeten, som sender hele surveydefinisjonen med
`schemaVersion: 2`.

| Endring | Samme `surveyId`? | Hva skjer? |
| :--- | :--- | :--- |
| Rette skrivefeil uten å endre betydningen | Ja | Backend godtar endringen. Historiske og nye svar er fortsatt sammenlignbare. |
| Endre hjelpetekst eller `description` | Ja | Teksten er ikke en del av den låste definisjonen. |
| Endre visuell styling eller layout | Ja | Endringen påvirker ikke den analytiske strukturen. |
| Endre spørsmålstekst eller teksten til et svaralternativ uten å endre betydningen | Ja, med varsomhet | Backend godtar endringen, men eldre svar beholder de gamle tekstene. Hold endringen liten. |
| Endre hva et spørsmål eller svaralternativ betyr | Nei | Backend kan godta en ren tekstendring, men analysen vil blande svar på to ulike spørsmål. |
| Endre `required` eller `visibleIf` | Vurder ny ID | Backend godtar endringen, men den kan endre hvem som får eller besvarer spørsmålet. Bruk ny ID hvis trendene ikke lenger er sammenlignbare. |
| Endre rekkefølgen på spørsmål | Vanligvis | Backend godtar ren omorganisering. Dashboardet utleder rekkefølgen fra innsendinger, så bruk ny ID hvis rekkefølgen er viktig for tolkningen. |
| Legge til eller fjerne et spørsmål | Nei | Hele definisjonen sendes med hver innsending. Endringen gir 409. |
| Endre spørsmål-ID | Nei | Backend ser dette som ett fjernet og ett nytt felt og svarer med 409. |
| Endre spørsmålstype | Nei | Endring av `fieldType` gir 409. |
| Endre `surveyType` | Nei | Endringen gir 409. |
| Endre ratingvariant eller skala | Nei | Endring av `ratingVariant` eller `ratingScale` gir 409. |
| Legge til, fjerne, bytte eller omorganisere option-ID-er | Nei | Listen med `optionIds`, inkludert rekkefølgen, er låst og endringen gir 409. |
| Gjenbruke en gammel ID til en ny survey | Nei | Nye svar vil enten bli avvist eller blandet med en historisk analyseserie. |

### Tekster lagres sammen med svarene

Spørsmålstekst og tekstene til svaralternativene er ikke med i den strukturelle definisjonen.
De lagres likevel i hver innsending og brukes som visningstekst i analysen.
Hvis teksten endres over tid, kan dashboardet vise en representativ eldre eller
nyere tekst for svar som aggregeres sammen.

Rett gjerne skrivefeil. Bruk ny `surveyId` når ordlyden endrer hva brukeren blir
spurt om, eller hva et svaralternativ betyr.

## Slik ruller du ut en strukturell endring

1. Lag en ny, beskrivende ID, for eksempel `sykepenger-kvittering-v2`.
2. Rull ut den nye surveyen og kontroller at innsendingene vises i dashboardet.
3. Fjern den gamle surveyen fra konsumentappen når den ikke lenger skal samle
   inn svar.
4. Arkiver den gamle surveyen i dashboardet hvis du vil skjule den fra
   standardvisningen.

Den gamle og den nye ID-en blir separate analyseserier. Lumi kobler dem ikke
automatisk sammen. Arkivering stopper heller ikke innsendinger; det gjør du ved
å fjerne eller deaktivere surveyen i konsumentappen.

## Hvis API-et svarer med 409

En 409 betyr at surveydefinisjonen ikke samsvarer med definisjonen som allerede
er registrert for teamet og `surveyId`-en. Innsendingen er avvist og ikke lagret.

Gjør ett av disse valgene:

- gå tilbake til den registrerte strukturen hvis endringen var utilsiktet
- bruk en ny `surveyId` hvis endringen var tilsiktet

Et nytt forsøk med samme inkompatible payload løser ikke konflikten. Se
[runbook for definisjonskonflikter](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/survey-definition-conflicts.md)
for operativ feilsøking.

## Tre ulike versjonsbegreper

| Begrep | Betydning |
| :--- | :--- |
| `schemaVersion` | Versjonen av transportformatet. Den sier ikke hvilken versjon av surveyen brukeren så. |
| `surveyVersion` | Et valgfritt felt i API-ets lesemodell. Dagens widget setter det ikke, og backend bruker det ikke til validering eller oppdeling av analyse. |
| `definitionHash` | Et internt fingeravtrykk av den strukturelle definisjonen. Backend bruker det til å oppdage konflikter. Det er ikke en offentlig surveyversjon. |

Du kan derfor ikke gjøre strukturelle endringer under samme `surveyId` ved å
sette `surveyVersion`. Bruk en ny `surveyId`.

::: info Eldre widget-versjoner
Backend godtar fortsatt `schemaVersion: 1` i en overgangsperiode. Slike
innsendinger kan mangle ubesvarte spørsmål i den avledede definisjonen. Ikke
bruk denne bakoverkompatibiliteten som en strategi for å endre en live survey.
:::

## Sjekkliste før utrulling

- Er `surveyId` unik for analyseserien innenfor teamet?
- Måler alle spørsmål og svaralternativer det samme som før?
- Er spørsmål-ID-er, typer, ratingoppsett og option-ID-er uendret?
- Vil gamle og nye svar fortsatt kunne tolkes samlet?
- Har du valgt en ny ID hvis svaret på ett av punktene er nei?
