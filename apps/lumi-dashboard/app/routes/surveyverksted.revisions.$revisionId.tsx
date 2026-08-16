import {
  ArrowCirclepathIcon,
  CheckmarkCircleIcon,
  CodeIcon,
  DownloadIcon,
} from "@navikt/aksel-icons";
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
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import { validateSurveyDocumentV1 } from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { StageSurface } from "~/components/surveyverksted/StageSurface";
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
  const [restartNonce, setRestartNonce] = useState(0);
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
  const questionCount = revision.document.pages.reduce(
    (sum, page) => sum + page.questions.length,
    0,
  );

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
          Låst revisjon
        </Tag>
      </div>

      <header className={styles.hero}>
        <div className={styles.revisionMark} aria-hidden>
          {String(revision.revisionNumber).padStart(2, "0")}
        </div>
        <div className={styles.heroCopy}>
          <BodyShort
            size="small"
            weight="semibold"
            textColor="subtle"
            className={styles.eyebrow}
          >
            REVISJON {revision.revisionNumber} · KLAR FOR UTVIKLER
          </BodyShort>
          <Heading size="xlarge" level="1" spacing>
            {revision.name}
          </Heading>
          <BodyLong size="large">
            En fast versjon av surveyen som kan prøves, gjennomgås og tas inn i
            kode. Endringer i utkastet påvirker ikke denne lenken.
          </BodyLong>
          <dl className={styles.heroStats} aria-label="Revisjonsomfang">
            <div>
              <dt>Sider</dt>
              <dd>{revision.document.pages.length}</dd>
            </div>
            <div>
              <dt>Spørsmål</dt>
              <dd>{questionCount}</dd>
            </div>
            <div>
              <dt>Opprettet</dt>
              <dd>{formatTimestamp(revision.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <VStack gap="space-32" className={styles.mainColumn}>
          <section
            aria-labelledby="validation-heading"
            className={styles.validationSection}
          >
            {validation.error ? (
              <Alert variant="error">
                Revisjonen kan ikke brukes av widgeten: {validation.error}
              </Alert>
            ) : (
              <div className={styles.validationStatus}>
                <CheckmarkCircleIcon aria-hidden />
                <div>
                  <Heading id="validation-heading" size="small" level="2">
                    Klar til bruk
                  </Heading>
                  <BodyShort size="small">
                    Dokumentet er validert. Forhåndsvisning og kode bruker
                    nøyaktig den låste revisjonen.
                  </BodyShort>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="preview-heading">
            <HStack justify="space-between" align="end" gap="space-16" wrap>
              <div>
                <Heading id="preview-heading" size="medium" level="2" spacing>
                  Opplev surveyen som respondent
                </Heading>
                <BodyShort textColor="subtle">
                  Gå gjennom hele flyten i den ekte Lumi-widgeten, rett her.
                  Svar sendes ikke.
                </BodyShort>
              </div>
              <Tooltip content="Start forhåndsvisningen på nytt">
                <Button
                  type="button"
                  variant="tertiary-neutral"
                  size="small"
                  icon={<ArrowCirclepathIcon aria-hidden />}
                  aria-label="Start forhåndsvisningen på nytt"
                  disabled={!validation.document}
                  onClick={() => setRestartNonce((nonce) => nonce + 1)}
                />
              </Tooltip>
            </HStack>
            {validation.document ? (
              <div className={styles.stageWrap}>
                <StageSurface
                  document={validation.document}
                  instanceKey={revision.id}
                  surveyId={`revision-preview-${revision.surveyId}`}
                  environmentTag="survey-workshop-revision"
                  nonce={restartNonce}
                  successTitle="Forhåndsvisning fullført"
                  successBody="Dette var en inert forhåndsvisning. Ingenting ble sendt inn."
                />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="changes-heading">
            <Heading id="changes-heading" size="medium" level="2" spacing>
              Hva er endret?
            </Heading>
            <BodyShort textColor="subtle" spacing>
              En kort oppsummering mot forrige delte revisjon.
            </BodyShort>
            <ul className={styles.changeList}>
              {diff.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="export-heading">
            <Heading id="export-heading" size="medium" level="2" spacing>
              Ta surveyen inn i appen
            </Heading>
            <BodyShort textColor="subtle" spacing>
              TypeScript er den raskeste veien inn i kodebasen. JSON er det
              komplette, maskinlesbare dokumentet.
            </BodyShort>
            <div className={styles.exportGrid}>
              <div className={styles.exportCard} data-featured="true">
                <div className={styles.exportIcon} aria-hidden>
                  <CodeIcon />
                </div>
                <div>
                  <HStack gap="space-8" align="center" wrap>
                    <Heading size="small" level="3">
                      TypeScript
                    </Heading>
                    <Tag variant="success" size="small">
                      Anbefalt
                    </Tag>
                  </HStack>
                  <BodyShort size="small" textColor="subtle">
                    Klar til å limes inn som et typesikkert SurveyDocumentV1.
                  </BodyShort>
                </div>
                <CopyButton
                  copyText={typeScriptExport}
                  text="Kopier TypeScript"
                  activeText="TypeScript kopiert"
                />
              </div>
              <div className={styles.exportCard}>
                <div className={styles.exportIcon} aria-hidden>
                  <DownloadIcon />
                </div>
                <div>
                  <Heading size="small" level="3">
                    JSON-dokument
                  </Heading>
                  <BodyShort size="small" textColor="subtle">
                    Bevarer hele dokumentet for arkiv, verktøy og round-trip.
                  </BodyShort>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  icon={<DownloadIcon aria-hidden />}
                  onClick={downloadJson}
                >
                  Last ned JSON
                </Button>
              </div>
            </div>
            <div className={styles.shareRow}>
              <div>
                <BodyShort weight="semibold">Del i oppgaven</BodyShort>
                <BodyShort size="small" textColor="subtle">
                  Kopierer navn, revisjon og teamautorisert lenke som Markdown.
                </BodyShort>
              </div>
              <CopyButton
                copyText={markdown}
                text="Kopier lenke og sammendrag"
                activeText="Sammendrag kopiert"
                disabled={!revisionUrl}
              />
            </div>
            <details className={styles.codeDisclosure}>
              <summary>Se TypeScript-koden</summary>
              <div className={styles.codeScroller}>
                <pre>
                  <code>{typeScriptExport}</code>
                </pre>
              </div>
            </details>
          </section>
        </VStack>

        <aside className={styles.metadata} aria-labelledby="metadata-heading">
          <BodyShort
            size="small"
            weight="semibold"
            textColor="subtle"
            className={styles.eyebrow}
          >
            FAST OG DELBAR
          </BodyShort>
          <Heading id="metadata-heading" size="medium" level="2" spacing>
            Om revisjonen
          </Heading>
          <BodyShort size="small" textColor="subtle" spacing>
            Revisjon {revision.revisionNumber} er et øyeblikksbilde. Den kan
            alltid brukes til å kontrollere nøyaktig hva som ble delt.
          </BodyShort>
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
              <dt>Utkastversjon</dt>
              <dd>{revision.draftVersion}</dd>
            </div>
          </dl>
          <details className={styles.technicalDetails}>
            <summary>Tekniske detaljer</summary>
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
          </details>
          <Alert variant="info" size="small">
            Dette er ikke publisering. Git og appens deployløp avgjør hva som
            kjører i produksjon.
          </Alert>
        </aside>
      </div>
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
