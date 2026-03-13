import { BodyLong, Button, Heading, VStack } from "@navikt/ds-react";
import React from "react";

interface IntroContentProps {
  headingId: string;
  title: string;
  body?: React.ReactNode;
  startLabel: string;
  onStart: () => void;
  showTitle?: boolean;
}

export const IntroContent = React.memo(
  ({
    headingId,
    title,
    body,
    startLabel,
    onStart,
    showTitle = true,
  }: IntroContentProps) => {
    return (
      <VStack gap="space-12">
        {showTitle && (
          <Heading level="2" size="small" id={headingId}>
            {title}
          </Heading>
        )}
        {body && <BodyLong>{body}</BodyLong>}
        <Button type="button" onClick={onStart}>
          {startLabel}
        </Button>
      </VStack>
    );
  },
);

IntroContent.displayName = "IntroContent";
