import {
  Alert,
  BodyShort,
  Box,
  Detail,
  Heading,
  Loader,
  Tag,
} from "@navikt/ds-react";
import {
  LumiSurveyDock,
  LumiSurveyInline,
  type LumiSurveyTransport,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { surveyPreviewSearchSchema } from "~/schemas/surveyPreviewSearchSchema";
import { fetchSurveyAuthoringProjectServerFn } from "~/server/actions";
import { isDraftAnswer, withPresentation } from "~/types/surveyAuthoring";
import { fetchKeepingStatus } from "~/utils/serverFnFetch";
import {
  isDraftUnavailableError,
  isTransientFetchError,
} from "~/utils/surveyAuthoringErrors";
import { previewContextTags } from "~/utils/surveyRevision";
import styles from "./survey-preview.module.css";

const PREVIEW_ENVIRONMENT_TAG = "survey-workshop-preview";

const previewTransport: LumiSurveyTransport = {
  submit: async () => undefined,
};

export const Route = createFileRoute("/survey-preview")({
  validateSearch: surveyPreviewSearchSchema,
  component: SurveyPreview,
});

function SurveyPreview() {
  const { team, projectId, version } = Route.useSearch();

  if (!team || !projectId) {
    return <MissingSearchParams team={team} projectId={projectId} />;
  }

  return <DraftPreview team={team} projectId={projectId} version={version} />;
}

function MissingSearchParams({
  team,
  projectId,
}: {
  team?: string;
  projectId?: string;
}) {
  const missing = [!team && "team", !projectId && "projectId"]
    .filter(Boolean)
    .join(" og ");

  return (
    <Box as="main" className={styles.previewSurface}>
      <Alert variant="warning" className={styles.previewAlert}>
        <Heading spacing size="small" level="1">
          Forhåndsvisningen kan ikke vises
        </Heading>
        <BodyShort>
          Adressen mangler {missing}. Åpne surveyen i Surveyverksted og velg
          «Prøv i egen fane».
        </BodyShort>
      </Alert>
    </Box>
  );
}

function DraftPreview({
  team,
  projectId,
  version,
}: {
  team: string;
  projectId: string;
  version?: number;
}) {
  const projectQuery = useQuery({
    queryKey: ["survey-authoring-preview", team, projectId, version],
    queryFn: async () => {
      try {
        const answer = await fetchSurveyAuthoringProjectServerFn({
          data: { team, projectId },
          fetch: fetchKeepingStatus,
        });
        if (!isDraftAnswer(answer, team, projectId)) {
          throw new Error("Svaret er ikke utkastet");
        }
        // A server from before the display choice existed can answer while
        // a new version is rolled out. Its answer has no presentation.
        return { draft: withPresentation(answer), unavailable: false };
      } catch (error) {
        // Only a failure that can pass keeps the draft fetched before on
        // the screen. Any other failure replaces it, so that a later failure
        // that can pass does not bring it back.
        if (isTransientFetchError(error)) throw error;
        return { draft: null, unavailable: isDraftUnavailableError(error) };
      }
    },
    // The author edits in another tab. Coming back to this one shows what is
    // saved now.
    staleTime: 0,
  });
  const draftUnavailable = projectQuery.data?.unavailable === true;
  const project = projectQuery.data?.draft ?? undefined;

  const validation = useMemo(() => {
    if (!project) return null;
    try {
      return {
        document: validateSurveyDocumentV1(project.document),
        error: null,
      };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : "Ugyldig dokument",
      };
    }
  }, [project]);

  const presentation = project?.presentation;
  const placementNote = presentation?.placementNote?.trim();
  const success = validation?.document?.success?.title.trim()
    ? undefined
    : {
        title: "Slik ser kvitteringen ut",
        body: "Dette var bare en forhåndsvisning. Ingenting ble sendt inn.",
      };

  return (
    <Box
      as="main"
      className={styles.previewSurface}
      data-mode={presentation?.mode}
    >
      <div className={styles.previewMeta}>
        <Tag variant="warning" size="small">
          Forhåndsvisning
        </Tag>
        <BodyShort size="small">Svar sendes ikke eller lagres.</BodyShort>
      </div>

      {project?.presentationUnknown ? (
        <Alert variant="warning" size="small" className={styles.previewAlert}>
          Visningsvalget kunne ikke hentes, så forhåndsvisningen viser flytende
          panel. Last siden på nytt for å se valget.
        </Alert>
      ) : null}
      {/* The address holds the version the editor had saved. */}
      {project && version !== undefined && project.draftVersion !== version ? (
        <Alert variant="warning" size="small" className={styles.previewAlert}>
          Utkastet er lagret på nytt siden lenken til forhåndsvisningen ble
          laget, kanskje i en annen fane. Forhåndsvisningen viser det som er
          lagret nå.
        </Alert>
      ) : null}

      {/* A new fetch that fails in a way that can pass keeps what was fetched. */}
      {projectQuery.isError && project ? (
        <Alert variant="warning" size="small" className={styles.previewAlert}>
          Utkastet kunne ikke hentes på nytt. Forhåndsvisningen viser det som
          ble hentet sist.
        </Alert>
      ) : null}

      {projectQuery.isPending ? (
        <div className={styles.centered}>
          <Loader title="Laster forhåndsvisning" size="large" />
        </div>
      ) : draftUnavailable ? (
        <Alert variant="error" className={styles.previewAlert}>
          Utkastet er slettet, eller du har ikke lenger tilgang til det.
        </Alert>
      ) : !project ? (
        <Alert variant="error" className={styles.previewAlert}>
          Kunne ikke hente det lagrede utkastet.
        </Alert>
      ) : validation?.error ? (
        <Alert variant="warning" className={styles.previewAlert}>
          Widgeten kan ikke vises ennå: {validation.error}
        </Alert>
      ) : validation?.document && presentation?.mode === "inline" ? (
        // The survey stands in the page, as it will in the app. The content
        // above it is marked as an example: the developer decides what the
        // survey is placed at.
        <div className={styles.inlinePage}>
          <div className={styles.exampleContent}>
            <Detail as="p" className={styles.exampleLabel}>
              Eksempelinnhold
            </Detail>
            <BodyShort>
              Her står innholdet i appen som surveyen spør om.
            </BodyShort>
            {placementNote ? (
              <BodyShort>
                <span className={styles.placementLabel}>Plassering:</span>{" "}
                {placementNote}
              </BodyShort>
            ) : null}
          </div>
          <LumiSurveyInline
            key={`${projectId}:${project.draftVersion}`}
            surveyId={`preview-${project.surveyId}`}
            survey={validation.document}
            transport={previewTransport}
            context={{
              tags: previewContextTags(PREVIEW_ENVIRONMENT_TAG, presentation),
            }}
            behavior={{ questionLayout: "auto", showProgress: true }}
            success={success}
          />
        </div>
      ) : validation?.document ? (
        <LumiSurveyDock
          key={`${projectId}:${project.draftVersion}`}
          surveyId={`preview-${project.surveyId}`}
          survey={validation.document}
          transport={previewTransport}
          context={{ tags: { environment: PREVIEW_ENVIRONMENT_TAG } }}
          behavior={{
            initialOpen: true,
            hideAfterSubmit: false,
            questionLayout: "auto",
            showProgress: true,
            storageStrategy: "none",
          }}
          success={success}
        />
      ) : null}
    </Box>
  );
}
