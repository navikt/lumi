import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  CopyButton,
  Heading,
  HStack,
  Loader,
  Tag,
  VStack,
} from "@navikt/ds-react";
import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fetchSurveyAuthoringRevisionServerFn } from "~/server/actions";
import type { SurveyAuthoringRevisionDetail } from "~/types/surveyAuthoring";
import {
  createRevisionMarkdown,
  describeRevisionChanges,
  serializeSurveyDocumentJson,
  serializeSurveyDocumentTypeScript,
} from "~/utils/surveyRevision";
import styles from "./surveyverksted-revision.module.css";

const searchSchema = z.object({ team: z.string().min(1) });

const previewTransport: LumiSurveyTransport = {
  submit: async () => undefined,
};

export const Route = createFileRoute("/surveyverksted/revisions/$revisionId")({
  validateSearch: zodValidator(searchSchema),
  component: SurveyRevisionRoute,
});

function SurveyRevisionRoute() {
  const { revisionId } = Route.useParams();
  const { team } = Route.useSearch();
  const revisionQuery = useQuery({
    queryKey: ["survey-authoring-revision", team, revisionId],
    queryFn: () =>
      fetchSurveyAuthoringRevisionServerFn({ data: { team, revisionId } }),
  });

  if (revisionQuery.isPending) {
    return (
      <Box as="main" padding="space-32" className={styles.centered}>
        <Loader size="large" title="Åpner revisjon" />
      </Box>
    );
  }

  if (revisionQuery.isError) {
    return (
      <Box as="main" padding="space-32" className="main-container">
        <Alert variant="error">
          Revisjonen finnes ikke, eller du har ikke tilgang til teamet.
        </Alert>
      </Box>
    );
  }

  return <SurveyRevision detail={revisionQuery.data} team={team} />;
}

