# Trussel- og verifikasjonsmodell V1 for analyseprodukter

Denne modellen beskriver sikkerhetsgrensene for teamavgrensede
analyseprodukter og bevisene som kreves før løsningen kan gå fra lokal
utvikling til shadow-kjøring og produksjon. Den kompletterer
[ADR 0006](../adr/0006-teamavgrensede-analyseprodukter.md) og
[V1-datakontrakten](./datakontrakt-v1.md).

Modellen gjelder også når dataene er pseudonymiserte. Pseudonymisering er ikke
anonymisering, og lave volum, kombinasjoner av svar og teamkontekst kan gjøre
enkeltpersoner gjenkjennelige.

## Verdier og tillitsgrenser

Verdiene som skal beskyttes er respondentnære svar, source- og
produktidentiteter, nøkkelmateriale, produktkonfigurasjon, eiermetadata og
integriteten til aktiv release/snapshot.

```text
Lumi API / Cloud SQL
  |  read-only, minimert eksportkontrakt
  v
BigQuery connection + privat staging/canonical
  |  effective-spec-kompilert, kontrollert publisering
  v
Isolert produktdatasett
  |  tilgang forvaltet av Datamarkedsplassen
  v
Metabase / datafortelling / notebook
```

Hver pil er en egen tillitsgrense. Ingen identitet skal ha privilegier på begge
sider av en grense med mindre det er nødvendig og dokumentert. Menneskelige
konsumenter skal bare kunne lese siste ledd.

## Sikkerhetsinvarianter

Disse invariantene er absolutte. En rød kontroll stopper publisering:

1. Team A kan ikke oppdage eller lese data, preview-/driftsmetadata, counts,
   utkast eller ikke-publiserte navn for team B gjennom Lumi eller BigQuery.
   Eksplisitt godkjent katalogmetadata i Datamarkedsplassen er det eneste
   discovery-unntaket.
2. Intern Lumi-ID, rå payload og forbudte datakategorier forlater aldri Cloud
   SQL-eksportuttrykket.
3. Utkast eller mislykket validering kan aldri materialiseres eller endre aktiv
   release eller snapshot.
4. En eldre, forsinket eller replayet kjøring kan aldri aktivere eldre data
   eller gjeninnføre slettede data.
5. En deprecated major kan aldri bevare et felt eller en retensjon som nyeste
   release har fjernet.
6. Publisering gir aldri personer eller grupper lesetilgang.
7. Pause og produktlokale feil stopper ikke retensjon, kildesletting eller
   offboarding. Source-/plattformfeil gir retry, alarm og et målbart SLO-brudd;
   de kan ikke skjules som vellykket slettesynk.
8. Preview viser aldri reelle enkeltinnsendinger.
9. Et betinget felt kan aldri releaseres når et svar-/metadatafelt i predicate
   ikke selv er eksplisitt valgt og godkjent i produktet. Historisk flyt uten
   en ingest-matchet revisjon rekonstrueres aldri.

## Trusler, kontroller og påkrevd evidens

