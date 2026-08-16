import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  Heading,
  HStack,
  Loader,
  Select,
  Tag,
  TextField,
  VStack,
} from "@navikt/ds-react";
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  createSurveyAuthoringProjectServerFn,
  fetchSurveyAuthoringProjectsServerFn,
  fetchTeamsServerFn,
} from "~/server/actions";
import { suggestSurveyId } from "~/utils/surveyDocument";
import styles from "./surveyverksted.module.css";

const searchSchema = z.object({ team: z.string().optional() });

function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(value));
}

const initialDocument: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "opplevelse",
      title: "Fortell om opplevelsen",
      questions: [
        {
          id: "rating",
          type: "rating",
          prompt: "Hvordan opplevde du tjenesten?",
          required: true,
        },
        {
          id: "kommentar",
          type: "text",
          prompt: "Hva kan vi gjøre bedre?",
          required: false,
          maxLength: 1000,
          minRows: 4,
        },
      ],
    },
  ],
};

export const Route = createFileRoute("/surveyverksted/")({
  validateSearch: zodValidator(searchSchema),
  component: SurveyWorkshopIndex,
});

function SurveyWorkshopIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [surveyId, setSurveyId] = useState("");
  const [surveyIdTouched, setSurveyIdTouched] = useState(false);

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeamsServerFn(),
  });
  const availableTeams = useMemo(
    () => Object.keys(teamsQuery.data?.teams ?? {}).sort(),
    [teamsQuery.data],
  );
  const selectedTeam =
    search.team && availableTeams.includes(search.team)
      ? search.team
      : availableTeams[0];

  const projectsQuery = useQuery({
    queryKey: ["survey-authoring-projects", selectedTeam],
    queryFn: () => {
      if (!selectedTeam) throw new Error("No authorized team selected");
      return fetchSurveyAuthoringProjectsServerFn({
        data: { team: selectedTeam },
      });
    },
    enabled: Boolean(selectedTeam),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedTeam) throw new Error("No authorized team selected");
      return createSurveyAuthoringProjectServerFn({
        data: {
          team: selectedTeam,
          name,
          surveyId,
          document: initialDocument,
        },
      });
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({
        queryKey: ["survey-authoring-projects", selectedTeam],
      });
      await navigate({
        to: "/surveyverksted/$projectId",
        params: { projectId: project.id },
        search: { team: selectedTeam },
      });
    },
  });

  const canCreate = Boolean(selectedTeam && name.trim() && surveyId.trim());

  return (
    <Box
      as="main"
      paddingInline={{ xs: "space-12", sm: "space-16" }}
      paddingBlock={{ xs: "space-24", md: "space-40" }}
      className="main-container"
    >
      <VStack gap="space-32">
        <div className={styles.masthead}>
          <VStack gap="space-8" className={styles.mastheadText}>
            <div>
              <Tag variant="info" size="small">
                Survey as code
              </Tag>
            </div>
            <Heading size="xlarge" level="1">
              Surveyverksted
            </Heading>
            <BodyLong size="large">
              Formuler og prøv ut en survey sammen. Utkastet lagres for teamet,
              men blir ikke produksjonskonfigurasjon før koden senere tas inn i
              en app.
            </BodyLong>
          </VStack>
          <div aria-hidden className={styles.mastheadMark}>
            01
          </div>
        </div>

        {teamsQuery.isPending ? (
          <HStack gap="space-8" align="center">
            <Loader size="small" title="Henter team" />
            <BodyShort>Henter team …</BodyShort>
          </HStack>
        ) : teamsQuery.isError || availableTeams.length === 0 ? (
          <Alert variant="error">
            Fant ingen team du kan opprette utkast for.
          </Alert>
        ) : (
          <div className={styles.workshopGrid}>
            <Box
              background="raised"
              borderRadius="12"
              borderWidth="1"
              borderColor="neutral-subtle"
              padding={{ xs: "space-16", md: "space-24" }}
            >
              <VStack gap="space-20">
                <div>
                  <Heading size="medium" level="2" spacing>
                    Start et utkast
                  </Heading>
                  <BodyShort textColor="subtle">
                    Du starter med én side, et vurderingsspørsmål og et åpent
                    oppfølgingsspørsmål.
                  </BodyShort>
                </div>
                <Select
                  label="Team"
                  value={selectedTeam}
                  onChange={(event) =>
                    navigate({
                      search: { team: event.target.value },
                      replace: true,
                    })
                  }
                >
                  {availableTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
                <TextField
                  label="Navn på utkastet"
                  value={name}
                  maxLength={120}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!surveyIdTouched) {
                      setSurveyId(suggestSurveyId(event.target.value));
                    }
                  }}
                  placeholder="For eksempel: Kvitteringsside høst 2026"
                />
                <TextField
                  label="Foreslått survey-ID"
                  description="Identiteten utvikleren senere tar stilling til i kode. Foreslås fra navnet."
                  value={surveyId}
                  maxLength={200}
                  onChange={(event) => {
                    setSurveyIdTouched(true);
                    setSurveyId(event.target.value);
                  }}
                  placeholder="min-app-kvittering-v1"
                />
                {surveyId.trim() &&
                projectsQuery.data?.some(
                  (project) => project.surveyId === surveyId.trim(),
                ) ? (
                  <Alert variant="warning" size="small">
                    Et annet utkast i teamet bruker allerede denne survey-ID-en.
                  </Alert>
                ) : null}
                {createMutation.isError ? (
                  <Alert variant="error">
                    Utkastet kunne ikke opprettes. Prøv igjen.
                  </Alert>
                ) : null}
                <Button
                  type="button"
                  disabled={!canCreate}
                  loading={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  Opprett utkast
                </Button>
              </VStack>
            </Box>

            <VStack gap="space-16">
              <HStack justify="space-between" align="end" gap="space-8">
                <div>
                  <Heading size="medium" level="2">
                    Teamets utkast
                  </Heading>
                  <BodyShort textColor="subtle">{selectedTeam}</BodyShort>
                </div>
                <Tag variant="neutral" size="small">
                  {projectsQuery.data?.length ?? 0} utkast
                </Tag>
              </HStack>

              {projectsQuery.isPending ? (
                <Box padding="space-24" className={styles.emptyState}>
                  <Loader title="Henter utkast" />
                </Box>
              ) : projectsQuery.isError ? (
                <Alert variant="error">Utkastene kunne ikke hentes.</Alert>
              ) : projectsQuery.data?.length ? (
                <VStack gap="space-8" as="ul" className={styles.projectList}>
                  {projectsQuery.data.map((project) => (
                    <li key={project.id}>
                      <Link
                        to="/surveyverksted/$projectId"
                        params={{ projectId: project.id }}
                        search={{ team: selectedTeam }}
                        className={styles.projectLink}
                      >
                        <div>
                          <Heading size="small" level="3">
                            {project.name}
                          </Heading>
                          <BodyShort
                            size="small"
                            textColor="subtle"
                            className={styles.projectId}
                          >
                            {project.surveyId}
                          </BodyShort>
                        </div>
                        <BodyShort
                          size="small"
                          textColor="subtle"
                          className={styles.projectMeta}
                        >
                          Sist endret {formatProjectDate(project.updatedAt)}
                        </BodyShort>
                      </Link>
                    </li>
                  ))}
                </VStack>
              ) : (
                <Box
                  padding={{ xs: "space-24", md: "space-32" }}
                  className={styles.emptyState}
                >
                  <Heading size="small" level="3" spacing>
                    Ingen utkast ennå
                  </Heading>
                  <BodyShort textColor="subtle">
                    Opprett det første til venstre. Det blir tilgjengelig for
                    teamet også neste gang dere fortsetter.
                  </BodyShort>
                </Box>
              )}
            </VStack>
          </div>
        )}
      </VStack>
    </Box>
  );
}
