---
title: Filtrering
---

# Filtrering

Filterlinjen øverst på **Dashboard**, **Tilbakemeldinger** og **Eksporter** har team, app, survey og periode. Filtrene følger med når dere bytter mellom disse sidene i menyen. Til **Surveyverksted** følger bare teamet med. Søk, **Vis kun** og **Tags** finnes bare på **Tilbakemeldinger** og **Eksporter**, og de fjernes når dere går til **Dashboard**.

## Hvor filtrene ligger {#hvor}

På **Tilbakemeldinger** og **Eksporter** ligger de fleste filtrene i menyen **Filter**. **Dashboard** har ikke den menyen. Der filtrerer dere ved å klikke i kortene.

| Filter | På **Dashboard** | På **Tilbakemeldinger** og **Eksporter** |
| :--- | :--- | :--- |
| Team, app, survey og periode | Filterlinjen | Filterlinjen |
| Enhet | Klikk på en enhet i kortet **Enheter** | **Enhet** i **Filter** |
| Segmentering | Klikk på en verdi i kortet **Segmentering** | **Segmentering** i **Filter** |
| Svar på et spørsmål | Klikk på et svaralternativ under **Statistikk per felt** | **Svar-filtre** i **Filter** |
| Oppgave i Top Tasks | Klikk på et punkt i **Oppgavekvadrant** | Følger med fra **Dashboard** |
| Søk, **Vis kun** og **Tags** | Finnes ikke | Filterlinjen og **Filter** |

På **Dashboard** og **Tilbakemeldinger** står de aktive filtrene som merkelapper over resultatene, for eksempel **Enhet: Mobil**. Krysset på merkelappen fjerner filteret. På **Eksporter** står de i kortet **Aktive filtre**.

**Nullstill** i filterlinjen fjerner alle filtrene og setter perioden tilbake til de siste 30 dagene. Teamet beholdes.

## Team {#team}

Teamvelgeren vises når dere er medlem av mer enn ett team. Standardteamet er det første av teamene deres i alfabetisk rekkefølge. Lumi henter teamene fra Nais, se [Tilgang](/dashboard/tilgang).

