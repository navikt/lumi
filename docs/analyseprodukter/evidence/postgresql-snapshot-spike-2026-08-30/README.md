# Evidens for forkastet PostgreSQL-spike

Denne katalogen bevarer den eksakte, siste harness-koden og det saniterte
konsollsammendraget fra PostgreSQL-spiken 30. august 2026. Den inneholder bare
syntetiske data og ingen eksterne credentials, secrets, endepunkter eller
produksjonsdata. Harnessets `prototype`/`prototype` er kun disponible
Testcontainers-credentials.

## Status

Queryformen i `PostgresSnapshotSpike.kt` er **forkastet**. CTE-ene
`eligible_submission` og `feedback_answer` materialiserer intern feedback-ID
og bruker den som join-nøkkel. Det bryter identitetsinvarianten selv om ID-en
ikke finnes i sluttresultatet.

`PASS` i `recorded-verification.txt` betyr bare at harnessets daværende
kardinalitets-, samtidighets- og planasserts passerte. Det betyr ikke at
queryen er kontraktsriktig eller godkjent for dev, produksjon eller transport.

## Innhold og integritet

- `PostgresSnapshotSpike.kt`: eksakt siste fixture-, query-, concurrency- og
  planparserkode; SHA-256
  `7aa860cdeae282017ef1ff8c15710c7ca4d16489dcd8afbb338c0f74dc3ace06`
- `PostgresSnapshotSpikeCli.kt`: eksakt siste kjøre- og rapporteringskode;
  SHA-256
  `6893a11e1d6097fbae5ea9428aaab8ea829784b65dce8c11968958c54327bca6`
- `recorded-verification.txt`: sanitert output fra den siste samlede
  verifikasjonskjøringen

Den fulle `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON, TIMING OFF)`-JSON-en
ble tolket i minnet, men ikke skrevet til fil. Dermed kan de opprinnelige
planene ikke etterprøves byte-for-byte. Denne mangelen er en del av grunnen til
at databaseporten står åpen. En ny querykandidat må lagre rå plan-JSON før den
kan vurderes som evidens.

## Opprinnelig miljø og kjøring

- PostgreSQL 17.11 i `postgres:17-alpine`
- Testcontainers 1.21.4 og PostgreSQL-driver 42.7.13
- Flyway 13.3.0; alle V1–V26-migreringer og repeatable grant-migreringen
- Kotlin 2.3.0, Java 21, Gradle 9.7.0
- Docker 29.1.3 på Alpine 3.23 med 5 921 MB rapportert minne
- JVM `maxHeapSize = "1g"`
- opprinnelig kommando:
  `TESTCONTAINERS_RYUK_DISABLED=true ./gradlew runAnalysisSnapshotDbPrototype --console=plain -PprototypeArgs=--verify`

Harnesset var koblet som et separat Gradle source set med testavhengighetene og
produksjonsmigreringene på classpath. Denne buildkoblingen er ikke beholdt;
evidensen skal ikke bli en del av applikasjonsartefakten eller ordinær CI.
Koden kan kobles midlertidig i en disponibel checkout for reproduksjon. En ny
beslutningsbærende spike skal i stedet få en eksplisitt, reviewet
reproduksjonsoppskrift og lagre rå planoutput i samme commit.
