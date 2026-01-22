import { BodyShort, HStack, Label, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";

export function FieldCardHeader({
  icon,
  label,
  subtitle,
  titleTestId,
}: {
  icon: ReactNode;
  label: string;
  subtitle: string;
  titleTestId: string;
}) {
  return (
    <HStack gap="space-8" align="start" marginBlock="space-0 space-8">
      {icon}
      <VStack gap="space-0" style={{ flex: 1 }}>
        <Label
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          data-testid={titleTestId}
        >
          {label}
        </Label>
        <BodyShort
          size="small"
          style={{ color: "var(--ax-text-neutral-subtle)" }}
        >
          {subtitle}
        </BodyShort>
      </VStack>
    </HStack>
  );
}