Bytter dere team, fjernes valgt app, survey og de andre filtrene. En periode dere har valgt selv, beholdes. Teamet står i adressen til siden som `team=`, også når det er standardteamet, se [Dele en filtrert visning](#dele).

Teamet følger med når dere går mellom dashboardet og **Surveyverksted**, og når dere klikker på logoen. Logoen åpner **Dashboard** med standardperioden og uten de andre filtrene.

## App og survey {#app-og-survey}

Velg app i listen som står på **Alle apper**, og survey i listen som står på **Alle surveys**. Surveylisten viser survey-ID-ene. Når en app er valgt, viser surveylisten bare surveyene i den appen. Bytter dere til en app der den valgte surveyen ikke finnes, fjernes surveyvalget.

Hva **Dashboard** viser når én survey er valgt, står i [Les resultatene](/dashboard/visninger#en-survey). Bryteren **Arkiverte** bestemmer om arkiverte surveyer er med, se [Arkiverte surveyer](/dashboard/visninger#arkiverte).

## Periode {#periode}

Knappen med perioden åpner **Hurtigvalg** og **Egendefinert periode**. Under **Egendefinert periode** fyller dere inn **Fra** og **Til** og velger **Velg periode**. Begge datoene er med i perioden, og dagene regnes i norsk tid.

Hurtigvalgene tar med dagen i dag:

- **Hittil i dag**
- **Siste 7 dager**
- **Siste 30 dager**
- **Siste 3 måneder**, de siste 90 dagene
- **Hittil i år**
- **Fra første svar**

**Fra første svar** begynner ved det første lagrede svaret for teamet, appen eller surveyen dere har valgt, og slutter i dag. Knappen viser datoen, for eksempel **Fra første svar (29.12.2025)**, unntatt i filterlinjen på små skjermer. Kortet **Periode** teller dagene derfra. Bytter dere survey eller app, begynner perioden ved det første svaret der. Står siden åpen over midnatt, slutter perioden på den nye dagen. Hvor lenge svarene lagres, står i [Lagringstid og sletting](/referanse/sikkerhet#lagringstid). Under **Egendefinert periode** står det første svaret i **Fra**, så dere kan velge en egen **Til** og få faste datoer.

Når én survey av typen **Vurdering** eller **Custom** er valgt, ligger perioden under **Periode** ved siden av **Sammenlign med forrige periode**. Da gjelder hurtigvalgene hele dager til og med i går: **I dag**, **7 hele dager**, **30 hele dager**, **90 hele dager**, **Hittil i år** og **Fra første svar**. Bare **I dag** og **Fra første svar** tar med dagen i dag. Sammenligningen står i [Sammenligne to perioder](/dashboard/visninger#sammenlign).

### Standardperioden {#standardperiode}

Uten en valgt periode viser dashboardet de siste 30 dagene til og med i dag. Med én survey valgt slutter perioden den dagen surveyen fikk sitt siste svar. Den går opptil 30 dager bakover, men ikke lenger tilbake enn til det første svaret.

En periode dere har valgt selv, beholdes når dere bytter survey. Ligger perioden helt utenfor datoene surveyen har svar fra, viser dashboardet hvilke datoer surveyen har svar fra, og knappen **Vis hele svarperioden**.

## Søk og Vis kun {#sok}

På **Tilbakemeldinger** og **Eksporter** har filterlinjen søkefeltet **Søk i tekst...**. Søket leter i hele det lagrede svaret, også i spørsmålsteksten og i teknisk kontekst som adressen til siden, og i tagsene. Søker dere etter et ord som står i et spørsmål, kan dere derfor få treff på alle svarene på surveyen. Søket skiller ikke mellom store og små bokstaver.

Fritekst som så ut som personopplysninger, er maskert før svaret ble lagret, så søket treffer den maskerte teksten. Hva som maskeres, står under [PII-maskering](/referanse/sikkerhet#pii-maskering).

Under **Vis kun** i **Filter** finnes to valg:

| Valg | Viser |
| :--- | :--- |
| **Med tekstsvar** | Svar der brukeren har skrevet noe i et fritekstfelt |
| **Lav score** | Svar med lav score på det første vurderingsspørsmålet: 1–2 for emoji og stjerner, 0–2 for NPS og tommel ned for tommel |

Søkefeltet og **Med tekstsvar** vises ikke når den valgte surveyen er **Top Tasks** eller **Task Priority**. For å lese fritekstsvarene om hindringer i Top Tasks klikker dere på et uttrykk under **Det som hindrer brukerne** på **Dashboard**, eller på lenken **Se alle tilbakemeldinger** nederst i kortet. Begge åpner **Tilbakemeldinger** med fritekstsvarene. Lenkene setter på filteret **Med tekstsvar**, og over resultatene står merkelappen **Vis kun: Med tekstsvar**. Krysset på merkelappen fjerner filteret, og valgt survey, app og periode blir stående.

**Lav score** er for oversikten over flere surveyer. Når dere har valgt én survey med et vurderingsspørsmål, filtrerer dere i stedet på vurderingen under **Svar-filtre**. For **Top Tasks**, **Discovery** og **Task Priority** vises filteret ikke. Er filteret på, står merkelappen **Vis kun: Lav score** over resultatene, også når valget ikke vises i **Filter**. Krysset på merkelappen fjerner filteret.

## Tags {#tags}

**Tags** i **Filter** viser tagsene teamet har lagt på svarene. Velger dere flere, vises bare svarene som har alle tagsene dere har valgt. Tags legger dere til når dere leser enkeltsvar, se [Les og slett enkeltsvar](/dashboard/visninger#tilbakemeldinger).

## Enhet {#enhet}

Enhetsfilteret har valgene **Mobil**, **Nettbrett** og **Desktop**. På **Dashboard** klikker dere på en enhet i kortet **Enheter**. På **Tilbakemeldinger** og **Eksporter** velger dere under **Enhet** i **Filter**, der **Alle enheter** fjerner filteret.

## Segmentering {#segmentering}

Segmenteringstags fra appen kan dere filtrere på når én survey er valgt. På **Dashboard** klikker dere på en verdi i kortet **Segmentering**. I **Filter** har **Segmentering** én liste per tag, der **Alle** fjerner filteret. Hvordan appen sender tags, står i [Context og tags](/guider/context-og-tags).

## Svar på et spørsmål {#svar}

Når én survey er valgt, kan dere filtrere på svaret på et vurderings- eller valgspørsmål. På **Dashboard** klikker dere på et svaralternativ under **Statistikk per felt**. Det finnes bare for **Vurdering** og **Custom**. I **Filter** ligger de samme valgene under **Svar-filtre**.

Dere kan velge ett alternativ per spørsmål. Filtrerer dere på flere spørsmål, vises bare svarene som passer med alle.

## Oppgave i Top Tasks {#oppgave}

Klikk på et punkt i **Oppgavekvadrant** for å filtrere på én oppgave. Filteret gjelder hele **Dashboard** og følger med til **Tilbakemeldinger** og **Eksporter**.

Adressen lagrer oppgavens ID (`taskId`). ID-en endres ikke når teamet skriver om oppgaveteksten, så filteret og lenker med filteret virker fortsatt. Merkelappen over resultatene, **Aktive filtre fra grafene** i **Filter** og **Aktive filtre** på **Eksporter** viser oppgaveteksten. Mens dataene lastes, står det «…». Kan ikke dashboardet hente dataene, har oppgaven ingen svar i perioden, eller er ingen Top Tasks-survey valgt, står ID-en. Bytter dere survey, fjernes oppgavefilteret.

## Sider på Tilbakemeldinger {#sider}

**Tilbakemeldinger** viser 20 svar per side, og sidevelgeren ligger under listen. Grensesnittet har ingen innstilling for antall svar per side.

## Dele en filtrert visning {#dele}

Filtrene lagres i adressen til siden. Kopier adressen for å dele visningen eller lagre den som bokmerke.

Når dere endrer et filter, erstatter dashboardet adressen i nettleserhistorikken. Tilbakeknappen i nettleseren går derfor til siden dere var på før.

Slik lager dere en lenke som viser det samme for mottakeren:

1. Velg team i teamvelgeren hvis dere er med i flere team. Adressen har alltid `team=`, så mottakeren åpner det samme teamet. Mottakeren må være medlem av teamet, se [Tilgang](/dashboard/tilgang#feilmeldinger).
2. Sett de andre filtrene. Gjør det etter teamvalget, fordi teambytte fjerner dem.
3. Velg periode, for eksempel med et hurtigvalg. Har dere ikke valgt periode selv, regner dashboardet ut standardperioden på nytt når mottakeren åpner lenken. **Fra første svar** slutter den dagen mottakeren åpner lenken. De andre hurtigvalgene gir faste datoer. Svar slettes etter tolv måneder, så en lenke til en gammel periode kan vise færre svar senere.
4. Kopier adressen.

::: details Parametere i adressen
`team` er teamnavnet slik det står i Nais Console. Mangler det, legger dashboardet til standardteamet deres.

`size` bestemmer hvor mange svar **Tilbakemeldinger** viser per side, fra 1 til 200. `page` er sidenummeret og starter på 1.
:::
