# Lokal verifisering av flate analysetabeller

`AnalysisFlatProjector` lager kandidattabeller med skjemaet fra en låst
`AnalysisPublicationSpecificationV2`, via den eksisterende effective-plan-resolveren.
Dette er en intern, avgrenset domenekomponent. Den har ingen endepunkter, kildeadapter,
skytilkobling eller publiseringsjobb og endrer ikke produktets aktive release.

## Kjør verifiseringen

Fra repository-roten, med Docker tilgjengelig:

```sh
pnpm run api:test --tests '*AnalysisFlatProjection*'
```

Integrasjonstesten registrerer en syntetisk V2-kontrakt i en disponibel PostgreSQL,
oppretter et analyseprodukt, bekrefter forhåndsvisningen og leser releasen tilbake
fra databasen. Den bygger deretter tabeller fra eksplisitte syntetiske fakta med
den lagrede kontrakten. Ingen produksjonssvar leses. Produktet i testdatabasen
forblir `DRAFT`, uten `activeReleaseNumber` eller `desiredReleaseNumber`.

Resultatet kan inspiseres i
`apps/lumi-api/build/reports/analysis-projection/candidate.json` etter en vellykket
testkjøring. Rapporten er et lokalt byggeprodukt, ikke et eksportformat eller et
publiseringsmanifest. Den inneholder:

- Wide: tre svar, rating `0`, `10` og ubesvart.
- Long: fem rader; flervalget med to alternativer gir to rader med samme answer-key,
  og eksplisitt tomvalg gir én `EMPTY_SELECTION`-rad.
- Feltkatalog: fire strukturelle rader, uten klientetiketter.
- Kontroller: to besvarte ratingfelt og gjennomsnitt `5.0` i både wide og long.

Produkt-ID og kontraktdigest varierer mellom testkjøringer fordi databasen oppretter
et nytt produkt. Like inndata til selve projeksjonen gir samme resultat uavhengig
av rekkefølgen på svarene.

## Semantikk som verifiseres

Projeksjonen følger [datakontrakten](./datakontrakt-v1.md):

- Bare valgte strukturerte felt og registrerte dimensjoner blir kolonner. Rå JSON,
  fritekst, dato-svar, klientetiketter og interne databasereferanser er ikke
  outputdata. Uvalgte verdier brukes heller ikke til synlighetsbetingelser.
- Wide har én rad per eligible svar; long har bare besvarte felt. Ubesvart rating
  er `NULL`, aldri null poeng. Eksplisitt tomt flervalg er forskjellig fra ubesvart.
- Eksakt definition/flow-par bestemmer feltets struktur og anvendelighet. Et felt
  som ikke finnes i en eldre definisjon får `applicable=false`. Et nytt alternativ
  får `NULL` for eldre definisjoner hvor alternativet ikke fantes.
- Predicate-verdiene leses fra den eksakte immutable flow-kontrakten, ikke fra en
  rekonstruksjon av siste surveydefinisjon. Et svar på et ikke-anvendelig felt,
  ukjent hash eller en verdi utenfor pinnet domene avviser hele kandidaten.
- Long peker til entydige FIELD-/OPTION-rader med `UNKNOWN`-etiketter. Dette gir
  strukturell metadata uten å påstå at etiketter er registrert eller godkjent.
- Dato beregnes fra serverens lagringstid i `Europe/Oslo`; valgfri time er UTC,
  avrundet ned. Produktets 30/90/180-dagers vindu bruker forløpte døgn fra
  snapshot-tidspunktet, begrenset av kildens oppgitte retention-start og pause-cutoff.
  Begge tidsgrenser er inklusive.

## Grensen mot transport og produksjon

Kalleren må levere resolver-validert scope, konsistente kildefakta og de eksakte
immutable kontraktene. Dette er ikke en autorisasjonsgrense: teamfiltreringen her
erstatter ikke tilgangskontroll ved uttrekket. Testen med en lagret release
verifiserer kontraktkoblingen, ikke et databaseuttrekk av svar.

`AnalysisProjectionSubmission` representerer allerede eligible V2-fakta. En
kommende kildeadapter må håndtere historiske `UNPINNED`-svar, dokumentert cutover
og kvalitetsvarsler etter datakontrakten. Komponentens avvisning av en manglende
pin er en sikkerhetskontroll på adapterinput, ikke implementasjon av legacy-policy.
Ukjente ikke-null hashverdier skal aldri filtreres stille bort.

Kalleren leverer produktavgrensede response-/answer-keys. Testene bruker bare
syntetiske nøkler; de verifiserer koblinger og kollisjonsavvisning, ikke en
produksjonsalgoritmes anonymitet eller sikkerhet.

Denne implementasjonen tar høyst 10 000 kildefakta og lager høyst 1 000 000
outputceller i minnet. Overskridelse avviser kandidaten uten å returnere deltabeller.
Grensene er vernegrenser for lokal verifisering, ikke en produksjons-SLA eller
en batchstørrelse en fremtidig jobb kan bruke til uavhengige publiseringer.

Bare scope hvor `targetRelease == upperAllowlistRelease` støttes. En subtraktiv
gjenoppbygging av en eldre aktiv release krever egne publiserings- og
redaksjonsgarantier og avvises eksplisitt her. Rapporten inneholder derfor heller
ikke `product_manifest_v1` eller et oppdiktet `published_at`.

Før løsningen kan levere til Metabase/Datafortelling gjenstår blant annet sikker
kildeadapter, nøkkelavledning, faktisk transport, generation/freshness-kontroller,
atomisk aktivering, subtraktiv gjenoppbygging og feil-/retention-håndtering.
Denne delen innfører ingen beslutning om BigQuery-topologi eller driftsressurser.
