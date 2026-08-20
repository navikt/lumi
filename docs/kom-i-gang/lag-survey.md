---
title: Lag surveyen
---

# Lag surveyen

Bruk Surveyverksted til å formulere spørsmål, prøve hele flyten og opprette en versjon som utvikleren kan legge i appen. Dere kan jobbe videre med utkastet uten at noe blir synlig for brukerne.

Du kan også skrive `SurveyDocumentV1` direkte i kode. Begge veier gir det samme dokumentformatet.

## Lag et utkast i Surveyverksted

1. Åpne [Surveyverksted i produksjon](https://lumi-dashboard.ansatt.nav.no/surveyverksted).
2. Velg team og gi utkastet et navn.
3. Legg til sider og spørsmål.
4. Bruk forhåndsvisningen mens du jobber. Velg **Prøv i egen fane** for å gå gjennom surveyen slik brukeren gjør.
5. Legg til en velkomstside eller tilpass bekreftelsen etter innsending når det gir brukeren nødvendig informasjon.

Utkast lagres automatisk for teamet. Det er fortsatt et arbeidsdokument og påvirker ingen survey som allerede er i produksjon.

::: info Sjekk analysetypen før utrulling
Nye utkast starter som `type: "rating"`. Surveyverksted har foreløpig ikke et eget valg for analysetype. Hvis dere erstatter vurderingsspørsmålet med andre spørsmål, skal utvikleren kontrollere det eksporterte dokumentet og vanligvis endre `type` til `"custom"` før utrulling. Se [Velg hva dere vil måle](/guider/surveytyper).
:::

## Del en versjon

Velg **Del en ny versjon** når surveyen er klar for utvikling eller gjennomgang. Versjonen endrer seg ikke når noen fortsetter å redigere utkastet.

Fra versjonssiden kan du:

- kopiere ferdig TypeScript
- kopiere en lenke til en oppgave eller pull request
- se hva som er endret fra forrige versjon
- prøve surveyen i den ekte widgeten uten å sende inn data

::: warning Surveyverksted publiserer ikke
En versjon i Surveyverksted er ikke en produksjonssetting. En utvikler må legge det eksporterte dokumentet i appen og rulle ut appen på vanlig måte.
:::

## Jobb direkte i kode

Hvis dere ikke trenger et delt utkast, kan du opprette et `SurveyDocumentV1` direkte i kodebasen. Bruk samme modell som Surveyverksted:

```text
survey
├── valgfri velkomstside
├── én eller flere sider
│   └── ett eller flere spørsmål
└── valgfritt eget innhold i bekreftelsen etter innsending
```

Neste guide viser et komplett TypeScript-eksempel.

## Før dere går videre

- Avklar hva dere trenger å lære, og hvordan svarene skal brukes.
- Spør bare om det dere faktisk trenger.
- Bruk ett spørsmål per side når brukeren skal svare på én ting om gangen.
- Samle spørsmål på samme side bare når de hører tett sammen.
- Fortell hva svarene brukes til. Ikke lov anonymitet uten at hele dataløpet faktisk er anonymt.

## Neste steg

[Installer widgeten](/kom-i-gang/installer-widget), og legg deretter survey-dokumentet i appen.
