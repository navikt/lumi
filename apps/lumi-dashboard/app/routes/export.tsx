import { Alert, Heading, VStack } from "@navikt/ds-react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { ExportPanel } from "~/components/export/Panel";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { searchSchema } from "~/schemas/searchSchema";

export const Route = createFileRoute("/export")({
  validateSearch: zodValidator(searchSchema),
  component: ExportPage,
});

function ExportPage() {
  return (
    <>
      <Header />

      <main className="main-content">
        <VStack gap="space-24">
          <Heading size="large">Eksporter data</Heading>

          <FilterBar showDetails />

          <Alert variant="info" size="small">
            Eksporterte data vil automatisk ha sensitiv informasjon fjernet
            (fødselsnummer, e-post, telefonnummer osv.)
          </Alert>

          <ExportPanel />
        </VStack>
      </main>
    </>
  );
}
