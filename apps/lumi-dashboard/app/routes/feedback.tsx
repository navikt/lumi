import { Box, Heading, VStack } from "@navikt/ds-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { FeedbackTable } from "~/components/feedback/FeedbackTable";
import { ActiveFiltersChips } from "~/components/shared/ActiveFiltersChips";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { searchSchema } from "~/schemas/searchSchema";
import { applyDashboardSearchDefaults } from "~/utils/dashboardSearchDefaults";

export const Route = createFileRoute("/feedback")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ location }) => {
    const defaults = applyDashboardSearchDefaults(
      location.search as Record<string, unknown> | undefined,
    );

    if (defaults.changed) {
      throw redirect({
        to: "/feedback",
        search: defaults.search,
        replace: true,
      });
    }
  },
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
