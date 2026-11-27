import { BodyLong, Button, Heading, VStack } from "@navikt/ds-react";
import React from "react";
import { useSurveyHeadingLevel } from "../../shared/surveyHeadingLevel.js";
import { builtInCopyLang, useSurveyLang } from "../../shared/surveyLanguage.js";
import { CLASS_NAMES } from "../classNames.js";

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
    const headingLevel = useSurveyHeadingLevel();
    return (
      <VStack gap="space-12">
        {showTitle && (
          <Heading
            level={headingLevel}
            size="small"
            id={headingId}
            lang={surveyLang}
          >
            {title}
          </Heading>
        )}
        {body && <BodyLong lang={surveyLang}>{body}</BodyLong>}
        <Button
          type="button"
          className={CLASS_NAMES.introStart}
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
