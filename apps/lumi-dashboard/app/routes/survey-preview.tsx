import { Alert, BodyShort, Box, Loader, Tag } from "@navikt/ds-react";
import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import { z } from "zod";
import { fetchSurveyAuthoringProjectServerFn } from "~/server/actions";
import styles from "./survey-preview.module.css";

const searchSchema = z.object({
  team: z.string().min(1),
  projectId: z.string().uuid(),
  version: z.coerce.number().int().positive().optional(),
});

const previewTransport: LumiSurveyTransport = {
  submit: async () => undefined,
};

export const Route = createFileRoute("/survey-preview")({
  validateSearch: zodValidator(searchSchema),
  component: SurveyPreview,
});

function SurveyPreview() {
  const { team, projectId, version } = Route.useSearch();
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
          success={{
            title: "Slik ser kvitteringen ut",
            body: "Dette var bare en forhåndsvisning. Ingenting ble sendt inn.",
          }}
        />
      ) : null}
    </Box>
  );
}
