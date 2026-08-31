# Privat kildesnapshot V1

Dette dokumentet beskriver den planlagte, transportuavhengige grensen mellom
Lumi Postgres og privat analyse-staging. Grensen er ikke deployet, har ingen
ny eksportbruker eller eksportgrants og inneholder ingen kobling til dev eller
produksjon.

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

## Syntetisk modellspike 30. august 2026

En isolert Kotlin-prototype testet om grensen over kan representeres uten en
per-produktkopi av kildefakta. Prototypen brukte bare syntetiske in-memory-data,
hadde en separat testnøkkelavleder og ble fjernet etter kjøring.

Alle 17 modellkontroller passerte i to etterfølgende verifikasjonskjøringer:

- intern feedback-ID, rå payload, fritekst, datosvar og klientlabel krysset ikke
  grensen
- alle private radtyper var flate og skalarbaserte
- source-globale innsendinger ble deduplisert selv når to produkter valgte
  samme kilde
- felt- og dimensjonsatomer ble filtrert med produktets egne, flate
  allowlist-rader
- teamkryssing, korrupte memberships og scope/source-mismatch feilet lukket
- utløpte rader, pause-cutoff og offboarding reduserte det lesbare datasettet
- sletting var borte i neste aktive snapshot; eldre generasjon og inaktiv
  snapshot-ID kunne ikke aktiveres eller leses gjennom aktiv-reader
- `response_key` var stabil gjennom en releaseendring i samme produkt og ulik
  mellom produkter, mens `snapshot_row_ref` endret seg mellom kandidater

Skalascenariet brukte 50 team, 500 produkter og to overlappende
produkt-memberships per kildeinnsending:

| Scenario | Kildeinnsendinger | Memberships | Logiske flatrader | Lokal byggetid |
| --- | ---: | ---: | ---: | ---: |
| 1x | 27 571 | 55 142 | 139 856 | 0,43–0,44 s |
| 10x | 275 710 | 551 420 | 1 380 551 | 2,22–2,23 s |

Tidene måler bare JVM-objektgenerering og validering på én utviklermaskin. De
kan ikke sammenlignes med stoppgrensene i ADR 0005 og sier ingenting om Cloud
SQL CPU, I/O, forbindelser, query-plan, overførte bytes eller BigQuery-kostnad.
Scenariet dekket representativ overlapp på to produkter per kildefakta, ikke
verstefall med alle ti tillatte produkter på teamet over samme kilde.

Spiken støtter derfor den logiske retningen med source-globale faktarader,
flate allowlist-atomer og tynne memberships. Den godkjenner ikke en transport
eller produksjonskobling. Følgende porter står fortsatt åpne:

- NADA-review av nøkkelavledning, KMS/keyset, region, IAM og datasetteierskap
- 1x, representativ 10x og verste tillatte membership-overlapp målt med
  faktisk radbredde, CPU, I/O, forbindelser, bytes og tidsavbrudd i dev
- atomisk staging/aktivering, fysisk opprydding av gamle kandidater og
  fail-closed replay mot den valgte BigQuery-topologien
- hele definition-, option- og flow-kontrakten med kompilerte byte- og
  atomgrenser

## PostgreSQL-spike 30. august 2026

En isolert prototype kjørte alle produksjonsmigreringer til og med V26 og den
repeatable grant-migreringen i PostgreSQL 17.11. Den brukte den faktiske
`feedback`-tabellen; foreslåtte effective-generation-, source-, field- og
dimension-rader lå i et separat scratch-schema. V9 og repeatable-migreringen
opprettet den eksisterende legacy-rollen `esyfo-analyse` og dens brede
`SELECT`-grants inne i den disponible containeren. Spiken opprettet ingen ny
eksportrolle eller eksportgrants og ingen skyressurs eller kobling til dev
eller produksjon.

Fem queryformer ble undersøkt, og **alle er forkastet**. For de fire første
ble verken harness eller rå output arkivert; tall og planbeskrivelser nedenfor
er derfor uarkiverte lokale observasjoner, ikke reproduserbar evidens:

- materialisering av hele `feedback_json` var rask lokalt, men skrev omtrent
  154 MiB og leste 331 MiB PostgreSQL-temp ved representativ 10x
- én korrelert lateral allowlist-evaluering per kilderad fullførte ikke innen
  flere minutter og ble avbrutt
- kompakte submissions med ett PK-oppslag per svar gjorde 275 710
  `feedback_pkey`-oppslag og over 1,1 millioner buffer hits ved 10x
- policy-drevet svarskann reduserte bufferarbeidet, men gjorde 250
  bitmap-passeringer og ga en mindre forutsigbar plan
- to eksplisitte sekvensielle passeringer materialiserte intern feedback-ID i
  `eligible_submission` og `feedback_answer` og brukte den som generell
  join-nøkkel. Det bryter identitetsinvarianten: intern ID kan bare være input
  til betrodd, produktspesifikk nøkkelavledning, ikke en materialisert privat
  mellomidentitet. At ID-en ikke fantes i sluttoutputen gjør ikke formen
  kontraktsriktig.

