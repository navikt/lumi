# Survey-definisjonskonflikter

Alarmen `LumiSurveyDefinitionConflict` betyr at Lumi har avvist minst én innsending
med HTTP 409 fordi den innsendte survey-definisjonen ikke er strukturelt kompatibel
med definisjonen som allerede er registrert for samme `team` og `surveyId`.
Innsendingen blir ikke lagret.

## Finn den berørte surveyen

Åpne Loki i Grafana og søk i tidsrommet alarmen gjelder:

```logql
{app="lumi-api", namespace="team-esyfo"}
| json
| event_type="survey_definition_conflict"
```

Hendelsen inneholder disse strukturerte feltene:

- `caller_team`: teamet som eier surveyen
- `caller_app`: appen som sendte inn svaret
- `survey_id`: surveyen som har inkompatible definisjoner
- `path`: submission-endepunktet
- `conflict_details`: feltene eller egenskapene som er endret

Prometheus-telleren kan brukes for å se omfanget:

```promql
sum(increase(lumi_survey_definition_conflicts_total{app="lumi-api"}[30m]))
```

## Stans nye avvisninger

Kontakt teamet og velg ett av disse tiltakene:

1. Rull tilbake den strukturelle endringen slik at appen igjen sender samme
   `fieldType`, `optionIds`, rating-konfigurasjon og feltsett som tidligere.
2. Hvis endringen er tilsiktet, gi den nye surveyen en ny `surveyId`.

Ikke endre eller slette den registrerte definisjonen i databasen. Den beskytter
historiske svar mot å bli aggregert med en inkompatibel struktur.

Bekreft etter utrulling at appen får en vellykket submission-respons og at telleren
ikke øker videre. Et tidligere avvist svar kan bare gjenopprettes ved at klienten
sender det på nytt.
