---
applyTo: "**/package.json,pnpm-lock.yaml,pnpm-workspace.yaml,apps/lumi-api/**/*.gradle.kts,apps/lumi-api/**/gradle-wrapper.properties,apps/lumi-submission-proxy/**/*.gradle.kts,apps/lumi-submission-proxy/**/gradle-wrapper.properties"
excludeAgent: "cloud-agent"
---

# Lumi checks for dependency updates

These checks add to `dependency-updates.instructions.md`.

- `@navikt/lumi-survey` is published and used outside this monorepo. Flag any
  update that changes its peer dependency ranges, bundled runtime dependencies
  or public build output.
- In `apps/lumi-api` and `apps/lumi-submission-proxy`, majors of Kotlin, Ktor,
  Exposed, Flyway, Kotest and Gradle often require code, migration or build
  changes. Check that the pull request makes them.
