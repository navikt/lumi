import { Alert, BodyShort, Heading } from "@navikt/ds-react";

export function NotFoundComponent() {
  return (
    <Alert variant="info" className="m-4">
      <Heading spacing size="small" level="3">
        Siden finnes ikke
      </Heading>
      <BodyShort>Vi fant ikke siden du prøvde å åpne.</BodyShort>
    </Alert>
  );
}
