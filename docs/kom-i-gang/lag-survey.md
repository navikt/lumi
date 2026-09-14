---
title: Lag surveyen
---

# Lag surveyen

I Surveyverksted lager teamet spørsmålene og prøver surveyen sammen. Når dere er klare, deler dere en versjon som en utvikler legger inn i appen.

## Lag et utkast i Surveyverksted

1. Åpne [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) og velg team.
2. Velg hva dere vil finne ut, og gi utkastet et navn. Se [Velg hva dere vil måle](/guider/surveytyper) hvis dere trenger hjelp til å velge.
3. Tilpass spørsmålene og eventuelle oppgavelister til tjenesten deres.
4. Bruk forhåndsvisningen mens dere jobber. Velg **Prøv i egen fane** for å gå gjennom hele surveyen slik brukeren gjør.
5. Tilpass velkomstsiden og bekreftelsen etter innsending hvis dere vil gi brukeren mer informasjon.

Dere trenger Nav-innlogging og medlemskap i teamet i NAIS Console. Se [Tilgang](/dashboard/tilgang) hvis teamet mangler.

Utkastet lagres automatisk for teamet. Dere kan fortsette å redigere det etter at dere har delt en versjon.

::: info Oppsettet følger det dere vil finne ut
Surveyverksted starter med spørsmålene som trengs for å analysere svarene på det dere vil finne ut. Dere kan tilpasse teksten og legge til spørsmål. Er ingen av oppsettene riktig, velger dere **Noe annet**.
:::

## Del en versjon

Når surveyen er klar for gjennomgang eller utvikling:

1. Velg **Del med utvikler**.
2. Velg **Del versjon 1**. Nummeret øker hver gang dere deler en ny versjon.
3. Åpne versjonssiden og del lenken med teamet.

Den delte versjonen beholder innholdet sitt når dere fortsetter å redigere utkastet.

Fra versjonssiden kan du:

- velge **Kopier TypeScript** for å hente surveyen til appen
- kopiere en lenke til en oppgave eller pull request
- se hva som er endret fra forrige versjon
- prøve surveyen i den ekte widgeten uten å sende inn data

## Ta versjonen inn i appen

Utvikleren lagrer den kopierte TypeScript-koden i appen, kobler widgeten til appens backend og ruller ut appen på vanlig måte. Det er denne utrullingen som gjør surveyen tilgjengelig for brukerne.

Surveyverksted foreslår en survey-ID. Utvikleren velger den endelige ID-en i appen. Se [Survey-identitet og endringer](/guider/survey-identitet) for hvordan dere holder resultatene sammenlignbare over tid.

## Før dere går videre

- Avklar hva dere trenger å lære, og hvordan svarene skal brukes.
- Spør bare om det dere faktisk trenger.
- Bruk ett spørsmål per side når brukeren skal svare på én ting om gangen.
- Samle spørsmål på samme side bare når de hører tett sammen.
- Fortell hva svarene brukes til. Ikke lov anonymitet uten at hele dataløpet faktisk er anonymt.

## Neste steg

[Installer widgeten](/kom-i-gang/installer-widget) og bruk versjonen dere har delt.
