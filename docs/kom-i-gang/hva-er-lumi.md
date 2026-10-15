---
title: Hva er Lumi?
---

# Hva er Lumi?

Lumi består av fire deler: Surveyverksted, widgeten `@navikt/lumi-survey`, Lumi API og dashboardet. [Forsiden](/) viser hvordan en survey går gjennom dem, fra den lages til svarene kan leses.

## Delene i Lumi

[Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) er der teamet lager surveyen. Det ligger i Lumi-dashboardet, under **Surveyverksted** i menyen. Utkastet lagres for teamet, og forhåndsvisningen sender ikke inn svar. Når surveyen er klar, velger dere **Del med utvikler** og deler en versjon. Fra versjonen kopierer utvikleren TypeScript-koden som skal inn i appen.

`@navikt/lumi-survey` er widgeten som viser surveyen i appen. Den er laget med Aksel, Navs designsystem, og krever React 18 og Aksel 8 eller nyere. Surveyen ligger i appens kode og hentes ikke fra Surveyverksted, så brukerne ser en ny versjon først når appen er satt i produksjon med den. Widgeten sender svarene til et endepunkt i appens egen backend.

Lumi API tar imot svarene fra appens backend og lagrer dem i Lumis database på Nais. Apper for sluttbrukere på nav.no veksler token med TokenX, interne apper som Modia med Entra ID. Appen må ha tilgang til Lumi API i access policy, og den tilgangen [ber dere om i navikt/lumi](/kom-i-gang/koble-til-backend#mottakeren-inbound).

[Lumi-dashboardet](https://lumi-dashboard.ansatt.nav.no) viser svarene til teamene dere er medlem av i Nais Console. Under **Dashboard** ser dere resultatene ut fra hva dere valgte å finne ut. Under **Tilbakemeldinger** leser dere enkeltsvarene og kan slette dem, og under **Eksporter** laster dere dem ned som CSV, JSON eller Excel. [Demoen](https://lumi-dashboard-demo.ekstern.dev.nav.no) viser dashboardet med testdata og er åpen for alle.

## Hvem gjør hva

Alle som er medlem av teamet deres i Nais Console, har tilgang til Surveyverksted og dashboardet. I Surveyverksted kan designere, produktfolk og utviklere jobbe i det samme utkastet og prøve surveyen før den deles.

Det er utvikleren som [installerer widgeten](/kom-i-gang/installer-widget), [legger TypeScript-filen fra versjonen inn i appen](/kom-i-gang/konfigurer-survey) og [kobler appens backend til Lumi API](/kom-i-gang/koble-til-backend).

## Hva teamet og Team eSyfo har ansvaret for

Nav er behandlingsansvarlig, og på vegne av Nav har teamet deres ansvaret for surveyen og svarene: hva dere spør om, koden i appen og hvordan svarene brukes. Dere må opplyse brukerne om at Lumi brukes til innsiktsarbeid, og slette svar der noen har skrevet personopplysninger.

::: warning Les bruksvilkårene først
Før dere setter opp den første surveyen, må dere lese [bruksvilkårene](/referanse/bruksvilkar). Dere må blant annet lage en egen kopi av [etterlevelsesmalen (E726)](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) og fylle den ut, vurdere om dere trenger en PVK og vite hvordan Lumi håndterer personopplysninger.
:::

Lumi API maskerer kjente mønstre for personopplysninger i fritekstsvar og noen kontekstfelt, men teamet må fortsatt vurdere hvilke opplysninger surveyen samler inn. [Sikkerhet og personvern](/referanse/sikkerhet#pii-maskering) viser hva maskeringen dekker.

Svarene slettes automatisk når de er eldre enn 12 måneder, se [Lagringstid og sletting](/referanse/sikkerhet#lagringstid).

## Drift og støtte

Team eSyfo utvikler Lumi og drifter Surveyverksted, Lumi API og dashboardet. Det er også Team eSyfo som godkjenner at en app får sende svar til Lumi API. Spørsmål kan dere stille i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD).

Lumi API har én database uten høy tilgjengelighet. Er databasen nede, lagres ikke svar som sendes inn i mellomtiden, og widgeten viser brukeren meldingen «Kunne ikke sende tilbakemeldingen. Prøv igjen senere.»

## Hvor dere starter

Start med å [lage surveyen i Surveyverksted](/kom-i-gang/lag-survey). Sidene under Kom i gang står i den rekkefølgen arbeidet gjøres, og fra [Installer widgeten](/kom-i-gang/installer-widget) er det utvikleren som tar over. Utvikleren bør be om tilgang til Lumi API tidlig, fordi det er det eneste steget der dere må vente på andre, se [Koble til backend](/kom-i-gang/koble-til-backend#mottakeren-inbound).