function SurveyRevision({
  detail,
  team,
}: {
  detail: SurveyAuthoringRevisionDetail;
  team: string;
}) {
  const { revision, previousRevision } = detail;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisionUrl, setRevisionUrl] = useState("");

  useEffect(() => setRevisionUrl(window.location.href), []);

  const validation = useMemo(() => {
    try {
      return {
        document: validateSurveyDocumentV1(revision.document),
        error: null,
      };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : "Ugyldig dokument",
      };
    }
  }, [revision.document]);
  const jsonExport = useMemo(
    () => serializeSurveyDocumentJson(revision.document),
    [revision.document],
  );
  const typeScriptExport = useMemo(
    () => serializeSurveyDocumentTypeScript(revision.document),
    [revision.document],
  );
  const diff = useMemo(
    () =>
      describeRevisionChanges(revision.document, previousRevision?.document),
    [previousRevision?.document, revision.document],
  );
  const markdown = revisionUrl
    ? createRevisionMarkdown(revision, revisionUrl)
    : "";

  const downloadJson = () => {
    const blob = new Blob([jsonExport], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${safeFilename(revision.surveyId)}-revision-${revision.revisionNumber}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className={styles.revisionSurface}>
      <div className={styles.topline}>
        <Link
          to="/surveyverksted/$projectId"
          params={{ projectId: revision.projectId }}
          search={{ team }}
          className={styles.backLink}
        >
          Tilbake til redigerbart utkast
        </Link>
        <Tag variant="success" size="small">
          Frosset revisjon
        </Tag>
      </div>

      <header className={styles.hero}>
        <div className={styles.revisionMark} aria-hidden>
          {String(revision.revisionNumber).padStart(2, "0")}
        </div>
        <div className={styles.heroCopy}>
          <BodyShort size="small" textColor="subtle">
            Delbart authoring-artefakt
          </BodyShort>
          <Heading size="xlarge" level="1" spacing>
            {revision.name}
          </Heading>
          <BodyLong size="large">
            Denne lenken viser nøyaktig innhold fra revisjon{" "}
            {revision.revisionNumber}. Senere endringer i utkastet påvirker den
            ikke.
          </BodyLong>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <VStack gap="space-32" className={styles.mainColumn}>
          <section aria-labelledby="validation-heading">
            <Heading id="validation-heading" size="medium" level="2" spacing>
              Validering
            </Heading>
            {validation.error ? (
              <Alert variant="error">
                Revisjonen kan ikke brukes av widgeten: {validation.error}
              </Alert>
            ) : (
              <Alert variant="success">
                Gyldig SurveyDocumentV1. Preview og eksport bruker det frosne
                dokumentet under.
              </Alert>
            )}
          </section>

          <section aria-labelledby="preview-heading">
            <HStack justify="space-between" align="end" gap="space-16" wrap>
              <div>
                <Heading id="preview-heading" size="medium" level="2" spacing>
                  Interaktiv preview
                </Heading>
                <BodyShort textColor="subtle">
                  Den ekte widgeten brukes med inert transport. Ingen svar
                  sendes.
                </BodyShort>
              </div>
              <Button
                type="button"
                variant={previewOpen ? "secondary" : "primary"}
                disabled={!validation.document}
                onClick={() => setPreviewOpen((open) => !open)}
              >
                {previewOpen ? "Avslutt preview" : "Start preview"}
              </Button>
            </HStack>
            <div className={styles.previewStage} aria-live="polite">
              <span className={styles.previewEyebrow}>
                INERT / INGEN INNSENDING
              </span>
              <BodyLong>
                {previewOpen
                  ? "Widgeten er åpnet nederst i vinduet. Prøv hele flyten, og avslutt preview når du er ferdig."
                  : "Start preview for å prøve det frosne dokumentet i en ekte viewport."}
              </BodyLong>
            </div>
          </section>

          <section aria-labelledby="changes-heading">
            <Heading id="changes-heading" size="medium" level="2" spacing>
              Endringer fra forrige revisjon
            </Heading>
            <ul className={styles.changeList}>
              {diff.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="export-heading">
            <Heading id="export-heading" size="medium" level="2" spacing>
              Handoff til utvikler
            </Heading>
            <BodyShort textColor="subtle" spacing>
              JSON er round-trip-formatet. TypeScript er en deterministisk
              presentasjon klar for kodebasen.
            </BodyShort>
            <HStack gap="space-8" wrap className={styles.exportActions}>
              <CopyButton
                copyText={typeScriptExport}
                text="Kopier TypeScript"
                activeText="TypeScript kopiert"
              />
              <Button type="button" variant="secondary" onClick={downloadJson}>
                Last ned JSON
              </Button>
              <CopyButton
                copyText={markdown}
                text="Kopier som Markdown"
                activeText="Markdown kopiert"
                disabled={!revisionUrl}
              />
            </HStack>
            <details className={styles.codeDisclosure}>
              <summary>Vis TypeScript</summary>
              <div className={styles.codeScroller}>
                <pre>
                  <code>{typeScriptExport}</code>
                </pre>
              </div>
            </details>
          </section>
        </VStack>

        <aside className={styles.metadata} aria-labelledby="metadata-heading">
          <Heading id="metadata-heading" size="small" level="2" spacing>
            Revisjonsbevis
          </Heading>
          <dl>
            <div>
              <dt>Revisjon</dt>
              <dd>{revision.revisionNumber}</dd>
            </div>
            <div>
              <dt>Survey-ID</dt>
              <dd>{revision.surveyId}</dd>
            </div>
            <div>
              <dt>Opprettet av</dt>
              <dd>{revision.createdBy}</dd>
            </div>
            <div>
              <dt>Opprettet</dt>
              <dd>{formatTimestamp(revision.createdAt)}</dd>
            </div>
            <div>
              <dt>Draft-versjon</dt>
              <dd>{revision.draftVersion}</dd>
            </div>
          </dl>
          <div className={styles.hashBlock}>
            <BodyShort size="small" weight="semibold">
              documentHash
            </BodyShort>
            <code>{revision.documentHash}</code>
          </div>
          <div className={styles.hashBlock}>
            <BodyShort size="small" weight="semibold">
              definitionHash
            </BodyShort>
            <code>{revision.definitionHash}</code>
          </div>
          <Alert variant="info" size="small">
            Revisjonen er ikke publisert eller live. Git og appens deployløp
            avgjør hva som kjører i produksjon.
          </Alert>
        </aside>
      </div>

      {previewOpen && validation.document ? (
        <LumiSurveyDock
          key={revision.id}
          surveyId={`revision-preview-${revision.surveyId}`}
          survey={validation.document}
          transport={previewTransport}
          context={{ tags: { environment: "survey-workshop-revision" } }}
          behavior={{
            initialOpen: true,
            hideAfterSubmit: false,
            questionLayout: "auto",
            showProgress: true,
            storageStrategy: "none",
          }}
          success={{
            title: "Preview fullført",
            body: "Dette var en inert forhåndsvisning. Ingenting ble sendt inn.",
          }}
        />
      ) : null}
    </main>
  );
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "survey";
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(value));
}
