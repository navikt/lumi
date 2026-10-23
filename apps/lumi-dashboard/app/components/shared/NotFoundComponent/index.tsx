import { Alert, BodyShort, Box, Heading } from "@navikt/ds-react";

export function NotFoundComponent() {
  return (
    <Box
      as="main"
      paddingBlock={{ xs: "space-16", md: "space-24" }}
      paddingInline={{ xs: "space-12", sm: "space-16" }}
      className="main-container"
    >
      <Alert variant="info">
        <Heading spacing size="small" level="3">
          Siden finnes ikke
        </Heading>
        <BodyShort>Vi fant ikke siden du prøvde å åpne.</BodyShort>
      </Alert>
    </Box>
  );
}
