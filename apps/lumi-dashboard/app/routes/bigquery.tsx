import { ArrowLeftIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyLong,
  Box,
  Heading,
  Loader,
  Select,
  VStack,
} from "@navikt/ds-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { BigQueryExportView } from "~/components/bigQueryExport/BigQueryExportView";
import { Header } from "~/components/shared/Header";
import { fetchTeamsServerFn } from "~/server/actions/fetchTeams";

export const Route = createFileRoute("/bigquery")({
  validateSearch: zodValidator(z.object({ team: z.string().optional() })),
  component: BigQueryExportPage,
});

function BigQueryExportPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeamsServerFn(),
  });
  const availableTeams = Object.keys(teams.data?.teams ?? {}).sort();
  const team = search.team ?? availableTeams[0];
  const authorized = Boolean(team && availableTeams.includes(team));

  return (
    <>
      <Header />
      <Box
        as="main"
        className="main-container"
        style={{ overflowWrap: "anywhere", maxWidth: "64rem" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        paddingBlock={{ xs: "space-24", md: "space-40" }}
      >
        <VStack gap="space-24">
          <Link to="/export" search={team ? { team } : {}}>
            <ArrowLeftIcon aria-hidden /> Til eksport
          </Link>
          <div>
            <Heading level="1" size="xlarge" spacing>
              BigQuery og Metabase
            </Heading>
            <BodyLong>
              Lumi legger en kopi av teamets svar i et BigQuery-datasett i
              teamets eget GCP-prosjekt og oppdaterer den hver natt. Derfra kan
              dere dele dataene på Datamarkedsplassen og bruke dem i Metabase og
              datafortellinger.
            </BodyLong>
          </div>
          {teams.isPending ? (
            <Loader title="Henter team" />
          ) : teams.isError || !availableTeams.length ? (
            <Alert variant="error">Kunne ikke hente teamene dine.</Alert>
          ) : (
            <>
              {availableTeams.length > 1 || !authorized ? (
                <Select
                  label="Team"
                  value={authorized ? team : ""}
                  onChange={(event) =>
                    navigate({ search: { team: event.target.value } })
                  }
                  style={{ maxWidth: "24rem" }}
                >
                  {!authorized && (
                    <option value="" disabled>
                      Velg et tilgjengelig team
                    </option>
                  )}
                  {availableTeams.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              ) : null}
              {!authorized || !team ? (
                <Alert variant="error">
                  Teamet i lenken er ikke tilgjengelig for deg. Ingen data er
                  hentet for dette teamet.
                </Alert>
              ) : (
                <BigQueryExportView key={team} team={team} />
              )}
            </>
          )}
        </VStack>
      </Box>
    </>
  );
}