Den siste, nå forkastede formen ga følgende lokale observasjoner. Første
tidsverdi i hver rad er en uarkivert interaktiv observasjon; den andre finnes i
det saniterte konsollsammendraget. De er enkeltmålinger, ikke et statistisk
intervall:

| Scenario | Kilderader | Memberships | Logiske flatrader | Observert feedback-plan | Interaktiv / arkivert querytid | Temp lest/skrevet i arkivert kjøring |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| 1x, overlapp 2 | 27 571 | 55 142 | 139 856 | 2 × `Seq Scan`, 1 loop | 100,0 / 116,2 ms | 0 / 0 MiB |
| 10x, overlapp 2 | 275 710 | 551 420 | 1 380 551 | 2 × `Seq Scan`, 1 loop | 1 047,1 / 1 063,6 ms | 144,5 / 121,2 MiB |
| 10x, overlapp 10 | 275 710 | 2 757 100 | 3 586 231 | 2 × `Seq Scan`, 1 loop | 1 737,8 / 1 745,0 ms | 245,8 / 222,5 MiB |

Ved 1x var `feedback` 23,0 MiB inkludert indekser; ved 10x var den 181,4 MiB.
Tempbruken kommer fra kompakte materialiserte submissions, svaratomer og den
større membership-mengden. Den skal ikke skjules ved å øke `work_mem`; faktisk
Cloud SQL-plan og temp-I/O må måles med realistisk konfigurasjon.

I de to observerte lokale planene hadde begge feedback-nodene
`Actual Loops=1`. Dette er en observasjon for akkurat fixture, statistikk og
miljø, ikke en PostgreSQL-garanti. En senere kandidat må stoppe dersom den
faktiske dev-planen bryter avtalte grenser. Cachetilstand, Docker CPU-grenser,
`work_mem`, I/O-timing og full rå plan-JSON ble ikke bevart, så tidene kan ikke
brukes som et robust ytelsesestimat.

Samtidighetstesten etablerte et read-only snapshot ved control epoch 1 med to
lesbare innsendinger. En annen transaksjon slettet én rad, satte inn to og
committet offboarding ved epoch 2. Den etablerte leseren så fortsatt epoch 1 og
to konsistente innsendinger; en ny leser så epoch 2 og null lesbare
innsendinger, mens rå kilderadtall hadde gått fra to til tre. Det observerer
forventet `REPEATABLE READ`-isolasjon i fixturen, men lukker ikke databaseporten
fordi selve queryformen er forkastet.

Den eksakte siste harness-koden og et sanitert konsollsammendrag er bevart i
[`evidence/postgresql-snapshot-spike-2026-08-30/`](evidence/postgresql-snapshot-spike-2026-08-30/README.md).
Harnesset tolket full plan-JSON i minnet, men lagret den ikke. Opprinnelig plan
kan derfor ikke etterprøves byte-for-byte; en ny kandidat må committe både
reproduksjonsoppskrift og rå planoutput før resultatet kan lukke en port.

Spiken må ikke tolkes som kapasitets- eller transportgodkjenning:

- queryen materialiserte og talte radtyper, men målte ikke full radbredde,
  serialisering, nettverk eller bytes gjennom `EXTERNAL_QUERY`
- hver syntetiske innsending hadde ett strukturert svaratom; realistisk
  felt-, option- og flow-ekspansjon må inngå i dev-målingen
- scratch-tabellene representerte den logiske effective-kontrakten, ikke en
  ferdig versjonert databaseflate eller minste-privilegium-rolle
- lokal buffer- og tidsmåling sier ingenting om Cloud SQL CPU, I/O,
  forbindelser, samtidige produksjonslaster eller BigQuery-kostnad
- BigQuery-staging, atomisk pointerbytte, replay, cleanup og observability ble
  ikke testet

Resultatet godkjenner ingen dev-shadow. Neste databasearbeid er en ny,
reproduserbar og fortsatt isolert queryspike som ikke materialiserer intern ID
utenfor den betrodde nøkkelavledningen, og som måler full radbredde og
realistisk svarmultiplikasjon. Først når identitetsporten er lukket og Gate B i
trusselmodellen er oppfylt, kan en ekte dev-connection vurderes. Spiken velger
heller ikke federering fremfor en sentral NAIS Job og gir ingen
produksjonsgodkjenning.

Den fremtidige databaseflaten er fortsatt et åpent Gate B-valg. Den skal ligge
i et låst schema uten tabelltilgang til `public.*`, men vi har ikke besluttet
om minste flate er én versjonert funksjon med `EXECUTE` eller eksakte,
versjonerte views med `SELECT`. Valget må avstemmes med NADA-/connectionmodellen
og trusselmodellens privilegiumsmatrise før databaseeier, login eller grants
opprettes. Ingen default grants eller menneskelig lesetilgang tillates.
