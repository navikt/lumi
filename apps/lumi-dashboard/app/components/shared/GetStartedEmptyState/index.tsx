import {
  Link as AkselLink,
  Alert,
  BodyShort,
  Heading,
  VStack,
} from "@navikt/ds-react";
import { createLink } from "@tanstack/react-router";

export const GET_STARTED_URL =
  "https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi";

// Typed router link with Aksel styling, so `search` is checked against the route.
const RouterLink = createLink(AkselLink);

interface GetStartedEmptyStateProps {
  heading: string;
  /** What appears on this page once the team receives answers. */
  description: string;
  /** Selected team. Shown to the user and kept on the Surveyverksted link. */
  team?: string;
}

/**
 * Onboarding for a team without any answers yet. Points to the getting
 * started guide and to Surveyverksted, where the team creates its survey.
 */
export function GetStartedEmptyState({
  heading,
  description,
  team,
}: GetStartedEmptyStateProps) {
  return (
    <Alert variant="info">
      <VStack gap="space-8" align="start">
        <Heading size="xsmall" level="2">
          {heading}
        </Heading>
        {team && (
          <BodyShort>
            Valgt team: <strong>{team}</strong>
          </BodyShort>
        )}
        <BodyShort>{description}</BodyShort>
        <BodyShort>
          <AkselLink href={GET_STARTED_URL}>Kom i gang med Lumi</AkselLink>
        </BodyShort>
        <BodyShort>
          <RouterLink to="/surveyverksted" search={{ team }}>
            Lag en survey i Surveyverksted
          </RouterLink>
        </BodyShort>
      </VStack>
    </Alert>
  );
}
