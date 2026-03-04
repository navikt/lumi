# lumi-submission-proxy

Lettvekts-proxy som brukes **kun i dev-gcp** for å brygge
survey-innsendinger på tvers av Azure AD-tenants.

## Hvorfor?

I dev bruker Modia-apper (f.eks. syfomodiaperson) tenanten `trygdeetaten.no`,
mens lumi-dashboard og lumi-api bruker `nav.no` slik at utviklere kan logge inn
med sine personlige brukere og NAIS Teams-oppslag fungerer.

Azure AD OBO-tokens kan ikke krysse tenantgrenser. Proxyen løser dette ved å
leve i `trygdeetaten.no` (samme tenant som Modia), validere OBO-tokenet via
NAIS Texas-introspeksjon, og videresende innholdet til lumi-api over et
PSK-beskyttet internt endepunkt.

## Arkitektur (dev)

```
Modia (trygdeetaten.no) → OBO → proxy (trygdeetaten.no) → PSK → lumi-api (nav.no) → DB
```

I prod eksisterer ikke proxyen — Modia kaller lumi-api direkte (begge på `nav.no`).

## Kjøring

Proxyen deployes automatisk til dev-gcp via `.github/workflows/deploy-proxy.yaml`.
Den har ingen prod-deployment.