| ID | Trussel | Forebyggende kontroll | Evidens før produksjon |
| --- | --- | --- | --- |
| T01 | Cross-team IDOR eller metadatalekkasje | Team avledes server-side; alle produkt-, kilde- og preview-oppslag scopes med autorisert team; uautorisert og ikke-eksisterende ressurs har lik respons; bare godkjent Marketplace-metadata kan være synlig på tvers | API-/UI-tester med team A/B, inkludert tomtilstander, feil, counts, bytte av aktivt team og allowlist for katalogmetadata |
| T02 | Rå, forbudt eller avledet uvalgt data havner i privat/offentlig lag | Versjonert allowlist-kontrakt; typed compiler; klientleverte etiketter eksporteres aldri; et betinget felt krever offentlig valgte predicate-avhengigheter før release; tilbakekalt metadata undertrykkes i alle majors; negative kontroller før pointerbytte | Inspeksjon av eksportview, query-resultat, staging, canonical og produktviews; tester for tekst-/datosvar, UUID, JSON, URL, user-agent, debug, manipulerte/tilbakekalte etiketter, PII, HTML, kontrolltegn og allowlistet-men-uvalgt predicate-input |
| T03 | Samme kilderad kan kobles på tvers av produkter | Produktspesifikk keyed pseudonym; separat nøkkelmateriale/derivasjonskontekst; intern ID brukes bare transient i betrodd avledning; snapshot-lokal referanse er ikke stabil og ingen privat referanse eller nøkkel finnes i offentlig output eller logger | Test som viser stabil nøkkel innen produkt, ulik nøkkel mellom produkt A/B og fravær av intern ID, `snapshot_row_ref` og nøkkelmateriale |
| T04 | Replay eller rollback gjenoppretter slettede rader | Replay leser alltid dagens kilde; ingen gammel snapshot kan aktiveres; alle ikke-aktive kopier slettes/utløper | Slett kilderad, kjør nyere snapshot og forsøk replay/eldre run; raden skal være fraværende overalt |
| T05 | Delvis/eldre kjøring blir synlig, produkt A stopper B eller konsumenten blander snapshots | Unik source-staging, atomiske monotone pointere, offentlig `product_snapshot_id`/manifest, produktlokal feilstatus og purge-only fallback | Feilinjeksjon, omvendt kjøringsrekkefølge, pointerbytte mellom separate view-spørringer og kontraktsfeil i A mens B publiserer og begge fortsatt sletter |
| T06 | Feil metadatajoin, denominator, betinget relevans, malformed katalog eller kildeevolusjon viser feil betydning/survey | Full kildeidentitet; separat ingest-matchet `flow_hash` med normalisert flyt, avhengigheter og evaluatorversjoner; V1-rate bare for kanonisk `visibleIf`; eksplisitt felt-applicability og definition-spesifikk option-nevner; komplette kataloginvarianter og eksakt én match | Tester med samme `survey_id` i to apper, samme definition-hash med endret flow, manglende/ukjent/legacy flow, nytt felt, ny/duplisert option, sann/usann/ukjent `visibleIf`, labelendring og malformed/duplisert katalograd |
| T07 | Pause/deprecated view bevarer data for lenge | Effektiv retensjon og source deletion anvendes ved hvert fullsnapshot og purge-only snapshot på alle majors; pause fryser bare øvre cutoff; deprecated schema er stabilt, men fjernede verdier er `NULL` | Klokke-/snapshot-tester for 30/90/180/source-max, pause, kortere release, fjernet survey/felt og deprecated major |
| T08 | Arvet IAM, publisher/binder, alias eller post-bind viewmutasjon omgår produktgrensen | Dedikert prosjekt uten menneskelig/default arv; separate identiteter; immutable release-FQN; live SQL/digest-validering mot effective spec; alias kan bare målrette samme produkt/release/digest | IAM-inventar, binding-/aliasaudit, post-bind/TOCTOU-test, negativ A→B/revokert-alias-test og tilgangstester for alle identiteter |
| T09 | Eksport overbelaster Cloud SQL | Én connection/query per snapshot, statement timeout, connection limit og målt 1x/10x spike; ADR 0005-stoppgrenser | Query-plan, varighet, bytes, CPU, I/O og connections under realistisk last |
| T10 | Preview avslører en reell, liten eller differensierbar gruppe | Bare syntetiske rader; fast allowlist av aggregater; primær- og sekundærsuppresjon; ingen vilkårlig dato/gruppering eller rå eksempler | UI/API-tester for 0/1/4/5, total/delmengde `6/5/1`, kategorisummer, gjentatte draftendringer og differanseforsøk, samt logginspeksjon |
| T11 | Navnekollisjon eller SQL-injeksjon gjennom konfigurasjon | Ingen brukerdefinerte SQL-identifikatorer; deterministisk slug+hash; quoted/static templates og allowlist | Property-/kollisjonstester med Unicode, lange ID-er, reserverte ord og SQL-metategn |
| T12 | Drift mellom effective spec og faktisk datasett | Immutable release minus auditerte tilbakekallinger + `schema_digest`; deklarativ reconciler; status skiller ønsket og faktisk tilstand | Driftstest som endrer/sletter view utenfor Lumi og viser oppdagelse, sikker reparasjon og audit |
| T13 | Offboarding etterlater data, grants eller markedsplassressurs | Trinnvis, idempotent offboarding med verifisert tomhet før `Slettet` | Gjentatt feilinjisert offboarding og etterkontroll av data, views, bindings, grants, credentials og katalog |
| T14 | Høy kardinalitet eller ukjent dimensjon omgår minimering | Sentralt klassifisert dimensjonsregister med type, scope og kardinalitetspolicy; fail closed | Negative tester for uregistrert nøkkel, nytt scope, typeendring og overskredet kardinalitet |
| T15 | Authorized-resource-kvote eller for bred dataset-authorization bryter 50-team-målet | Publiseringstopologi velges etter kvote- og privilegieanalyse; eksplisitt budsjett for produkter, surveys og majors; ingen implicit future-view-tilgang uten review | Skalatest med 50 team, opptil 500 produkter, representative surveyantall og parallelle majors, inkludert reconcile og offboarding |

