# Lumi

Monorepo for Lumi survey analytics.

Lumi består av:

- **Survey widget**: React-widget som brukes i flater for å samle inn tilbakemeldinger.
- **API**: Tar imot submissions, lagrer data, og tilbyr analytics/endepunkter for dashboard.
- **Dashboard**: Admin-grensesnitt for å utforske data, filtrere, tagge og eksportere.

## Structure
- `apps/lumi-dashboard`: Admin dashboard (TanStack Start)
- `apps/lumi-api`: Backend API (Kotlin/Ktor)
- `packages/lumi-types`: Shared TypeScript types
- `packages/lumi-survey`: Survey widget package

## Integrasjon (for team)

Lumi skiller bevisst mellom submissions fra sluttbruker-flater (TokenX) og veileder/fagsystemer (AzureAD). Dette gjør feilsøking enklere og unngår at vi må "gjette" issuer.

Viktig: Survey-widgeten skal **ikke** poste direkte til `lumi-api` fra browser. Token exchange må gjøres server-side. Typisk flyt er:

1. Widget sender payload til din app/backend (f.eks. server action / API-route)
2. Backend kan validere payload (valgfritt, men anbefalt – f.eks. med Zod)
3. Backend gjør token exchange (TokenX/OBO eller AzureAD, avhengig av type flate)
4. Backend kaller `lumi-api`

### Sluttbruker-flater (TokenX)

- Endpoint: `POST /api/tokenx/v1/feedback`
- Auth: **TokenX**
- Caller-identitet: `client_id` (format `cluster:namespace:app`)

Bruk dette for f.eks. innloggede sluttbruker-flater (arbeidsgiver/privatperson) som allerede bruker TokenX.

### Veileder / fagsystem (AzureAD)

- Endpoint: `POST /api/azure/v1/feedback`
- Auth: **AzureAD**
- Caller-identitet: `azp_name` (format `cluster:namespace:app`)

Bruk dette for f.eks. Modia/veiledersystem. Submissions skal ikke lagre NAVident.

### Tilgang (Zero Trust)

For at din app skal kunne kalle Lumi API, må både din app og `lumi-api` ha riktige NAIS access policies (inbound/outbound). Se mer detaljer i `apps/lumi-api/README.md`.

## Kom i gang (lokal utvikling)

- Start dashboard: `npm run dev`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Backend-tester: `npm run api:test`

## Survey widget

- Widget og eksempler: `packages/lumi-survey/README.md`
- Release/publisering: `packages/lumi-survey/CONTRIBUTING.md`

## Migration status

This monorepo is the source of truth going forward.

Legacy Flexjar repositories are deprecated:
- `flexjar-analytics` → `apps/lumi-dashboard`
- `flexjar-analytics-api` → `apps/lumi-api`
- `flexjar-widget` → `packages/lumi-survey`

Shared types live in `packages/lumi-types` and are consumed by the dashboard and other internal code.

The survey widget (`packages/lumi-survey`) is intentionally self-contained (no dependency on internal workspace-only packages) so it can be published and installed externally without extra packages.

Note: The survey widget still uses the legacy NAV localStorage allowlist key pattern `flexjar-*` for consent-related persistence until a new pattern can be allowlisted.

## Common commands
- Dashboard: `npm run dev`
- Dashboard lint/typecheck: `npm run lint` / `npm run typecheck`

## Releasing

- `@navikt/lumi-survey`: see `packages/lumi-survey/CONTRIBUTING.md`

## Guardrails

- Verify that `@navikt/lumi-survey` stays publishable (no `@navikt/lumi-types` / `zod` leakage): `npm run verify:lumi-survey`
