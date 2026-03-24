import { Box, Heading, VStack } from "@navikt/ds-react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { FeedbackTable } from "~/components/feedback/FeedbackTable";
import { ActiveFiltersChips } from "~/components/shared/ActiveFiltersChips";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { searchSchema } from "~/schemas/searchSchema";

export const Route = createFileRoute("/feedback")({
  validateSearch: zodValidator(searchSchema),
  component: FeedbackPage,
});

function FeedbackPage() {
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
          <Heading size="large">Tilbakemeldinger</Heading>
          <FilterBar showDetails />
          <ActiveFiltersChips />
          <FeedbackTable />
        </VStack>
      </Box>
    </>
  );
}
