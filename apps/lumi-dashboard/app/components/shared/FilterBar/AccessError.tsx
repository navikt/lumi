import {
  Link as AkselLink,
  Alert,
  BodyShort,
  HStack,
  VStack,
} from "@navikt/ds-react";
import { useQueryClient } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { safeHelpUrl } from "~/components/shared/ErrorComponent";
import { filterBootstrapQueryKey } from "~/hooks/useFilterBootstrap";
import type { ApiErrorException } from "~/types/errors";

const RouterLink = createLink(AkselLink);

const TEAM_ACCESS_HELP_URL =
  "https://navikt.github.io/lumi/dashboard/tilgang#teamtilgang";

interface AccessErrorProps {
  error: ApiErrorException;
  /** The team in the address, if any. */
  team?: string;
  query: Parameters<typeof DataFetchBoundary>[0]["queries"][number];
}

/**
 * Explains a failed bootstrap with the API's message, details and help link.
 * The texts belong to the API. Only a refused team in the address and an
 * expired login get the dashboard's own text.
 */
export function AccessError({ error, team, query }: AccessErrorProps) {
  const queryClient = useQueryClient();
  const { status, message, details, helpUrl } = error.error;

  if (team && status === 403 && message === refusedTeamMessage(team)) {
    return (
      <Alert variant="warning" role="alert">
        <VStack gap="space-8" align="start">
          <BodyShort weight="semibold">
            Du har ikke tilgang til team «{team}».
          </BodyShort>
          <BodyShort size="small">
            Du må være medlem av teamet i Nais Console for å se dataene.
          </BodyShort>
          <HStack gap="space-16" wrap>
            {/* Without search params the root route adds the default team. */}
            <RouterLink to="." search={{}}>
              Gå til standardteamet
            </RouterLink>
            <AkselLink href={TEAM_ACCESS_HELP_URL}>
              Les mer om tilgang
            </AkselLink>
          </HStack>
        </VStack>
      </Alert>
    );
  }

  const helpLink = safeHelpUrl(helpUrl);
  const description: ReactNode =
    details || helpLink ? (
      <>
        {details}
        {details && helpLink ? " " : null}
        {helpLink ? (
          <AkselLink href={helpLink}>Les mer om tilgang</AkselLink>
        ) : null}
      </>
    ) : undefined;

  // The team lookup can come back, so keep the retry button.
  if (status === 503) {
    // The page's own queries failed with the same lookup while it was hidden.
    // Retry them in the same click, so the page does not show its own error
    // once the team access is back.
    const bootstrapKey = filterBootstrapQueryKey()[0];
    const retryAll = {
      error: query.error,
      isError: query.isError,
      isFetching: query.isFetching,
      refetch: async () => {
        const [result] = await Promise.all([
          query.refetch(),
          queryClient.refetchQueries({
            type: "active",
            predicate: (other) =>
              other.state.status === "error" &&
              other.queryKey[0] !== bootstrapKey,
          }),
        ]);
        return result;
      },
    };
    return (
      <DataFetchBoundary
        title={message}
        description={description}
        queries={[retryAll]}
      />
    );
  }

  return (
    <Alert variant="warning" role="alert">
      <VStack gap="space-8" align="start">
        <BodyShort weight="semibold">
          {status === 401 ? "Du er ikke logget inn" : message}
        </BodyShort>
        {status === 401 ? (
          <BodyShort size="small">
            Innloggingen har gått ut. Last siden på nytt.
          </BodyShort>
        ) : null}
        {description ? <BodyShort size="small">{description}</BodyShort> : null}
      </VStack>
    </Alert>
  );
}

/**
 * The API's message when it refuses the team in the address
 * (`TeamAuthorizationPlugin.kt`). Other 403s, such as a viewer without any
 * team, get the API's own message and no link.
 */
function refusedTeamMessage(team: string): string {
  return `Du har ikke tilgang til team: ${team}`;
}
