# Manuell maskering av fritekstsvar

Rull ut API-et før dashboardet får knappen for maskering. Alle API-replikaene
må bruke cachegenerasjonen fra V28 før knappen tas i bruk. Migreringen legger
til nøkkel og generasjon per team og et lite revisjonsspor i det private
skjemaet `feedback_redaction`. Den endrer ingen eksisterende svar.

## Hva maskeringen gjør

`POST /api/v1/intern/feedback/{id}/redact?team={team}` bruker samme
autentisering og teamtilgang som sletting. Team må oppgis. Kroppen har
`fieldId`, `expectedTextHash` og `ranges` med `start` og `end`.

Hashen er SHA-256 av teksten brukeren ser, kodet som UTF-8. Det inkluderer
maskeringen Lumi gjør ved lesing. Områdene bruker UTF-16-posisjoner, som i
nettleserens tekstmarkering, med sluttposisjonen utelatt. Overlapp og posisjoner
som deler et surrogatpar, avvises.

Under en radlås sjekkes teksten på nytt. En endring siden brukeren åpnet svaret
gir 409. Bare fritekst kan maskeres, og klienten kan ikke sende inn en ny
svartekst. Valgte områder erstattes med `[TEKST FJERNET]`.

Teksten, revisjonssporet, teamets cachegenerasjon og bestillingen av en
BigQuery-kjøring lagres i samme transaksjon. Feiler ett av stegene, rulles alle
tilbake. En gammel statistikkberegning kan skrive til sin gamle cachegenerasjon,
men nye oppslag leser generasjonen fra databasen og bruker ikke den gamle
teksten. Dette gjelder også andre replikaer og lokal cache ved feil i Valkey.

## Revisjonsspor og nøkkel

Revisjonssporet har tidspunkt, felt-ID, svar-ID og en HMAC av den autentiserte
aktøren. Det har ingen svartekst, markert tekst, teksthash eller rå Nav-ident.
Hvert team får en tilfeldig nøkkel på 32 byte ved første maskering. Nøkkelen
lagres i det private skjemaet og inngår ikke i API-svar, eksporter eller logger.
Den brede rollen `esyfo-analyse` og `PUBLIC` har ingen tilgang til skjemaet.

Revisjonsradene slettes med svaret, også ved automatisk retensjon. Teamets
nøkkel og cachegenerasjon beholdes, slik at gamle cachenøkler ikke gjenbrukes.
Ingen teksthistorikk eller angrefunksjon opprettes.

## Kopier og feilsituasjoner

- Nye søk og nedlastinger bruker den maskerte teksten.
- BigQuery oppdateres ved neste vellykkede kjøring. Pågående kjøringer og
  allerede innsendte jobber håndteres som ved sletting, se
  [BigQuery-runbooken](bigquery-export.md).
- Filer teamet allerede har lastet ned og kopier de har laget selv, må de
  rydde opp i selv. Eksisterende backup og BigQuery time travel følger sine
  vanlige lagringstider.
- Ved 409 må svaret lastes inn på nytt før brukeren markerer igjen. Ikke bruk
  gamle posisjoner på en ny tekst.
- Ved ukjent utfall eller avbrutt forbindelse: hent svaret på nytt før et nytt
  forsøk. En maskering kan være lagret selv om bekreftelsen ikke kom fram.

Undersøk feil med syntetiske svar. Ikke legg den opprinnelige teksten i
driftslogger eller en hendelsesbeskrivelse.