## Identiteter og minste privilegium

Tilgangsmatrisen skal verifiseres fra faktisk IAM, ikke bare fra ønsket
konfigurasjon:

| Identitet | Skal kunne | Skal ikke kunne |
| --- | --- | --- |
| Cloud SQL export-bruker | `CONNECT`, `USAGE` på eksportskjema og enten `SELECT` på eksakte eksportviews eller `EXECUTE` på én eksakt eksportfunksjon, valgt i Gate B | lese `public.*`, råtabeller, andre eksportobjekter, skrive eller arve default grants |
| BigQuery connection service agent | bruke avtalt Cloud SQL-connection | lese produktdatasett eller administrere IAM |
| Scheduled-query servicekonto | starte jobb, bruke connection, skrive privat staging/canonical | lese råtabeller direkte, gi produkt-IAM eller skrive andre prosjekter |
| Kontraktkompilator | produsere deterministisk viewdefinisjon, FQN og `schema_digest` fra immutable release minus auditerte tilbakekallinger | Cloud-, database-, data- eller IAM-tilgang |
| View-publisher/reconciler | opprette ny immutable release-FQN; lese privat schema/data bare i det minimum BigQuery krever; ingen jobbkjøring | mutere bundet view, databasecredential, dataset-ACL, vilkårlig query eller menneskelige grants |
| Cross-dataset-binder/NADA-port | lese faktisk view-SQL, validere digest/policy og autorisere immutable FQN mot source | generell produktpublisering; binding når publisher fortsatt kan mutere viewet; menneskegrant uten separat Marketplace-/sikkerhetsport |
| Alias-publisher | peke stabilt offentlig navn til aktiv, bundet boundary-FQN med samme produkt/major/release/digest | canonical-tilgang, A→B-mål, gammel/revokert FQN, boundary-mutasjon eller IAM |
| Lumi API | forvalte teamautoriserte drafts, releaser og ønsket tilstand | direkte datapublisering, databaseeksportcredential eller IAM-grants |
| Konsument | lese eksplisitt autorisert produktressurs | Postgres, privat BigQuery-lag, andre produkter eller IAM-administrasjon |

Ingen default grants eller brede roller kan erstatte eksplisitte privilegier.
Hvis nødvendig BigQuery-permission også kan misbrukes til menneskegrant eller
vilkårlig source-eksponering, skal dette dokumenteres som capability og
begrenses av separasjon, policykontroll, audit og ekstern godkjenningsport; det
kan ikke skjules i «skal ikke kunne»-kolonnen. Credentialrotasjon,
nøkkelversjon og eierskap skal være dokumentert før shadow.

## Verifikasjonsgater

### Gate A – før domenekode og prototype regnes som kontraktsriktig

