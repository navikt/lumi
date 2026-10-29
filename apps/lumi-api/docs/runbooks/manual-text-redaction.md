# Manuell maskering av fritekstsvar

Rull ut API-et før dashboardet får knappen for maskering. Alle API-replikaene
må bruke cachegenerasjonen fra V28 før knappen tas i bruk. Migreringen legger
til én cachegenerasjon per team i `feedback_redaction.team_state`. Den endrer
ingen eksisterende svar og lagrer ingen teksthistorikk eller aktører.

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

Teksten, teamets cachegenerasjon og bestillingen av en BigQuery-kjøring lagres
i samme transaksjon. Feiler ett av stegene, rulles alle
tilbake. En gammel statistikkberegning kan skrive til sin gamle cachegenerasjon,
men nye oppslag leser generasjonen fra databasen og bruker ikke den gamle
teksten. Dette gjelder også andre replikaer og lokal cache ved feil i Valkey.

Cachegenerasjonen beholdes når svar slettes, slik at gamle cachenøkler ikke
gjenbrukes. Ingen teksthistorikk eller angrefunksjon opprettes.

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
