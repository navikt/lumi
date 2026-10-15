---
title: Tilgang
---

# Tilgang

Surveyverksted og Lumi-dashboardet er tilgjengelige for Nav-ansatte som er medlem av et team i Nais Console.

## Adresser

- [Prod](https://lumi-dashboard.ansatt.nav.no) krever Nav-innlogging.
- [Dev](https://lumi-dashboard.ansatt.dev.nav.no) krever Nav-innlogging.
- [Demo](https://lumi-dashboard-demo.ekstern.dev.nav.no) viser testdata og er åpen for alle. Demoen lagrer ingen endringer, så dere kan ikke lage utkast i Surveyverksted der.

## Innlogging

Dere blir logget inn automatisk med Entra ID første gang dere åpner dashboardet. Det er ingenting dere må sette opp selv.

## Teamtilgang

Dashboardet viser bare data fra team dere er medlem av. Lumi finner teamene i Nais ut fra e-postadressen dere logger inn med. Er dere medlem av flere team, bytter dere team i teamvelgeren, se [Team](/dashboard/filtrering#team).

Mangler et team, sjekk i [Nais Console](https://console.nav.cloud.nais.io) at dere er lagt til som medlem.

Det kan ta opptil ti minutter før en endring i teammedlemskapet virker i dashboardet. Det gjelder begge veier: Den som er fjernet fra et team, kan se teamets data i opptil ti minutter etterpå. Var dere ikke medlem av noe team fra før, tar det opptil fem minutter.

## Feilmeldinger

| Melding | Hva den betyr |
| :--- | :--- |
| **Du må være medlem av et team i Nais Console for å bruke Lumi** | Lumi fant ingen team for dere i Nais. Sørg for at dere er lagt til i et team i Nais Console, vent opptil fem minutter og last siden på nytt. |
| **Du har ikke tilgang til team: …** | Adressen har `team=` med et team dere ikke er medlem av, for eksempel i en lenke noen har delt. Fjern `team=` fra adressen, eller be om å bli lagt til i teamet. |
| **Kunne ikke hente teamtilgang akkurat nå** | Lumi fikk ikke hentet teamene fra Nais. Prøv igjen om litt. |
| **Kunne ikke kontrollere innloggingen akkurat nå** | Lumi fikk ikke kontrollert innloggingen, fordi Texas i Nais ikke svarte. Prøv igjen om litt. |
| **Du er ikke logget inn** | Innloggingen har gått ut. Last siden på nytt. |
