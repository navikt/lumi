import { BodyLong, Heading, VStack } from "@navikt/ds-react";
import React from "react";

interface SuccessContentProps {
  title: string;
  body: React.ReactNode;
  showTitle?: boolean;
  announce?: boolean;
}

export const SuccessContent = React.memo(
  ({ title, body, showTitle = true, announce = true }: SuccessContentProps) => {
    const accessibilityProps = announce
      ? { role: "status" as const, "aria-live": "polite" as const }
      : {};

    return (
      <VStack gap="space-12" {...accessibilityProps}>
        {showTitle && (
          <Heading level="2" size="small">
            {title}
          </Heading>
        )}
        {body && <BodyLong>{body}</BodyLong>}
      </VStack>
    );
  },
);

SuccessContent.displayName = "SuccessContent";
