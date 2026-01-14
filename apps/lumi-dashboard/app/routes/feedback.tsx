import { Heading, VStack } from "@navikt/ds-react";
import { createFileRoute } from "@tanstack/react-router";
import { FeedbackTable } from "~/components/feedback/FeedbackTable";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <>
      <Header />

      <main className="main-content">
        <VStack gap="space-24">
          <Heading size="large">Tilbakemeldinger</Heading>
          <FilterBar showDetails />
          <FeedbackTable />
        </VStack>
      </main>
    </>
  );
}
