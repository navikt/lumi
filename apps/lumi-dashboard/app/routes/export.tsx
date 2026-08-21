import { Alert, Box, Heading, VStack } from "@navikt/ds-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { ExportPanel } from "~/components/export/Panel";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
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
          <Heading size="large">Eksporter data</Heading>

          <FilterBar showDetails />

          <Alert variant="info" size="small">
            Eksporterte data vil automatisk ha sensitiv informasjon fjernet
            (fødselsnummer, e-post, telefonnummer osv.)
          </Alert>

          <ExportPanel />
        </VStack>
      </Box>
    </>
  );
}
