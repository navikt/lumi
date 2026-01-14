import { BodyShort, Box } from "@navikt/ds-react";

interface ChartEmptyStateProps {
  message: string;
  color: string;
}

export function ChartEmptyState({ message, color }: ChartEmptyStateProps) {
  return (
    <Box.New
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        textAlign: "center",
      }}
    >
      <BodyShort size="small">{message}</BodyShort>
    </Box.New>
  );
}
