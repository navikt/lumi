# Fra analyseutkast til første release

Denne delen er implementert i Lumi API. Den lagrer en validert datakontrakt,
men leverer **ikke** data til BigQuery, Metabase eller Datamarkedsplassen.
Ingen scheduler, connection, IAM-binding eller databasegrant aktiveres.

## API-flyt

Alle endepunktene ligger under `/api/v1/intern/analysis-products` og bruker
eksisterende autentisering og teamautorisasjon. `team` i query må være
autorisert; team og aktør kan aldri overstyres i request-body.

| Handling | Endepunkt | Resultat |
| --- | --- | --- |
| Opprett | `POST /` med `AnalysisProductDocumentV1` | Produkt og første utkast |
| Finn egne produkter | `GET /` | Bare autorisert team |
| Les produkt | `GET /{id}` | Produkt, status og eventuelt utkast |
| Les kilder | `GET /catalog` | Teamets kildekatalog |
| Rediger utkast | `PUT /{id}/draft` med `draftId`, `draftRevision`, `document` | Ny revisjon, gammel validering ugyldig |
| Forhåndsvis | `GET /{id}/preview` | Flatt schema, syntetiske eksempelrader og eventuelle blokkeringer |
| Lås kontrakt | `POST /{id}/releases` med bekreftelsen under | Immutable release, ikke dataleveranse |
| Les releaser | `GET /{id}/releases` | Teamavgrenset historikk |

Release-bekreftelsen inneholder bare feltene fra siste forhåndsvisning:

```json
{
  "draftId": "<draftId>",
  "draftRevision": 1,
  "documentHash": "<documentHash>",
  "catalogRevision": "<catalogRevision>",
  "publicationSpecificationDigest": "<publicationSpecificationDigest>"
}
```

Klienten sender ikke SQL, destinasjon, publiseringsspesifikasjon eller
kildedata. Ukjente JSON-felt avvises, også inne i utkastdokumentet.
Bekreftelser er begrenset til 4 KiB. Utkast beholder eksisterende grense på
256 KiB etter normalisering, med 4 KiB ekstra rom i HTTP-requesten.

`AnalysisProductDocumentV1` er versjonen på produktkonfigurasjonen, ikke den
gamle survey-widgeten. Bare serverkompilerte `PublicationSpecificationV2`
lagres gjennom denne flyten. Upinnede/ukjente kildekontrakter blir aldri
gjettet. Forhåndsvisningen opplyser om historikk som utelates.

## Garantier

- Produktet låses før utkastet. Redigering, release og livsløpsendringer
  følger samme låsrekkefølge.
- Serveren leser kildekatalogen i én SQL-statement og kompilerer det lagrede
  utkastet på nytt i release-transaksjonen. Endrede fingeravtrykk krever ny
  forhåndsvisning. Kildeendringer etter dette tidspunktet må fortsatt
  kontrolleres av den fremtidige dataleveransen.
- Validering, release, versjonsøkning, audit og fjerning av det mutable
  utkastet committes samlet. Feil ruller alt tilbake.
- Samme bekreftelse kan prøves igjen etter et uklart HTTP-resultat. Den
  returnerer den samme releasen uten ny audit eller aktivering.
- En release endrer verken `desiredReleaseNumber`, `activeReleaseNumber`,
  effective generation eller livsløp. `RELEASE_PUBLISHED` i audit betyr her
  lagret kontrakt, ikke at data er publisert eksternt.
- Offboarding og slettede produkter tillater ikke nye utkastendringer eller
  releaser. Replay av en allerede lagret release kan bare lese historikk.
- Minst én kilde må velges. Tomt feltvalg på en valgt kilde betyr bevisst
  bare innsendinger og tillatte metadata, aldri «alle felt».

HTTP gir `201` for ny release, `200` ved replay, `409` ved endret bekreftelse
eller stengt livsløp, og `422` når kompileringen er blokkert. Uautoriserte
produkt-ID-er og ukjente ID-er får samme `404`-respons.

## Begrenset kontraktstørrelse

En release kan ha maksimalt **1 MiB serialisert UTF-8** og **10 000 effective
atomer**. Både forhåndsvisning, release-kompilering og effective-plan-resolver
håndhever grensene. Dette er konservative applikasjonsgrenser, ikke målt
BigQuery-/Cloud SQL-kapasitet eller fysisk JSONB-diskstørrelse.

Atombudsjettet teller source, valgt felt, definition, definition-felt, option,
flow, dependency og dimension. Det gjelder én release/projeksjon; en
generasjon med både vedlikeholdt og ønsket release kan inneholde to slike
projeksjoner. Eksisterende wide-kolonnegrenser gjelder i tillegg.

## Fortsatt gjenstående

Dette er API-flyten frem til **første release**, ikke ferdig selvbetjening.
Et nytt utkast fra en tidligere release, kontraktsdiff og dashboard-UI
gjenstår. UI-et må heller ikke presentere en lagret release som et aktivt
analyseprodukt.

Dataleveransen trenger fortsatt transport, sikre produktnøkler,
publiseringsfencing, slettesynk, overvåking og faktisk plattformverifisering.
Arkitekturavklaringene i [PR #577](https://github.com/navikt/lumi/pull/577)
er et separat spor; denne leveransen velger ingen sky-/bindingstopologi og
merger ikke disse beslutningene indirekte. Den gamle `esyfo-analyse`-tilgangen
forblir uendret.
