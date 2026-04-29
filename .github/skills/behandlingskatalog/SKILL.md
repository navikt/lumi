---
name: behandlingskatalog
description: "Registrer og oppdater Lumi i Navs Behandlingskatalog — strukturvalg (én vs. flere behandlinger), felt-for-felt utfylling med tekstutkast, og ansvarsdeling mellom systemeier og konsumerende team. Brukes via /behandlingskatalog ved opprettelse eller endring av behandlinger for Lumi."
---

# Behandlingskatalog — registrer Lumi

Hjelper med å opprette og vedlikeholde behandlingsaktiviteter for Lumi i [behandlingskatalog.ansatt.nav.no](https://behandlingskatalog.ansatt.nav.no).

## Arbeidsflyt

### 1. Velg struktur

Avklar om Lumi trenger én eller flere behandlinger:

| Kriterium | Lumis situasjon | Konsekvens |
|-----------|-----------------|------------|
| Ulikt formål? | Nei — alltid innsikt/forbedring | Ingen grunn til å splitte |
| Ulikt behandlingsgrunnlag? | Nei — alltid samtykke (art. 6(1)(a)) | Ingen grunn til å splitte |
| Helautomatisert vs. manuell? | Nei — ingen helautomatisering | Ingen grunn til å splitte |

**Anbefaling:** Start med **én behandling** eid av team eSyfo. Konsumerende team refererer til Lumi-systemet i sine egne behandlinger og gjenbruker etterlevelsesmalen E449.

Umami har 23 behandlinger (én per team), men det er et organisatorisk valg — ikke et juridisk krav. Én behandling er enklere å vedlikeholde og dekker Lumis bruksmønster.

### 2. Fyll ut felt for felt

Bruk [felt-guiden](references/felt-guide.md) for hvert felt. Den inneholder ferdigskrevne tekstutkast tilpasset Lumi som du kan kopiere rett inn.

### 3. Registrer opplysningstyper

Etter at behandlingen er opprettet, legg inn opplysningstyper:

**Alltid innsamlet (automatisk):**
- Enhetstype (deviceType)
- Skjermstørrelse (viewport)
- Nettlesertype (userAgent)

**Valgfritt (opt-in per survey):**
- URL-sti (pathname — via `collectLocation`)
- Egendefinerte tags (lav kardinalitet)
- Debug-info (feilsøking)

**Potensielt via fritekst (overskuddsinformasjon, maskeres automatisk):**
- Fødselsnummer, Nav-ident, e-post, telefon, kortnummer, kontonummer

### 4. Avklar ansvar

| Oppgave | Hvem |
|---------|------|
| Opprette og vedlikeholde behandlingen i katalogen | Team eSyfo (systemeier) |
| Holde felt-verdier oppdatert ved endringer i Lumi | Team eSyfo |
| Gjenbruke etterlevelsesmal E449 for sin survey | Konsumerende team |
| Registrere Lumi som system i egen behandling (valgfritt) | Konsumerende team |
| Opprette egen behandling i katalogen (valgfritt) | Konsumerende team |
| Dokumentere formål og innhold i egen survey | Konsumerende team |

Konsumerende team *kan* opprette egne behandlinger, men det er ikke påkrevd så lenge team eSyfos behandling dekker bruken.

### 5. Kontroller mot eksempler

Se [eksempler](references/eksempler.md) for sammenligning med Umami B889 og Skyra B882 — nyttig for å verifisere at ingenting mangler.

## Vedlikehold

Oppdater behandlingen når:
- Lumi samler inn nye opplysningstyper
- PII-maskeringslogikken endres
- Nye integrasjoner legges til (databehandlere, tredjeland)
- Organisering endres (nytt team, ny avdeling)

## Referanser

- [Felt-guide med tekstutkast](references/felt-guide.md)
- [Eksempler: Umami og Skyra](references/eksempler.md)
- [Etterlevelse E449](https://etterlevelse.ansatt.nav.no/etterlevelse/E449)
- [Behandlingskatalogen](https://behandlingskatalog.ansatt.nav.no)
