import { Alert, BodyShort, Box, Heading, Loader, Tag } from "@navikt/ds-react";
import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { surveyPreviewSearchSchema } from "~/schemas/surveyPreviewSearchSchema";
import { fetchSurveyAuthoringProjectServerFn } from "~/server/actions";
import styles from "./survey-preview.module.css";

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
    queryFn: () =>
      fetchSurveyAuthoringProjectServerFn({ data: { team, projectId } }),
  });

  const validation = useMemo(() => {
    if (!projectQuery.data) return null;
    try {
      return {
        document: validateSurveyDocumentV1(projectQuery.data.document),
        error: null,
      };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : "Ugyldig dokument",
      };
    }
  }, [projectQuery.data]);

  return (
    <Box as="main" className={styles.previewSurface}>
      <div className={styles.previewMeta}>
        <Tag variant="warning" size="small">
          Forhåndsvisning
        </Tag>
        <BodyShort size="small">Svar sendes ikke eller lagres.</BodyShort>
      </div>

      {projectQuery.isPending ? (
        <div className={styles.centered}>
          <Loader title="Laster forhåndsvisning" size="large" />
        </div>
      ) : projectQuery.isError ? (
        <Alert variant="error" className={styles.previewAlert}>
          Kunne ikke hente det lagrede utkastet.
        </Alert>
      ) : validation?.error ? (
        <Alert variant="warning" className={styles.previewAlert}>
          Widgeten kan ikke vises ennå: {validation.error}
        </Alert>
      ) : validation?.document ? (
        <LumiSurveyDock
          key={`${projectId}:${projectQuery.data.draftVersion}`}
          surveyId={`preview-${projectQuery.data.surveyId}`}
          survey={validation.document}
          transport={previewTransport}
          context={{ tags: { environment: "survey-workshop-preview" } }}
          behavior={{
            initialOpen: true,
            hideAfterSubmit: false,
            questionLayout: "auto",
            showProgress: true,
            storageStrategy: "none",
          }}
          success={
            validation.document.success?.title.trim()
              ? undefined
              : {
                  title: "Slik ser kvitteringen ut",
                  body: "Dette var bare en forhåndsvisning. Ingenting ble sendt inn.",
                }
          }
        />
      ) : null}
    </Box>
  );
}
