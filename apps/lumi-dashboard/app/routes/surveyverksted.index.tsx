import {
  MenuElipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  ActionMenu,
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
import {
  createDiscoverySurveyDocument,
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  type SurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { DeleteDraftDialog } from "~/components/surveyverksted/DeleteDraftDialog";
import {
  createSurveyAuthoringProjectServerFn,
  deleteSurveyAuthoringProjectServerFn,
  fetchSurveyAuthoringProjectsServerFn,
  fetchTeamsServerFn,
} from "~/server/actions";
import type {
  SurveyAuthoringLatestRevision,
  SurveyAuthoringProjectSummary,
  SurveyAuthoringRevisionDetail,
} from "~/types/surveyAuthoring";
import {
  SURVEY_TEMPLATE_PLACEHOLDER_LABELS,
  SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
  suggestSurveyId,
} from "~/utils/surveyDocument";
import styles from "./surveyverksted.module.css";

const searchSchema = z.object({ team: z.string().optional() });

function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(value));
}

/**
 * Where a survey is in its life: never shared, shared and unchanged since,
 * or shared with newer edits waiting in the draft. The draft version the
 * revision was frozen from is the only state needed to tell the last two
 * apart.
 */
type ProjectStatus =
  | { kind: "draft" }
  | {
      kind: "shared" | "shared-with-changes";
      revision: SurveyAuthoringLatestRevision;
    };

function projectStatus(project: SurveyAuthoringProjectSummary): ProjectStatus {
  const revision = project.latestRevision;
  if (!revision) return { kind: "draft" };
  return {
    kind:
      project.draftVersion > revision.draftVersion
        ? "shared-with-changes"
        : "shared",
    revision,
  };
}

function ProjectCardBody({
  project,
  status,
}: {
  project: SurveyAuthoringProjectSummary;
  status: ProjectStatus;
}) {
  return (
    <>
      <div>
        <Heading size="small" level="3">
          {project.name}
        </Heading>
        <BodyShort size="small" textColor="subtle" className={styles.projectId}>
          {project.surveyId}
        </BodyShort>
        <div className={styles.projectStatus}>
          {status.kind === "draft" ? (
            <Tag variant="neutral" size="xsmall">
              Utkast
            </Tag>
          ) : (
            <Tag variant="success" size="xsmall">
              Delt · versjon {status.revision.revisionNumber}
            </Tag>
          )}
          {status.kind === "shared-with-changes" ? (
            <Tag variant="warning" size="xsmall">
              Utkastet har nye endringer
            </Tag>
          ) : null}
        </div>
      </div>
      <BodyShort size="small" textColor="subtle" className={styles.projectMeta}>
        {status.kind === "draft"
          ? `Sist endret ${formatProjectDate(project.updatedAt)}`
          : `Delt ${formatProjectDate(status.revision.createdAt)}`}
      </BodyShort>
    </>
  );
}

/*
 * Templates teach the supported analysis shapes without exposing field IDs
 * or transport details in the creation flow.
 */
type SurveyTemplateId =
  | "rating"
  | "discovery"
  | "topTasks"
  | "taskPriority"
  | "custom";

const surveyTemplates: Record<
  SurveyTemplateId,
  { label: string; description: string; create: () => SurveyDocumentV1 }
