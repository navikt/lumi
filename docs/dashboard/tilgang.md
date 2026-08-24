---
title: Tilgang
---

# Tilgang

Lumi-dashboardet er tilgjengelig for Nav-ansatte som er medlem av et NAIS-team som har data i Lumi.

<div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0;">
  <a href="https://lumi-dashboard.ansatt.nav.no" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: #0067c5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">🚀 Prod</a>
  <a href="https://lumi-dashboard.ansatt.dev.nav.no" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: #f1f1f1; color: #222; border-radius: 8px; text-decoration: none; font-weight: 500;">🧪 Dev</a>
  <a href="https://lumi-dashboard-demo.ekstern.dev.nav.no" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: #f1f1f1; color: #222; border-radius: 8px; text-decoration: none; font-weight: 500;">👀 Demo</a>
</div>

Demo-miljøet er åpent for alle. Dev og prod krever Nav-innlogging.

## Innlogging

Innlogging skjer automatisk via Microsoft Entra ID (Azure AD) første gang du åpner dashboardet — du trenger ikke sette opp noe selv.

## Team-tilgang

Dashboardet viser kun data fra teamene dine. Hvilke team du tilhører hentes automatisk fra NAIS Console.

::: tip Mangler du tilgang?
Sjekk at du er lagt til som medlem i riktig NAIS-team via [NAIS Console](https://console.nav.cloud.nais.io).

Lumi cacher teamoppslag som gir minst ett team i opptil 12 timer. Nye eller fjernede teamtilganger for en bruker som allerede har tilgang til andre team, kan derfor bruke opptil 12 timer på å tre i kraft. Oppslag som ikke gir noen team, caches i 5 minutter. Fjerning fra et team kan gi fortsatt tilgang til teamets data frem til den positive cachen utløper, så lenge brukeren fortsatt kan logge inn.
:::

## Se også

- [Filtrering](/dashboard/filtrering) — hvordan bruke filtrene i dashboardet
- [Eksport](/dashboard/eksport) — eksporter data
