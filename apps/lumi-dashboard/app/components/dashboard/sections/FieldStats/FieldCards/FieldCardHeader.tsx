import { BodyShort, HStack, Label, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import styles from "./FieldCardHeader.module.css";

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
      <VStack gap="space-0" className={styles.content}>
        <Label size="small" className={styles.label} data-testid={titleTestId}>
          {label}
        </Label>
        <BodyShort size="small" className={styles.subtitle}>
          {subtitle}
        </BodyShort>
      </VStack>
    </HStack>
  );
}
