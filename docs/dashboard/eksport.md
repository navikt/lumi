---
title: Eksport
---

# Eksport

Du kan eksportere tilbakemeldingsdata fra dashboardet i flere formater.

## Tilgjengelige formater

| Format | Beskrivelse |
| :--- | :--- |
| **CSV** | Kommaseparert tekstfil — åpnes i Excel, Google Sheets, o.l. |
| **JSON** | Strukturert JSON — egner seg for videre prosessering |
| **Excel** | `.xlsx`-fil med formatering — direkte brukbar i Excel |

## Slik eksporterer du

1. Gå til eksport-siden i dashboardet (`/export`).
2. Velg ønsket format.
3. Aktive filtre fra dashboardet tas med — eksporten inneholder kun data som matcher gjeldende filtre.
4. Filen lastes ned til maskinen din.

::: tip Bruk filtre først
Sett opp [filtrering](/dashboard/filtrering) (team, app, tidsperiode, etc.) før du eksporterer. Da får du kun relevant data i filen.
:::

## Teknisk detalj

Eksport-endepunktet er:

```
GET /api/v1/intern/export?format=csv|json|excel
```

Alle aktive query-parametre (team, app, datoer, etc.) sendes med, slik at eksporten gjenspeiler det du ser i dashboardet. Se [API-referansen](/referanse/api-endepunkter) for full parameteroversikt.

::: warning Rate limiting
Eksport er rate-begrenset til **30 forespørsler per minutt** for å beskytte backend-ytelsen. Grensen deles på kilde-IP for dashboard-trafikken, ikke per innlogget bruker.
:::
