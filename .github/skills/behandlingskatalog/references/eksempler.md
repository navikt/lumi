# Eksempler: Umami og Skyra som referanse

Umami (B889) og Skyra (B882) er de nærmeste sammenligningspunktene for Lumi i Behandlingskatalogen. Begge er innsiktsverktøy med samtykke som behandlingsgrunnlag.

## Umami B889

```
Tittel:      Innsiktsarbeid: Måling av data til innsiktsformål med Umami
             på eksterne flater
Nummer:      B889
Formål:      Skaffe innsikt om hvordan Nav.no og øvrige subdomener anvendes
             av brukerne slik at vi kan lage mer brukervennlige nettsider.
             Konkrete formål dokumenteres i etterlevelse E458.
Grunnlag:    Art. 6(1)(a) – Samtykke
Kategorier:  Ansatte i NAV, Bruker, Besøkende
Organisering: Avdeling for brukeropplevelser, Team ResearchOps
System:      Umami
Databehandler: GCP, Aiven
PVK:         Uavklart
Status:      Under arbeid
```

### Hva Lumi kan lære av Umami

- **Tittelen** følger mønsteret «Innsiktsarbeid: [beskrivelse] med [verktøy]» — bruk samme mønster.
- **Formål** peker til etterlevelsesmal (E458 for Umami, E449 for Lumi) — godt grep for å unngå duplisering.
- **23 behandlinger** — Umami har én behandling per team som bruker verktøyet. For Lumi anbefaler vi å starte med én felles behandling fordi alle har samme formål og grunnlag.

### Forskjeller fra Lumi

| Felt | Umami | Lumi |
|------|-------|------|
| Databehandler | GCP + Aiven | Kun GCP |
| PII-håndtering | Proxy som vasker bort PII automatisk | Auto-maskering i API ved lagring og lesing |
| Fritekst | Skal ikke spores | Tillatt med auto-maskering |
| Cookies | Nei (men sesjons-ID) | Nei (ingen sesjons-ID) |
| Personkategorier | Ansatte, Bruker, Besøkende | Besøkende, Ansatte i NAV |
| Etterlevelse | E458 | E449 |

## Skyra B882

```
Tittel:      Innsiktsarbeid: Behandling av personopplysninger for
             toppoppgaveundersøkelser med SKYRA
Nummer:      B882
Formål:      Skaffe innsikt om nettbrukeres gjennomføringsgrad på nett.
             Konkrete formål dokumenteres i etterlevelse E449.
Grunnlag:    Art. 6(1)(a) – Samtykke
Kategorier:  Besøkende
Organisering: Avdeling for brukeropplevelser, Team ResearchOps
System:      Ikke utfylt
Databehandler: Skyra
PVK:         Nei (ingen særlige kategorier)
Status:      Ferdig dokumentert
```

### Hva Lumi kan lære av Skyra

- **Deler etterlevelsesmal** — E449 ble opprinnelig laget for Skyra og er kopiert og tilpasset for Lumi. Bruk samme referanse.
- **PVK = Nei** med tydelig begrunnelse — Lumi bør bruke samme argumentasjon.
- **Ferdig dokumentert** — Skyra er det eneste av de tre som er merket ferdig. Lumi bør sikte mot samme status.

### Forskjeller fra Lumi

| Felt | Skyra | Lumi |
|------|-------|------|
| System | Ikke utfylt (trolig glemt) | Lumi (allerede registrert) |
| Databehandler | Skyra (ekstern SaaS) | GCP (Nav-intern plattform) |
| PII-håndtering | Manuell daglig sjekk + filter | Automatisk maskering |
| Cookies | Ja | Nei |
| Fritekst-PII | Maks 50 tegn anbefalt + filter | Auto-maskering ved lagring og lesing |
| Organisering | ResearchOps | Team eSyfo |

## Samlet sammenligning

| Felt | Skyra B882 | Umami B889 | Lumi (anbefalt) |
|------|------------|------------|------------------|
| System | Ikke utfylt | Umami | Lumi |
| Databehandler | Skyra (ekstern) | GCP, Aiven | GCP |
| Personkategorier | Besøkende | Ansatte, Bruker, Besøkende | Besøkende, Ansatte i NAV |
| Organisering | ResearchOps | ResearchOps | Team eSyfo |
| PII-håndtering | Manuell sjekk + filter | Proxy med auto-vask | Auto-maskering i API |
| Cookies | Ja | Nei (men sesjons-ID) | Nei |
| PVK | Nei | Uavklart | Nei |
| Etterlevelse | E449 | E458 | E726 |
| Status | Ferdig dokumentert | Under arbeid | Mål: Ferdig dokumentert |

## Bruk denne sammenligningen til

1. **Kvalitetssikring** — sjekk at Lumis behandling dekker minst samme felt som Skyra (som er ferdig dokumentert).
2. **Konsistens** — følg navnekonvensjoner og formålsformuleringer fra Umami og Skyra.
3. **Forbedring** — Lumi har sterkere PII-beskyttelse enn begge. Fremhev auto-maskeringen i «Ytterligere beskrivelse».
