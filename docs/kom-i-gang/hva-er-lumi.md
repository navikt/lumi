---
title: Hva er Lumi?
---

# Hva er Lumi?

Lumi hjelper Nav-team å forstå hvordan brukerne opplever tjenesten, hva de prøver å gjøre, og om de lykkes. Teamet lager surveyen i Surveyverksted, viser den i appen og følger svarene i Lumi-dashboardet.

## Fra spørsmål til innsikt

### 1. Lag surveyen i Surveyverksted

Start med det dere vil finne ut. I [Surveyverksted](/kom-i-gang/lag-survey) kan designere, produktfolk og utviklere tilpasse spørsmålene og prøve hele flyten sammen. Utkastet lagres for teamet, og forhåndsvisningen sender ikke inn svar.

Når surveyen er klar, velger dere **Del med utvikler** og deler en versjon. Den gir utvikleren ferdig TypeScript og en lenke til akkurat det innholdet teamet har blitt enige om.

### 2. Legg surveyen i appen

Utvikleren [installerer `@navikt/lumi-survey`](/kom-i-gang/installer-widget), legger inn dokumentet fra Surveyverksted og [kobler appens backend til Lumi](/kom-i-gang/koble-til-backend). Widgeten bruker Aksel, Navs designsystem.

Surveyen blir tilgjengelig for brukerne når teamet ruller ut appen. Senere endringer i utkastet lagres i Surveyverksted frem til teamet tar en ny versjon inn i appen.

### 3. Følg svarene i dashboardet

I [Lumi-dashboardet](/dashboard/tilgang) kan dere lese tilbakemeldinger, se resultater og filtrere på blant annet flate og periode. Teamtilgangen hentes fra NAIS. Svarene lagres i Navs infrastruktur.

Vil dere se hvordan det fungerer før dere starter? [Prøv demoen med testdata](https://lumi-dashboard-demo.ekstern.dev.nav.no).

## Hvem er Lumi for?

Lumi er laget for Nav-team som vil samle brukerinnsikt i egne flater, både på nav.no og i interne løsninger som Modia.

For å ta Lumi i bruk trenger dere:

- en React-app som kjører på NAIS
- en utvikler som kan koble appens backend til Lumi med TokenX eller Azure AD
- medlemskap i riktig NAIS-team for å bruke Surveyverksted og se svarene

Teamet eier spørsmålene, integrasjonen i appen og hvordan innsikten brukes. Team eSyfo drifter Surveyverksted, Lumi API og dashboardet.

## Før du starter

::: warning Påkrevd: Les bruksvilkårene
Før du setter opp din første survey, les [bruksvilkårene](/referanse/bruksvilkar). Du må blant annet fylle ut [etterlevelsesdokumentasjon](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) og forstå hvordan personopplysninger håndteres.
:::

Lumi maskerer kjente personopplysningsmønstre i utvalgte felt som et sikkerhetsnett. Teamet må fortsatt vurdere hvilke opplysninger surveyen samler inn. Se [Sikkerhet og personvern](/referanse/sikkerhet#pii-maskering) for hva maskeringen dekker.

## Neste steg

[Lag surveyen i Surveyverksted](/kom-i-gang/lag-survey).
