import { BodyShort, Heading, HStack, Label, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import styles from "./FieldCardHeader.module.css";

export function FieldCardHeader({
  icon,
  label,
  subtitle,
  titleTestId,
  headingId,
}: {
  icon: ReactNode;
  label: string;
  subtitle: string;
  titleTestId: string;
  headingId?: string;
}) {
  return (
    <HStack gap="space-8" align="start" marginBlock="space-0 space-8">
      {icon}
      <VStack gap="space-0" className={styles.content}>
        {headingId ? (
          <Heading
            id={headingId}
            level="3"
            size="xsmall"
            className={styles.label}
            data-testid={titleTestId}
          >
            {label}
          </Heading>
        ) : (
          <Label
            size="small"
            className={styles.label}
            data-testid={titleTestId}
          >
            {label}
          </Label>
        )}
        <BodyShort size="small" className={styles.subtitle}>
          {subtitle}
        </BodyShort>
      </VStack>
    </HStack>
  );
}
