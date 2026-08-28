# Database recovery

Denne runbooken brukes når `lumi-api` ikke når produksjonsdatabasen, når data
kan være korrupte, eller når en destruktiv operasjon kan ha fjernet feil rader.
Den operasjonelle beslutningen og de aksepterte målene er dokumentert i
[ADR 0005](../../../../docs/adr/0005-database-recovery-og-kapasitet.md).

## Mål og begrensninger

- Mål-RPO er høyst 24 timer fra siste vellykkede planlagte backup.
- Mål-RTO er høyst én arbeidsdag fra beslutningen om restore.
- Målene er interne og ikke en garanti fra NAIS eller Google Cloud.
- Uten PITR kan data skrevet etter valgt backup gå tapt.
- Restore til en eksisterende instans overskriver data og bryter aktive
  forbindelser. Ikke start en restore før kilde, mål og recovery-tidspunkt er
  kontrollert av to personer.

Cloud SQL tar normalt nattlig backup og beholder syv automatiske backups. NAIS
har i tillegg en daglig katastrofekopi til on-prem. Backupstatus og tidspunkt
skal likevel verifiseres i den konkrete hendelsen; dokumentert standard er ikke
bevis på at siste kjøring lyktes.

## Første respons

1. Opprett eller oppdater hendelsen med starttid, ansvarlig og berørte flater.
2. Stans nye utrullinger og survey-migreringer.
3. Avklar om dette er utilgjengelighet eller mulig datatap. Ikke restore data
   ved et midlertidig databaseutfall som kan løses uten overskriving.
4. Ved mistanke om feil i automatisk retention: sett
   `LUMI_RETENTION_ENABLED=false` i en separat nødendring og bekreft
   `max(lumi_retention_enabled{app="lumi-api"}) == 0`. En transaksjon som
   allerede kjører kan fortsatt slette opptil 500 rader.
5. Noter tidspunktet for siste bekreftet korrekte data og første observerte
   feil. Ikke kopier surveyinnhold eller respondentdata til hendelsesloggen.

## Verifiser backup og omfang

1. Finn den faktiske Cloud SQL-instansen via NAIS Console. Ikke anta
   instansnavn eller prosjekt.
2. Åpne backupoversikten i Google Cloud Console og bekreft:
   - riktig kildeinstans og PostgreSQL-versjon
   - status `SUCCESSFUL`
   - backupens start- og sluttidspunkt
   - at backupen er eldre enn den første observerte korrupsjonen dersom
     recovery gjelder feilaktige data
3. Sammenlign backupens tidspunkt med hendelsens siste kjente gode tidspunkt.
   Beregn forventet datatap før restore godkjennes.
4. Ta en read-only tilstandsmåling når databasen er tilgjengelig:

   ```sql
   SELECT
       COUNT(*) AS feedback_rows,
       MIN(opprettet) AS oldest_feedback,
       MAX(opprettet) AS newest_feedback,
       pg_size_pretty(pg_database_size(current_database())) AS database_size,
       pg_size_pretty(pg_total_relation_size('feedback')) AS feedback_size
   FROM feedback;
   ```

5. Ved retention-hendelser: noter økningen i
   `lumi_retention_deleted_feedback_total` og tell rader som er kvalifisert med
   den samme UTC-grensen som i
   [retention-runbooken](./automatic-retention.md).

## Velg recovery-strategi

| Situasjon | Foretrukket handling |
| --- | --- |
| Kortvarig Cloud SQL-/nettverksutfall uten tegn til datatap | Vent på eller eskaler plattformfeilen; ikke restore |
| Mistanke om korrupsjon eller feilaktig sletting | Restore valgt backup til en ny instans og valider før eventuell cutover |
| Kjent omfattende datatap der produksjonsinstansen må tilbakeføres | Overskriv eksisterende instans først etter to-personers kontroll og eksplisitt hendelsesbeslutning |
| Katastrofe der vanlige GCP-backups ikke er tilgjengelige | Eskaler til NAIS for bruk av katastrofekopien |

Cloud SQL-instansen forvaltes deklarativt av NAIS. Koordiner opprettelse,
tilkobling og eventuell cutover med NAIS før en ny eller gjenopprettet instans
tas i bruk. Ikke legg inn ad hoc credentials eller en udokumentert manuell
tilkobling som varig løsning.

Følg den offisielle
[Cloud SQL-prosedyren for restore](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/restoring).
Ved restore til eksisterende instans skal hendelsesloggen inneholde:

- eksakt kildeinstans og backup-ID
- eksakt mål-instans
- backupens tidspunkt og forventet RPO
- navn på de to som kontrollerte operasjonen
- eksplisitt bekreftelse på at nyere data på målet blir overskrevet

## Valider gjenopprettingen

Før trafikk eller migrering fortsetter:

1. Bekreft at Cloud SQL-operasjonen er fullført uten feil.
2. Bekreft at Flyway-tabellen ikke har feilede migreringer og at forventet
   skjema finnes.
3. Kjør read-only tilstandsmålingen over og sammenlign med forventet backup.
4. Start eller pek applikasjonen mot den gjenopprettede databasen gjennom en
   reviewet NAIS-endring. Bekreft `/internal/isReady` og vanlige
   databaseavhengige lesekall.
5. Hold automatisk retention avslått til radomfanget er kontrollert.
6. Dersom en kontrollert produksjonssurvey allerede er tilgjengelig: avtal én
   syntetisk innsending uten personopplysninger med survey-eieren, og bekreft
   den eksakte receipt-raden i dashboardet. Ikke opprett eller reaktiver en
   survey bare for recovery-testen. Hvis ingen egnet survey finnes, følg den
   første forventede innsendingen via receipt-ID og metrikker uten å kopiere
   svarinnhold. `/release-verification` er bare aktiv i dev og er derfor ikke
   bevis på at produksjonsdatabasen er gjenopprettet.
7. Kontroller `LumiSubmissionFailure`,
   `LumiSubmissionRejectionSpike` og applikasjonslogger før hendelsen lukkes.

## Etterarbeid

Dokumenter:

- tidspunkt for siste gjenopprettede data og første tapte data
- faktisk RPO og RTO
- antall tapte eller gjenopprettede rader, uten surveyinnhold
- om målene i ADR 0005 ble brutt
- om PITR, HA, ny tier, kø/buffering eller endret retention-begrensning skal
  vurderes

Aktivering av retention etter en recovery skal skje som en separat, reviewet
manifestendring etter kontroll av kvalifisert radantall og query plan.

## Løpende beredskap

Før hver større onboarding-batch og minst månedlig under gradvis utrulling:

1. Bekreft minst én vellykket planlagt backup siste 24 timer og forventet
   backuphistorikk i Cloud SQL Console.
2. Kontroller de siste syv døgnene med CPU, forbindelser og dyre spørringer i
   Cloud SQL/Query Insights.
3. Mål radantall og databasestørrelse med read-only-spørringen over.
4. Stopp videre utrulling dersom en terskel i ADR 0005 er nådd.
