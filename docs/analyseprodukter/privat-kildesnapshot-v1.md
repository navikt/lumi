# Privat kildesnapshot V1

Dette dokumentet beskriver den planlagte, transportuavhengige grensen mellom
Lumi Postgres og privat analyse-staging. Grensen er ikke deployet, har ingen
databasebruker eller grants og inneholder ingen produksjonskobling.

## Formål

Én kjøring skal lese alle relevante produkter i ett konsistent
PostgreSQL-snapshot. Kildefakta dedupliseres globalt; produktspesifikk scope
representeres med tynne memberships. Dermed skanner eller kopierer vi ikke den
samme feedbackraden én gang per produkt når Lumi får 50 team og opptil 500
produkter.

En sentral NAIS Job/reconciler orkestrerer BigQuery-federeringen mot denne
kontrakten. Jobben kobler aldri direkte til Lumi-Postgres og får ikke
databasecredential. Hvis den målte dev-piloten forkaster federation, må en ny
transport fortsatt konsumere samme grense uten å endre domene- eller
forbrukerkontrakten.

## Logiske radtyper

Den private relasjonen er flat, typet og diskriminert med en lukket `row_kind`:

- `SNAPSHOT`: én header med snapshot-ID, `control_epoch`, cutoff,
  kontraktversjon, scope-digest og forventede tellinger.
- `RELEASE_SCOPE`: effective produkt/release, monoton `product_generation`,
  `effective_spec_digest`, lifecycle, cutoff, retensjon og senere
  pseudonymversjon.
- `MEMBERSHIP`: kobling mellom ett effective scope og én privat kilderad via
  en snapshot-lokal `snapshot_row_key`; bærer også produktspesifikk offentlig
  `response_key` for materialisering.
- `SUBMISSION`: én minimert, source-global innsending.
- `ANSWER_ATOM`: rating, enkeltvalg, valgt flervalgsoption eller eksplisitt
  tomt flervalg.
- `DEFINITION`, `FIELD` og `OPTION`: revisjonspinnet struktur uten rå labels.
- `FLOW_FIELD` og `FLOW_PREDICATE`: flate, typede flow-atomer.
- `DIMENSION_VALUE`: bare sentralt klassifiserte dimensjoner valgt av minst ett
  effective scope.
- `SUMMARY`: aggregerte eksklusjoner, blant annet historisk `UNPINNED`.
- `VIOLATION`: lukket feilkode og telling, aldri rå verdi eller fritekstdetalj.

Fysisk radrekkefølge har ingen semantikk. Alle referanser, tellinger og
foreldre-barn-forhold må valideres før en kandidat kan aktiveres.

`snapshot_row_key` er en ugjennomsiktig, snapshot-lokal joinidentitet avledet
fra privat `source_row_key` og snapshot-ID. Den er bare gyldig inne i én
run-scopet privat kandidat, kan ikke brukes på tvers av snapshots eller som
respondentidentitet, og finnes aldri i produktdatasett, preview, offentlig
output eller logger.

`MEMBERSHIP` knytter bare en `SUBMISSION` til ett effective source-scope. Det
gir aldri implisitt medlemskap til svar, dimensjoner eller struktur. Hvert
`ANSWER_ATOM`, `DIMENSION_VALUE`, `FIELD`, `OPTION`, `FLOW_FIELD` og
`FLOW_PREDICATE` må i tillegg valideres mot nøyaktig samme scopes eksplisitte
definition-, flow-, field-, option- og dimension-allowlist før atomet kan
materialiseres. Predicate-atomer begrenses til valgte, klassifiserte
avhengigheter. En membership for produkt A kan derfor ikke trekke med et atom
som bare produkt B har valgt.

## Minimering og identitet

Følgende kan aldri finnes i strømmen: rå `feedback_json`, tekst- eller
datosvar, klientlabels, URL/pathname, user-agent, viewport, debug, stabil
kildeglobal dedupliseringsnøkkel, intern feedback-UUID, vilkårlig context,
`JSON`, `STRUCT` eller `ARRAY`. Den eksplisitt tillatte
`snapshot_row_key`-en er kun en run-scopet privat referanse etter reglene over.

Fremtidig privat `source_row_key` skal være en tilfeldig 256-bits radnøkkel
som lagres immutable med feedbackraden og slettes sammen med den. Den er ikke
en respondentidentitet og kan aldri ligge i offentlig output, preview eller
logger. Produktspesifikke offentlige pseudonymer avledes først ved
produktmaterialisering. Eksakt domeneseparert algoritme, stabilitet, rotasjon,
blast radius og negativ loggingtest må sikkerhetsreviewes før noen ekte
dev-connection opprettes. KMS/HMAC er bare et krav dersom trusselmodellen eller
NADA-policyen viser et konkret behov; KMS innføres ikke automatisk i V1.

## Effective scope og lifecycle

- `ENABLED` bruker aktiv V2-release. Tillegg blir bare synlige i kandidaten.
  En subtraktiv endring går via `FREEZE_REQUESTED` og verifisert stengt
  konsumentlesing før den smalere effective-generasjonen committes.
- `FROZEN` har ingen lesbar offentlig flate. Reconciler kan idempotent
  materialisere den eksakte smalere generasjonen og åpner bare med en
  generation-/digest-bundet aktiveringslease.
- `PAUSED` beholder aktiv release med immutable øvre `data_cutoff_at`. Nedre
  retensjonsgrense fortsetter å flytte seg, slik at slettinger og utløp
  propageres.
- `OFFBOARDING` produserer ingen lesbar dataspec; senere drift skal bare
  deautorisere, tømme og verifisere.
- `DRAFT`, `DELETED` og historiske PublicationSpecification V1 gir ingen
  memberships.

En eldre release kan aldri være øvre allowlist. Rollback krever en ny,
validert release med høyere releasenummer.

## Porter før database- og skyimplementasjon

Før `analytics_export_v1`, databaseeier, login, connection, IAM eller scheduler
opprettes, må følgende være avklart og testet:

1. V2-release og effective-scope-kompilering er deterministisk og fail-closed.
2. Privat `source_row_key` har sikker migrering, livsløp og negativ loggingtest.
3. NADA bekrefter region, nettvei, minste IAM, pseudonymiseringspolicy, privat
   datasetteierskap og skillet mellom Lumi som infrastrukturprodusent og
   fagteamet som domeneeier/tilgangsgodkjenner.
4. Syntetisk lasttest dekker 50 team, 500 produkter og 10 ganger dagens volum.
5. Publiseringsløpet håndhever avtalte byte- og atomgrenser for kompilerte
   V2-spesifikasjoner før de kan lagres eller aktiveres.
6. Samtidige inserts, deletes og scopeendringer gir ett konsistent snapshot.
7. Pause, retention, sletting, replay, dobbeltkjøring og forsinkede forsøk er
   bevist fail-closed.
8. Federation velges bare hvis målingene viser akseptabel Cloud SQL-last.
   Reconciler-jobben er kontrollmekanismen rundt transporten, ikke en direkte
   Cloud SQL-klient; ved forkastet federation tas en ny transportbeslutning.

Den fremtidige databaseflaten skal ligge i eget låst schema, eies av en
dedikert `NOLOGIN`-rolle og gi leseren bare `CONNECT`, schema `USAGE` og
`EXECUTE` på én versjonert funksjon. Ingen tabell-`SELECT` eller menneskelig
lesetilgang tillates.
