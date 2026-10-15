import { BodyLong, Button, Heading, VStack } from "@navikt/ds-react";
import React from "react";
import { builtInCopyLang, useSurveyLang } from "../../shared/surveyLanguage.js";

/** Matches the fallback in resolveConfig. */
const DEFAULT_START_LABEL = "Start";

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
    const surveyLang = useSurveyLang();
    return (
      <VStack gap="space-12">
        {showTitle && (
          <Heading level="2" size="small" id={headingId} lang={surveyLang}>
            {title}
          </Heading>
        )}
        {body && <BodyLong lang={surveyLang}>{body}</BodyLong>}
        <Button
          type="button"
          onClick={onStart}
          // A start label from the survey is survey text.
          lang={
            startLabel === DEFAULT_START_LABEL
              ? builtInCopyLang(true)
              : surveyLang
          }
        >
          {startLabel}
        </Button>
      </VStack>
    );
  },
);

IntroContent.displayName = "IntroContent";
