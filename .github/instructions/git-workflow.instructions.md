---
description: "Git-arbeidsflyt — brancher, PR, lint-verifisering før push"
applyTo: "**/*"
---

# Git Workflow

## Branch-strategi

- **Aldri push direkte til `main`** — opprett alltid en feature-branch
- Branch-navn: `type/kort-beskrivelse` (f.eks. `chore/update-deps`, `fix/auth-bug`, `feat/export-csv`)
- Typer: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`

## Før push

Kjør alltid disse **før** du pusher til remote:

```sh
npm run lint        # Biome — ingen errors tillatt
npm run typecheck   # tsc — ingen errors tillatt
npm test            # Vitest — alle tester må passere
```

For backend-endringer, kjør også:

```sh
npm run api:test    # Kotlin/Ktor-tester
```

## Pull requests

- Opprett alltid en PR mot `main` — bruk `gh pr create`
- Bruk `pull-request`-skillen for PR-format og semantisk tittel
- Inkluder `Closes #NUMMER` i PR-beskrivelsen når et issue er koblet
- **Ikke aktiver auto-merge** med mindre brukeren ber om det
- La merge queue og CI håndtere sammenslåing

## Boundaries

### ✅ Always

- Opprett feature-branch for alle endringer
- Kjør lint + typecheck + tester før push
- Opprett PR med beskrivende tittel og sjekkliste

### 🚫 Never

- Push direkte til `main`
- Push uten å verifisere at lint og typecheck passerer
- Aktiver auto-merge uten eksplisitt forespørsel fra brukeren
