import { Alert, Box, Button, Heading, HStack, VStack } from "@navikt/ds-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { NaisAuthDiagnosticsResponse } from "~/server/actions/fetchNaisAuthDiagnostics";
import { fetchNaisAuthDiagnosticsServerFn } from "~/server/actions/fetchNaisAuthDiagnostics";

export const Route = createFileRoute("/diagnostics/nais-auth")({
  component: NaisAuthDiagnosticsPage,
});

function NaisAuthDiagnosticsPage() {
  const diagnosticsQuery = useQuery({
    queryKey: ["nais-auth-diagnostics"],
    queryFn: () => fetchNaisAuthDiagnosticsServerFn(),
    staleTime: 0,
    gcTime: 0,
  });

  const diagnostics = diagnosticsQuery.data;

  return (
    <Box
      paddingBlock={{ xs: "space-16", md: "space-24" }}
      paddingInline={{ xs: "space-12", sm: "space-16" }}
      className="main-container"
      as="main"
    >
      <VStack gap="space-16">
        <HStack justify="space-between" align="center" wrap gap="space-8">
          <Heading size="large">NAIS auth diagnostics</Heading>
          <Button
            type="button"
            size="small"
            variant="secondary"
            loading={diagnosticsQuery.isFetching}
            onClick={() => diagnosticsQuery.refetch()}
          >
            Kjør på nytt
          </Button>
        </HStack>

        {diagnosticsQuery.error ? (
          <Alert variant="error" size="small">
            {diagnosticsQuery.error instanceof Error
              ? diagnosticsQuery.error.message
              : "Diagnostikk feilet"}
          </Alert>
        ) : null}

        {diagnostics ? <DiagnosticsSummary diagnostics={diagnostics} /> : null}

        <Box
          as="pre"
          background="neutral-soft"
          borderRadius="8"
          padding="space-16"
          style={{
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "0.875rem",
          }}
        >
          {diagnostics
            ? JSON.stringify(diagnostics, null, 2)
            : diagnosticsQuery.isPending
              ? "Laster..."
              : "Ingen data"}
        </Box>
      </VStack>
    </Box>
  );
}

function DiagnosticsSummary({
  diagnostics,
}: {
  diagnostics: NaisAuthDiagnosticsResponse;
}) {
  if (!diagnostics.enabled) {
    return (
      <Alert variant="warning" size="small">
        {diagnostics.message ?? "Diagnostikk er ikke aktivert"}
      </Alert>
    );
  }

  const entra = diagnostics.userTeamEntraGroups;
  const successfulMe = diagnostics.meTargets.find(
    (target) => target.me?.ok && target.me.typename === "User",
  );

  return (
    <VStack gap="space-8">
      <Alert variant={successfulMe ? "success" : "warning"} size="small">
        {successfulMe
          ? `NAIS API me svarte User for ${successfulMe.target}`
          : "Ingen testet OBO-target ga me=User"}
      </Alert>

      {entra ? (
        <Alert variant={entra.ok ? "info" : "warning"} size="small">
          {entra.ok
            ? `user(email) fant ${entra.teamCount ?? 0} team, ${entra.teamsMatchedByTokenGroups ?? 0} matcher Entra-grupper i tokenet`
            : entra.message}
        </Alert>
      ) : null}
    </VStack>
  );
}
