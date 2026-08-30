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

Federated query og en eventuell sentral NAIS Job er adaptere til samme
kontrakt. Transportvalget kan derfor tas etter en målt dev-pilot uten å endre
domene- eller forbrukerkontrakten.

## Logiske radtyper

Den private relasjonen er flat, typet og diskriminert med en lukket `row_kind`:

- `SNAPSHOT`: én header med snapshot-ID, cutoff, kontraktversjon, scope-digest
  og forventede tellinger.
- `RELEASE_SCOPE`: effective produkt/release, lifecycle, cutoff, retensjon og
  senere pseudonymversjon.
- `MEMBERSHIP`: kobling mellom ett effective scope og én privat kilderad.
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
datosvar, klientlabels, URL/pathname, user-agent, viewport, debug,
dedupliseringsnøkkel, intern feedback-UUID, vilkårlig context, `JSON`, `STRUCT`
eller `ARRAY`.

Den private relasjonen bruker en ugjennomsiktig `snapshot_row_ref` for å knytte
`MEMBERSHIP`, `SUBMISSION` og underordnede atomer sammen. Referansen gjelder
bare i én source-kandidat, regenereres ved neste kjøring og kan ikke brukes som
stabil identitet på tvers av snapshots eller produkter. `SUBMISSION` og
underordnede atomer bærer bare denne kandidat-lokale referansen. Hver
`MEMBERSHIP` bærer i tillegg det aktuelle produktets stabile `response_key`,
slik at samme source-globale faktarad kan materialiseres med ulike nøkler i
ulike produkter uten en delt, varig analyseidentitet.

Lumi oppretter ikke en varig 1:1 analyseidentitet eller sidecar-tabell per
feedbackrad. Intern feedback-ID kan bare brukes transient i den betrodde
nøkkelavledningen; den kan aldri persisteres i privat staging, inngå i
kontrakten eller vises i output, preview eller logger. Den stabile identiteten
er produktets nøkkelbaserte `response_key`, som avledes separat per produkt.
Eksakt algoritme, derivasjonskontekst, KMS-/keysetmodell og hvor avledningen
kjøres må godkjennes med NADA før noen ekte dev-connection opprettes. En
transport som ikke kan gjøre dette uten å persistere intern ID eller eksponere
nøkkelmateriale, kan ikke brukes.

## Effective scope og lifecycle

- `ENABLED` bruker aktiv V2-release. En nyere ønsket release reduserer straks
  den aktive allowlisten, men tillegg blir bare synlige i kandidaten.
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
2. Snapshot-lokal referanse og stabil, produktspesifikk nøkkelavledning har
   dokumentert livsløp og negative tester for intern ID og nøkkelmateriale.
3. NADA bekrefter region, nettvei, minste IAM, KMS/keysetmodell og privat
   datasetteierskap.
4. Syntetisk lasttest dekker 50 team, 500 produkter og 10 ganger dagens volum.
5. Publiseringsløpet håndhever avtalte byte- og atomgrenser for kompilerte
   V2-spesifikasjoner før de kan lagres eller aktiveres.
6. Samtidige inserts, deletes og scopeendringer gir ett konsistent snapshot.
7. Pause, retention, sletting, replay, dobbeltkjøring og forsinkede forsøk er
   bevist fail-closed.
8. Federation velges bare hvis målingene viser akseptabel Cloud SQL-last;
   ellers brukes en sentral NAIS Job mot samme kontrakt.

Den fremtidige databaseflaten skal ligge i eget låst schema, eies av en
dedikert `NOLOGIN`-rolle og gi leseren bare `CONNECT`, schema `USAGE` og
`EXECUTE` på én versjonert funksjon. Ingen tabell-`SELECT` eller menneskelig
lesetilgang tillates.