> = {
  rating: {
    label: "Hvordan opplevde brukeren tjenesten?",
    description:
      "Starter med en vurdering og et valgfritt oppfølgingsspørsmål.",
    create: () => ({
      authoringSchemaVersion: 1,
      type: "rating",
      pages: [
        {
          id: "opplevelse",
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
              visibleIf: { questionId: "rating", operator: "EXISTS" },
            },
          ],
        },
      ],
    }),
  },
  discovery: {
    label: "Hva kom brukeren for å gjøre?",
    description:
      "Finner oppgaven, om brukeren lyktes og hva som eventuelt hindret hen.",
    create: () => createDiscoverySurveyDocument(),
  },
  topTasks: {
    label: "Lyktes brukeren med en kjent oppgave?",
    description:
      "Måler resultatet for en liste med oppgaver dere kjenner på forhånd.",
    create: () =>
      createTopTasksSurveyDocument({
        tasks: [
          {
            value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[0],
          },
        ],
        includeOtherTask: true,
      }),
  },
  taskPriority: {
    label: "Hvilke oppgaver er viktigst?",
    description:
      "Lar brukerne velge de viktigste oppgavene fra en liste dere lager.",
    create: () =>
      createTaskPrioritySurveyDocument({
        tasks: [
          {
            value: `${SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE}-1`,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[1],
          },
          {
            value: `${SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE}-2`,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[2],
          },
        ],
      }),
  },
  custom: {
    label: "Noe annet",
    description: "Starter med ett åpent spørsmål uten en fast analyse.",
    create: () => ({
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "sporsmal",
          questions: [
            {
              id: "sporsmal",
              type: "text",
              prompt: "Hva vil dere spørre om?",
              required: true,
              maxLength: 1000,
              minRows: 4,
            },
          ],
        },
      ],
    }),
  },
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
  const [templateId, setTemplateId] = useState<SurveyTemplateId>("rating");

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
          document: surveyTemplates[templateId].create(),
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

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const projectsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  // Set on successful deletion: the dialog's close event runs AFTER the
  // native focus restore (whose target is gone with the card), so the
  // replacement focus must be applied there, not in onSuccess.
  const focusListAfterCloseRef = useRef(false);
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!selectedTeam) throw new Error("No authorized team selected");
      try {
        await deleteSurveyAuthoringProjectServerFn({
          data: { team: selectedTeam, projectId },
        });
      } catch (error) {
        // A concurrent delete already reached the desired end state —
        // converge instead of offering an impossible retry.
        const alreadyGone =
          error instanceof Error &&
          error.message.includes("Survey project not found");
        if (!alreadyGone) throw error;
      }
    },
    onSuccess: async (_result, projectId) => {
      // Evict everything scoped to the project so stale caches can never
      // reopen a deleted draft or revision in this tab.
      queryClient.removeQueries({
        queryKey: ["survey-authoring-project", selectedTeam, projectId],
      });
      queryClient.removeQueries({
        queryKey: ["survey-authoring-revisions", selectedTeam, projectId],
      });
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "survey-authoring-revision" &&
          (query.state.data as SurveyAuthoringRevisionDetail | undefined)
            ?.revision.projectId === projectId,
      });
      await queryClient.invalidateQueries({
        queryKey: ["survey-authoring-projects", selectedTeam],
      });
      focusListAfterCloseRef.current = true;
      setDeleteTarget(null);
    },
  });

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
          <div
            aria-hidden
            data-a11y-decorative="survey-workshop-masthead-mark"
            className={styles.mastheadMark}
          >
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
                    Velg det dere vil finne ut. Dere kan tilpasse sider,
                    spørsmål og tekst etterpå.
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
                <Select
                  label="Hva vil dere finne ut?"
                  description={surveyTemplates[templateId].description}
                  value={templateId}
                  onChange={(event) =>
                    setTemplateId(event.target.value as SurveyTemplateId)
                  }
                >
                  {Object.entries(surveyTemplates).map(([value, template]) => (
                    <option key={value} value={value}>
                      {template.label}
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
                    En annen survey i teamet bruker allerede denne survey-ID-en.
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
                  <Heading
                    size="medium"
                    level="2"
                    ref={projectsHeadingRef}
                    tabIndex={-1}
                  >
                    Teamets surveys
                  </Heading>
                  <BodyShort textColor="subtle">{selectedTeam}</BodyShort>
                </div>
                <Tag variant="neutral" size="small">
                  {projectsQuery.data?.length ?? 0}{" "}
                  {projectsQuery.data?.length === 1 ? "survey" : "surveys"}
                </Tag>
              </HStack>

              {projectsQuery.isPending ? (
                <Box padding="space-24" className={styles.emptyState}>
                  <Loader title="Henter surveys" />
                </Box>
              ) : projectsQuery.isError ? (
                <Alert variant="error">Surveyene kunne ikke hentes.</Alert>
              ) : projectsQuery.data?.length ? (
                <VStack gap="space-8" as="ul" className={styles.projectList}>
                  {projectsQuery.data.map((project) => {
                    const status = projectStatus(project);
                    // One row per survey: a shared survey opens on the
                    // stable version the developer has; the draft stays a
                    // click away in the menu and on the version page.
                    const primaryLink =
                      status.kind === "draft" ? (
                        <Link
                          to="/surveyverksted/$projectId"
                          params={{ projectId: project.id }}
                          search={{ team: selectedTeam }}
                          className={styles.projectLink}
                        >
                          <ProjectCardBody project={project} status={status} />
                        </Link>
                      ) : (
                        <Link
                          to="/surveyverksted/revisions/$revisionId"
                          params={{ revisionId: status.revision.id }}
                          search={{ team: selectedTeam }}
                          className={styles.projectLink}
                        >
                          <ProjectCardBody project={project} status={status} />
                        </Link>
                      );
                    return (
                      <li key={project.id} className={styles.projectItem}>
                        {primaryLink}
                        <ActionMenu>
                          <ActionMenu.Trigger>
                            <Button
                              type="button"
                              variant="tertiary-neutral"
                              size="small"
                              className={styles.projectMenu}
                              icon={<MenuElipsisVerticalIcon aria-hidden />}
                              aria-label={`Handlinger for ${project.name} (${project.surveyId})`}
                            />
                          </ActionMenu.Trigger>
                          <ActionMenu.Content align="end">
                            {status.kind !== "draft" ? (
                              <ActionMenu.Item
                                icon={<PencilIcon aria-hidden />}
                                onSelect={() =>
                                  navigate({
                                    to: "/surveyverksted/$projectId",
                                    params: { projectId: project.id },
                                    search: { team: selectedTeam },
                                  })
                                }
                              >
                                Rediger utkastet
                              </ActionMenu.Item>
                            ) : null}
                            <ActionMenu.Item
                              variant="danger"
                              icon={<TrashIcon aria-hidden />}
                              onSelect={() => {
                                deleteMutation.reset();
                                setDeleteTarget({
                                  id: project.id,
                                  name: project.name,
                                });
                              }}
                            >
                              Slett survey
                            </ActionMenu.Item>
                          </ActionMenu.Content>
                        </ActionMenu>
                      </li>
                    );
                  })}
                </VStack>
              ) : (
                <Box
                  padding={{ xs: "space-24", md: "space-32" }}
                  className={styles.emptyState}
                >
                  <Heading size="small" level="3" spacing>
                    Ingen surveys ennå
                  </Heading>
                  <BodyShort textColor="subtle">
                    Start den første til venstre. Den blir tilgjengelig for
                    teamet også neste gang dere fortsetter.
                  </BodyShort>
                </Box>
              )}
            </VStack>
          </div>
        )}
      </VStack>
      <DeleteDraftDialog
        name={deleteTarget?.name ?? null}
        isPending={deleteMutation.isPending}
        showError={deleteMutation.isError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onClose={() => {
          if (deleteMutation.isPending) return;
          setDeleteTarget(null);
          if (focusListAfterCloseRef.current) {
            focusListAfterCloseRef.current = false;
            projectsHeadingRef.current?.focus();
          }
        }}
      />
    </Box>
  );
}