- [ ] Alle kolonner og invarianter i V1-kontrakten har stabile test-ID-er.
- [ ] Compiler bruker allowlist for felttyper, dimensjoner og fysiske navn.
- [ ] `flow_hash` beregnes fra normalisert flyt, dependencies og
      evaluatorversjoner, registreres før ingest og inngår i release/effective
      spec. Ukjent klienthash avvises; manglende historikk blir `UNPINNED`, og
      eldre `logic` lagres eller hashes ikke og brukes ikke til eksakt
      V1-applicability. Siste observerte flow styrer cutoverstatus;
      revisjonskvote, 64 KiB per flow, 16 MiB kontraktbudsjett per team,
      verdi-/størrelsesgrenser og kontrakt-GC følger retention.
- [ ] Team-scope avledes gjennom eksisterende autorisasjon på hvert endepunkt.
- [ ] Preview bruker bare syntetiske rader og en versjonert terskelpolicy:
      1–4 distinkte innsendinger gir `BELOW_THRESHOLD`, 0 kan vises som 0, og
      sekundærsuppresjon skjuler også viste celler når totaler, komplementer,
      kategorisummer eller gjentatte previews ellers kan rekonstruere en
      undertrykt celle. `6/5/1` er et obligatorisk negativt testtilfelle.
- [ ] Draft, validering og release har revisjonsvern og auditkrav.

### Gate B – før dev-spike får bruke en ekte connection

- [ ] NADA har bekreftet region, connection-modell og minste servicekonto-IAM.
- [ ] Databaseflaten er valgt som eksakte, versjonerte views eller én eksakt,
      versjonert funksjon; export-brukeren har bare privilegiet mekanismen
      krever og kan ikke bruke andre objekter i eksportskjemaet.
- [ ] Det er avklart om prosjekt/datasett arver menneskelig eller default
      lesetilgang.
- [ ] Eksakt algoritme og forvaltning for produktspesifikke nøkler er
      sikkerhetsreviewet.
- [ ] Cloud SQL export-rollen kan ikke lese råtabeller eller `public.*`.
- [ ] Syntetisk team A/B-datasett og negative forbudt-data-fixtures finnes.
- [ ] Publiseringstopologien og skillet mellom compiler, publisher og
      binder/NADA-port er valgt ut fra dokumenterte IAM-capabilities.
- [ ] Boundary-views bruker immutable release-FQN; binder validerer live SQL
      mot trusted `EffectivePublicationSpec` (immutable release minus auditerte
      tilbakekallinger), og valgt mekanisme fjerner mutate-capability før
      binding.

### Gate C – før produksjons-shadow uten konsumenttilgang

- [ ] Én `EXTERNAL_QUERY` gir en konsistent kandidatsnapshot ved realistisk
      volum.
- [ ] 1x- og 10x-måling er under stoppgrensene i ADR 0005.
- [ ] Feilinjeksjon beviser atomisk og monoton aktivering.
- [ ] Sletting/replay-test beviser at slettede data ikke gjenoppstår.
- [ ] Ukjent definition/option i produkt A fryser bare A, delpubliserer ingen
      nye A-rader og hindrer verken publisering eller slettesynk for B; purge-
      only refresh holder A innen retensjon og slettings-SLO.
- [ ] Purge-only er bevist som ren delmengde: samtidige forsøk på tillegg og
      mutasjon avvises, mens sletting og utløp fjernes uten å endre
      forretningspayload. Aktiveringsmetadata er eksplisitt utenfor
      delmengdesammenligningen.
- [ ] `SECURITY_REDACTION` på et fryst produkt kan bare fjerne label,
      katalog-/viewbeskrivelse og flytte hash til `UNKNOWN`; gammel metadata
      forsvinner fra long, katalog, alle majors og Metabase uten nye svar.
      Releasen minus auditerte tilbakekallinger er samme effective spec for
      kompilator, digest/FQN, binder, reconciler og alias. Ny FQN bindes,
      gammel FQN deauthorizeres før aliasbyttet, og fallbackhashen må være
      forhåndsmaterialisert.
- [ ] Ratingvarianter valideres mot min/max, og NPS `0` bevares som verdi.
- [ ] Dupliserte options blokkeres for registrert/pinnet kontrakt. Wide og long
      bruker samme validerte option-sett og distinct N; legacy/unpinned har
      ingen offentlige svarverdier som kan dedupliseres.
