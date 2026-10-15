import { Alert, BodyShort, Box, Heading, VStack } from "@navikt/ds-react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { ExportPanel } from "~/components/export/Panel";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { useTeamAccessDenied } from "~/hooks/useTeamAccessDenied";
import { searchSchema } from "~/schemas/searchSchema";
import { applyDashboardSearchDefaults } from "~/utils/dashboardSearchDefaults";

export const Route = createFileRoute("/export")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ location }) => {
    const defaults = applyDashboardSearchDefaults(
      location.search as Record<string, unknown> | undefined,
    );

    if (defaults.changed) {
      throw redirect({
        to: "/export",
        search: defaults.search,
        replace: true,
      });
    }
  },
  component: ExportPage,
});

function ExportPage() {
  // FilterBar explains why the team's data cannot be fetched.
  const teamAccessDenied = useTeamAccessDenied();

  return (
    <>
      <Header />

      <Box
        paddingBlock={{ xs: "space-16", md: "space-24" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        className="main-container"
        as="main"
      >
        <VStack gap="space-24">
          <Heading size="large" level="1">
            Eksporter data
          </Heading>

          <Box
            background="raised"
            borderWidth="1"
            borderColor="neutral-subtle"
            borderRadius="8"
            padding="space-20"
          >
            <Heading size="small" level="2" spacing>
              Klargjør data for faste analyser
            </Heading>
            <BodyShort spacing>
              Velg surveys og felt, se tabellformatet og opprett en kontrakt for
              senere levering til Metabase eller Datafortelling.
            </BodyShort>
            <Link
              to="/analyseprodukter"
              search={(previous) => ({ team: previous.team })}
            >
              Åpne analyseprodukter
            </Link>
          </Box>

          <FilterBar showDetails />

          <Alert variant="info" size="small">
            Eksporterte data vil automatisk ha sensitiv informasjon fjernet
            (fødselsnummer, e-post, telefonnummer osv.)
          </Alert>

          {teamAccessDenied ? null : <ExportPanel />}
        </VStack>
      </Box>
    </>
  );
}
