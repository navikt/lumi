---
title: "ADR 0005: Akseptert databaseberedskap og kapasitetsgrenser"
status: Akseptert
date: 2026-08-28
---

# ADR 0005: Akseptert databaseberedskap og kapasitetsgrenser

- **Status:** Akseptert
- **Dato:** 2026-08-28
- **Berører:** #484 (databaseberedskap), #507 (utrullingsklarhet) og #478 (automatisk retention)

## Kontekst

Lumi bruker én Cloud SQL-instans med PostgreSQL 17. Produksjonsmanifestet har
`tier: db-custom-1-3840`, automatisk diskvekst, `highAvailability: false` og
ingen eksplisitt `pointInTimeRecovery`. Innsendinger, analyser og eksport deler
den samme databasen. Innsendinger bufres ikke dersom databasen er utilgjengelig.

NAIS dokumenterer at Cloud SQL-instansen som standard sikkerhetskopieres hver
natt, at syv automatiske sikkerhetskopier beholdes, og at det i tillegg tas en
daglig katastrofekopi fra GCP til et on-prem-miljø. Point-in-time recovery (PITR)
er ikke aktivert som standard for denne ressursmodellen.

En read-only produksjonsmåling 28. august 2026 viste:

- 27 571 lagrede feedbackrader
- eldste rad fra 28. januar 2026 og nyeste rad fra 27. august 2026
- omtrent 50 MB database og 11 MB i feedbacktabellen

Automatisk retention sletter svar eldre enn 12 måneder. Jobben kan slette
maksimalt 500 av de eldste kvalifiserte radene per global 24-timersperiode.
Dette begrenser både datavekst og konsekvensen av en feil i slettejobben, men
erstatter ikke en recovery-beslutning.

Surveydata er nyttige analyse- og forbedringsdata, men ikke autoritative
saksbehandlings-, vedtaks- eller ytelsesdata. Tap er uønsket, men fører ikke til
feil utbetaling eller tap av en brukers rettigheter. Denne klassifiseringen er
avgjørende for beslutningen; endres den, skal ADR-en revurderes.

## Beslutning

### Dagens databaseoppsett beholdes

Produksjon beholder dagens tier uten HA og PITR. Det innføres ingen skjult
kostnadsøkning som del av utrullingen. Tier skal skaleres på bakgrunn av målte
kapasitetsbehov, PITR på bakgrunn av et strengere RPO-behov, og HA på bakgrunn
av et strengere tilgjengelighets- eller RTO-behov.

### Recovery-mål

- **Mål-RPO: høyst 24 timer.** Ved recovery fra en vellykket planlagt backup
  aksepteres tap av data skrevet etter den valgte backupen. Faktisk RPO skal
  beregnes og registreres i hendelsen.
- **Mål-RTO: høyst én arbeidsdag fra beslutningen om restore.** Dette er et
  internt mål, ikke en garanti fra NAIS eller Google Cloud. Faktisk RTO avhenger
  av tilgang, backupstatus, restorevarighet og nødvendig verifikasjon.
- Innsendinger som skjer mens databasen er utilgjengelig, eller etter siste
  gjenopprettede backup, kan gå tapt. Denne residualrisikoen aksepteres for Lumi
  så lenge dataklassifiseringen over er uendret.

Restore følger
[database-recovery-runbooken](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/database-recovery.md).
Ved mistanke om datakorrupsjon eller feilaktig sletting foretrekkes restore til
en ny instans for kontroll. Overskriving av produksjonsinstansen krever en
eksplisitt to-personers kontroll fordi all nyere data på mål-instansen erstattes.

### Målte stoppterskler

Før hver større onboarding-batch og minst månedlig under gradvis utrulling skal
teamet kontrollere de siste syv døgnene i Cloud SQL/Query Insights. Videre
utrulling stoppes og databasevalget revurderes dersom minst én av disse
tersklene nås:

- CPU er over 60 prosent sammenhengende i 30 minutter
- databaseforbindelser er over 70 prosent av instansens kapasitet i 15 minutter
- lagret radantall eller databasestørrelse overstiger ti ganger målingen over
  (275 710 rader eller 500 MB)
- en databasefeil gir tap som bryter mål-RPO eller mål-RTO
- databaseutfall gir en bruker- eller driftskonsekvens som teamet ikke lenger
  aksepterer
- dataklassifiseringen endres slik at surveydata blir forretningskritiske

En terskel betyr ikke automatisk at HA er riktig tiltak. Teamet skal først
skille mellom utilstrekkelig tier, dyre spørringer, for mange forbindelser og
et faktisk behov for sonefailover eller finmasket recovery.

## Konsekvenser

### Positivt

- Dagens lave volum utløser ikke en udokumentert dobling av databasekostnaden.
- RPO, RTO og akseptert datatap er eksplisitt i stedet for implisitt.
- Gradvis utrulling får målbare stoppkriterier før én vCPU blir en flaskehals.
- Retention-jobben har en konkret recovery-prosedyre dersom feil data slettes.

### Negativt og residualrisiko

- En sonefeil eller vedlikehold kan gjøre hele Lumi utilgjengelig til instansen
  er tilbake; det finnes ingen standby-instans for automatisk failover.
- En planlagt backup kan være opptil ett døgn gammel. Uten PITR kan teamet ikke
  velge et vilkårlig tidspunkt mellom backupene.
- Restore er en manuell og potensielt destruktiv operasjon. Målet om én
  arbeidsdag er ikke verifisert som en plattformgaranti.
- Konsumentene har ingen varig kø. Innsendinger under et databaseutfall kan
  derfor forsvinne i stedet for å bli forsinket.

## Vurderte alternativer

### HA og PITR nå

Forkastet for dagens skala. HA oppretter en standby-instans og øker
instanskostnaden vesentlig. PITR gir bedre presisjon ved feilaktig sletting, men
krever WAL-lagring og omstart ved aktivering. Dagens datakritikalitet,
backupfrekvens, lave volum og begrensede retention-batcher begrunner ikke disse
tiltakene nå.

### Bare PITR

Forkastet nå, men er første alternativ dersom mål-RPO strammes inn eller en
recovery-hendelse viser at døgnbackup ikke er tilstrekkelig. PITR skal vurderes
uavhengig av HA; behov for mer presis recovery betyr ikke automatisk behov for
en standby-instans.

### Større tier før målt behov

Forkastet. Databasen er liten, disk vokser automatisk, og det foreligger ikke
målinger som viser CPU- eller forbindelsespress. Dyre spørringer skal
undersøkes før tier oppgraderes.

## Oppfølging

- Bruk recovery-runbooken ved databasehendelser og registrer faktisk RPO/RTO.
- Kontroller backupstatus og kapasitetsmålinger før større onboarding-batcher.
- Revurder ADR-en når en stoppterskel nås, etter en faktisk restore, eller når
  dataenes kritikalitet endres.
- En manifestendring som aktiverer HA, PITR eller ny tier skal være en separat,
  kostnadssynlig og reviewet beslutning.

## Kilder

- [NAIS: Cloud SQL/Postgres-reference](https://docs.nais.io/persistence/cloudsql/reference/)
- [NAIS: kostnadsoptimalisering for Cloud SQL](https://doc.nais.io/workloads/how-to/cost-optimization/)
- [Google Cloud: restore av PostgreSQL fra backup](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/restoring)