- [ ] D1→D2 med ny option gir `NULL` for historiske D1-rader, ikke `FALSE`;
      `selection_count` skiller utilgjengelig option fra ubesvart spørsmål.
- [ ] D1→D2 med ny enkeltvalgsoption utvider domenet uten ny wide-kolonne;
      option-raten bruker definition-spesifikk OPTION-katalog og utelater
      registrerte D1-rader der optionen ikke fantes.
- [ ] D1→D2 med nytt rating- eller enkeltvalgsfelt gir
      `<field>__applicable=FALSE` for registrerte D1-rader og `TRUE` for
      ubetingede D2-rader. Et ubesvart, bevist relevant D2-felt beholder `TRUE`
      med `NULL` svarverdi, `LEGACY_DERIVED` får `NULL`, og feltraten utelater
      både `FALSE` og `NULL`.
- [ ] Ubetinget felt og både sann/usann `visibleIf`-gren gir henholdsvis korrekt
      `TRUE`/`FALSE` applicability. Betingelser på svar og metadata testes;
      tekst, ikke-godkjent eller allowlistet-men-uvalgt svar/metadata blokkerer
      en ny release av det betingede feltet. Samme `definition_hash` med endret
      `visibleIf` får ny `flow_hash`, og historiske rader uten entydig flow får
      `NULL`/kvalitetsvarsel og evalueres aldri med dagens predicate.
- [ ] `UNPINNED` historikk ekskluderes fra wide og long med synlig
      kvalitetsvarsel; eventuelt count i team-preview følger terskelpolicy.
      En nyere `UNPINNED` rad etter cutover blokkerer ny release i stedet for å
      øke eksklusjonen stille. Strukturelt bevist fravær i en tillatt,
      registrert definition gir fortsatt `FALSE`.
- [ ] Enhver `applicable=FALSE` kombinert med kildeverdi fryser produktet før
      aktivering for rating, enkeltvalg, flervalg og `EMPTY_SELECTION`, både ved
      strukturelt fravær og usann predicate. Ingen verdi blir en tilsynelatende
      grønn undertrykking.
- [ ] FIELD-/OPTION-/label-source-invariantene valideres også for katalograder
      uten answer-referanse; tilbakekalt label forsvinner fra alle majors.
- [ ] Pause, forkortet retensjon, fjernet felt/survey og deprecated major er
      verifisert mot samme source deletion.
- [ ] Schema-, referanse-, isolasjons-, retensjons- og canary-kontroller stopper
      publisering ved avvik.
- [ ] Staging og ikke-aktive snapshots har verifisert opprydding og TTL.
- [ ] Kvote-/privilegiemodellen er lastet med 50 team, opptil 500 produkter,
      representative surveys og parallelle majors uten å gi fremtidige views
      ukontrollert source-tilgang.
- [ ] Post-bind mutasjon og TOCTOU er testet negativt. Oppdaget drift på en
      bundet ressurs deauthorizeres før reparasjon.
- [ ] Alias A kan ikke målrette produkt B eller en gammel/revokert release;
      faktisk aliasmål auditeres mot trusted produkt/major/release/digest.

### Gate D – før første konsument får tilgang

- [ ] Datamarkedsplassen kan registrere, oppdatere og avvikle flere views som
      ett produkt uten Lumi-operatør eller deploy per team.
- [ ] Produktdatasettets faktiske IAM viser ingen arvet menneskelig/default
      lesetilgang, eller en eksisterende ekstern godkjenningsport er brukt.
- [ ] Eksakt allowlist for offentlig Marketplace-metadata er godkjent; preview,
      driftsmetadata og ikke-publiserte navn er ikke søkbare på tvers av team.
- [ ] Dataleveranse-, markedsplass- og Metabase-status vises som uavhengige
      sannheter.
- [ ] iSyfo-paritet er bevist for totalpopulasjon og, i en periode med
      ingest-matchet flow, svarmål for samme periode og filtre. `UNPINNED`
      historikk inngår ikke i svarpariteten eller en antatt backfill.
