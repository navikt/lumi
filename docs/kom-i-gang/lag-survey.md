---
title: Lag surveyen
---

# Lag surveyen

Surveyen lages som et utkast i Surveyverksted. Når den er klar, deler dere en versjon av utkastet, og det er versjonen utvikleren legger inn i appen.

Dere trenger Nav-innlogging og medlemskap i teamet i Nais Console. Se [Tilgang](/dashboard/tilgang) hvis dere ikke finner teamet.

## Lag et utkast i Surveyverksted

1. Åpne [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) og velg teamet under **Team**.
2. Velg et oppsett under **Hva vil dere finne ut?**. Oppsettet bestemmer hvilke spørsmål surveyen starter med og hva dashboardet viser. Se [Velg hva dere vil måle](/guider/surveytyper) hvis dere trenger hjelp til å velge.
3. Skriv et navn under **Navn på utkastet**. Surveyverksted fyller ut **Foreslått survey-ID** fra navnet, og dere kan endre den. Velg **Opprett utkast**.
4. Tilpass spørsmålene og eventuelle oppgavelister til tjenesten deres.
5. Bruk forhåndsvisningen mens dere jobber. **Prøv hele undersøkelsen** lar dere gå gjennom surveyen i redigeringen, og **Prøv i egen fane** åpner den i en egen fane slik brukeren ser den.
6. Velg **Velkomstside** eller **Takkeside** i lista over spørsmålene hvis dere vil gi brukeren mer informasjon før eller etter spørsmålene.

![Et utkast i Surveyverksted. Til venstre står spørsmålene fordelt på sider, med betingelsene for når hvert spørsmål vises. Til høyre redigeres det valgte spørsmålet. Øverst er knappene Prøv i egen fane og Del med utvikler.](/bilder/surveyverksted.webp){.skjermbilde}

Et utkast for «Lyktes brukeren med en kjent oppgave?» i Surveyverksted.
{.bildetekst}

Utkastet lagres automatisk for teamet.

Survey-ID-en holder svarene sammen i dashboardet: alle svar med samme survey-ID regnes som den samme surveyen, se [Survey-identitet og endringer](/guider/survey-identitet). Utvikleren bestemmer den endelige ID-en i koden. Forslaget kan dere endre under **Innstillinger for utkastet**, tannhjulet øverst i utkastet.

## Hvor og når brukeren ser surveyen

Som standard ligger widgeten nederst til høyre i nettleservinduet og er åpen når siden lastes. Lukker brukeren den med krysset, blir den liggende som knappen **Gi tilbakemelding**, og etter innsending forsvinner den helt når brukeren lukker den. Om og hvor lenge widgeten husker at brukeren har lukket den, står i [Lagring](/guider/lagring).

## Sjekk surveyen før dere deler

- Fjern spørsmål dere ikke vet hva dere skal bruke svaret til.
- La hvert spørsmål stå på sin egen side, med mindre brukeren må se to spørsmål sammen for å svare. Se [Sider og flyt](/guider/sider-og-flyt).
- Gå gjennom surveyen med **Prøv i egen fane**, og gi de svarene som skal vise hvert oppfølgingsspørsmål.
- Fortell brukeren hva svarene brukes til, for eksempel på velkomstsiden. Ikke lov brukerne at de er anonyme.

## Del en versjon

Når surveyen er klar for gjennomgang eller utvikling:

1. Velg **Del med utvikler**.
2. Velg **Del versjon 1**. Nummeret øker hver gang dere deler en ny versjon.
3. Åpne versjonssiden og del lenken med teamet.

Den delte versjonen beholder innholdet sitt når dere fortsetter å redigere utkastet.

Fra versjonssiden kan dere:

- velge **Kopier TypeScript** for å hente surveyen til appen
- velge **Kopier lenke og sammendrag** for å lime inn lenken i en oppgave eller pull request
- se under **Hva er endret?** hva som er endret fra forrige delte versjon
- prøve surveyen i den ekte widgeten uten å sende inn data

### Endringer som krever ny survey-ID

Når appen allerede samler inn svar med surveyen, krever noen endringer en ny survey-ID når den nye versjonen tas i bruk. Det gjelder blant annet når dere legger til eller fjerner spørsmål, og når dere legger til, fjerner eller flytter svaralternativer. Bruker appen den gamle survey-ID-en med en slik endring, avviser Lumi svarene og lagrer dem ikke.

Surveyverksted varsler ikke om dette når dere deler en ny versjon, så teamet må selv sjekke. **Hva er endret?** på versjonssiden sammenligner med forrige delte versjon, og det er ikke nødvendigvis den som er i bruk i appen. Hvilke endringer dere kan gjøre under samme survey-ID, står i [Survey-identitet og endringer](/guider/survey-identitet).

## Ta versjonen inn i appen

Utvikleren lagrer den kopierte TypeScript-koden i appen, kobler widgeten til appens backend og setter appen i produksjon på vanlig måte. Brukerne ser surveyen først når appen er satt i produksjon.

Når versjonen er delt, kan utvikleren [installere widgeten](/kom-i-gang/installer-widget).