- [ ] Metabase og datafortelling/notebook har lest samme kontrakt.
- [ ] Pointerbytte mellom manifest, wide, long og katalog gir samme
      `product_snapshot_id` eller en oppdagbar mismatch. Manifestets
      resource-rad har schema-digest/radtall, og én-statements LEFT JOIN er
      testet for tom→ikke-tom wide-view.
- [ ] Team B-isolasjon er bevist i API, BigQuery og metadata/discovery.
- [ ] Idempotent offboarding er feilinjisert og verifisert å fjerne data, views,
      bindings, grants og markedsplassressurs før status `Slettet`.

### Gate E – før bred `esyfo-analyse`-tilgang fjernes

- [ ] Minst to planlagte snapshots er publisert og konsumert uten avvik.
- [ ] Quarto/Metabase peker på ny kontrakt og ingen konsument leser `public`.
- [ ] Dataeier har akseptert det pinnede analysevinduet før bred tilgang
      fjernes; eldre svarhistorikk krever en separat sikkerhetsreviewet
      backfillbeslutning.
- [ ] Repeatable/default grants fjernes før brede tabellgrants.
- [ ] Ubrukte Cloud SQL-roller/connections avvikles og fravær verifiseres.
- [ ] Runbook beskriver rollback av konsumentkonfigurasjon uten rollback av
      slettede data eller bred databasegrant.

## Påkrevde driftsbevis per kjøring

Følgende lagres uten respondentdata eller private nøkler:

```text
run_id
scheduled_at
source_snapshot_at
product_snapshot_id
snapshot_mode
contract_version
source_submission_count
canonical_row_count
status
quality_status
published_at
cleanup_completed_at
```

Det varsles på mislykket kjøring, 36 timer uten vellykket slettesynk, stale
source- eller produktpointer, staging eldre enn 24 timer, volumavvik,
kontrakts-/referansebrudd, dimensjonsbrudd, drift, mislykket
slettesynk/offboarding og tenant-/forbudt-data-canary. En daglig feil får
automatiske retryforsøk innen seks timer. 36 timer er et målbart SLO; passering
er et brudd med operatørvarsel og runbook. Tenant- eller forbudt-data-avvik
stopper alltid source-publisering.

## Eksterne beslutninger som fortsatt er åpne

Følgende skal avklares med NADA og dokumenteres som evidens; implementasjonen
skal ikke gjette:

- om et dedikert analyseprosjekt og produktdatasett kan være servicekonto-only
  uten arvet menneskelig tilgang
- minste IAM, capability-separasjon, authorized-resource-kvoter og mekanisme
  for cross-dataset binding uten implicit future-view-tilgang
- støttet programmatisk opprettelse, oppdatering og avvikling av datasett og
  Datamarkedsplassen-ressurser
- fallback dersom registrering bare kan fullføres i et støttet selvbetjent UI
- servicekonto, region, connection og credentialrotasjon for scheduled query
- hvordan flere views og major-versjoner representeres som ett dataprodukt
- krav til Behandlingskatalog/PVK og hvordan Metabase-grupper håndteres
- støttet varsling for eierfornyelse og operasjonelle avvik

Et ubesvart punkt kan gi en begrenset lokal/dev-spike når dataene er
syntetiske, men kan ikke passere den relevante shadow- eller produksjonsgaten.

## Residualrisiko og revurdering

Selv med grønne kontroller kan små datasett og kombinasjoner av strukturerte
svar være identifiserende for personer som kjenner konteksten. Dataeier,
behandlingsgrunnlag, tilgangsvurdering, kortest forsvarlig retensjon og
lavtallspraksis er derfor fortsatt nødvendige.

Modellen skal revurderes ved nye datakategorier, tekst/dato, kryss-team-
produkter, endret tilgangsmodell, annen transport enn fullsnapshot, strengere
slettings-SLO, sikkerhetshendelse eller overskridelse av ADR 0005 sine
kapasitetsgrenser.
