import {
  ArrowCirclepathIcon,
  BranchingIcon,
  ExternalLinkIcon,
} from "@navikt/aksel-icons";
import { BodyShort, Button, Detail, Tag, Tooltip } from "@navikt/ds-react";
import type {
  LumiSurveyAnswerValue,
  SurveyDocumentV1,
} from "@navikt/lumi-survey";
import { memo, useEffect, useState } from "react";
import { StageSurface } from "./StageSurface";
import styles from "./verksted.module.css";

/**
 * The stage dock's environment tag. Lifted into visibility metadata by the
 * widget, so live evaluation in the editor mirrors it (see liveVisibility).
 */
export const STAGE_ENVIRONMENT_TAG = "survey-workshop-editor";

export interface PreviewStageProps {
  document: SurveyDocumentV1;
  isValid: boolean;
  surveyId: string;
  initialPageId: string;
  fullPreviewHref: string | null;
  stats: { pages: number; questions: number };
  onAnswersChange?: (answers: Record<string, LumiSurveyAnswerValue>) => void;
  onOpenFlow?: () => void;
  /** Unresolved handoff issues, badged on the flow button */
  flowIssueCount?: number;
}

/**
 * The living mirror in the editor: follows the page being edited and
 * updates as the author types. Holds the last valid document so typing
 * through an invalid state never blanks the stage.
 */
export const PreviewStage = memo(function PreviewStage({
  document,
  isValid,
  surveyId,
  initialPageId,
  fullPreviewHref,
  stats,
  onAnswersChange,
  onOpenFlow,
  flowIssueCount = 0,
}: PreviewStageProps) {
  // The revision counter is the dock's remount identity: bumped every time
  // a new document is accepted, so no respondent state survives an edit.
  const [stable, setStable] = useState(() => ({
    document: isValid ? document : null,
    revision: 0,
  }));
  useEffect(() => {
    if (!isValid) return;
    const timeout = window.setTimeout(
      () =>
        setStable((previous) =>
          previous.document === document
            ? previous
            : { document, revision: previous.revision + 1 },
        ),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [document, isValid]);
  const stableDocument = stable.document;

  const [restartNonce, setRestartNonce] = useState(0);
  // "Start på nytt" runs the survey from the very beginning — intro screen
  // included when one is authored. The request is anchored to the document
  // revision and editor page it was made from. The next edit or page selection
  // returns the stage to the selected page without a Start-gate.
  const [fromStart, setFromStart] = useState<{
    revision: number;
    pageId: string;
  } | null>(null);
  useEffect(() => {
    setFromStart((current) =>
      current?.pageId === initialPageId ? current : null,
    );
  }, [initialPageId]);
  const hasIntro = Boolean(stableDocument?.intro?.title.trim());
  const previewFromStart =
    hasIntro &&
    fromStart?.revision === stable.revision &&
    fromStart.pageId === initialPageId;

  return (
    <section aria-label="Forhåndsvisning" className={styles.stagePanel}>
      <div className={styles.stageHeader}>
        <div>
          <Detail as="p" className={styles.eyebrow}>
            SLIK MØTER RESPONDENTEN DEN
          </Detail>
          <Tag variant="info" size="xsmall">
            Ingen svar sendes
          </Tag>
        </div>
        <div className={styles.stageHeaderActions}>
          {onOpenFlow ? (
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<BranchingIcon aria-hidden />}
              onClick={onOpenFlow}
            >
              Flyten
              {flowIssueCount > 0 ? (
                <span className={styles.flowWarnBadge}>
                  {flowIssueCount}
                  <span className={styles.srOnly}>
                    {flowIssueCount === 1
                      ? " uløst varsel i flyten"
                      : " uløste varsler i flyten"}
                  </span>
                </span>
              ) : null}
            </Button>
          ) : null}
          <Tooltip content="Start forhåndsvisningen på nytt">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<ArrowCirclepathIcon aria-hidden />}
              aria-label="Start forhåndsvisningen på nytt"
              onClick={() => {
                const restartRevision =
                  isValid && stableDocument !== document
                    ? stable.revision + 1
                    : stable.revision;
                if (restartRevision !== stable.revision) {
                  setStable({ document, revision: restartRevision });
                }
                setFromStart({
                  revision: restartRevision,
                  pageId: initialPageId,
                });
                setRestartNonce((nonce) => nonce + 1);
              }}
            />
          </Tooltip>
        </div>
      </div>

      {!isValid ? (
        <Detail as="p" className={styles.stageStale} role="status">
          Utkastet har en feil — viser sist gyldige versjon.
        </Detail>
      ) : null}

      {stableDocument ? (
        <StageSurface
          document={stableDocument}
          instanceKey={stable.revision}
          surveyId={`verksted-preview-${surveyId || "utkast"}`}
          environmentTag={STAGE_ENVIRONMENT_TAG}
          initialPageId={previewFromStart ? undefined : initialPageId}
          nonce={restartNonce}
          onAnswersChange={onAnswersChange}
          successTitle="Slik ser kvitteringen ut"
          successBody="Bare en forhåndsvisning — ingenting ble sendt."
        />
      ) : (
        <div className={styles.stageViewport}>
          <BodyShort size="small" className={styles.stageEmpty}>
            Forhåndsvisningen starter når dokumentet er gyldig.
          </BodyShort>
        </div>
      )}

      <div className={styles.stageFooter}>
        <Detail as="p" className={styles.stageStats}>
          {stats.pages} {stats.pages === 1 ? "side" : "sider"} ·{" "}
          {stats.questions} spørsmål
        </Detail>
        {fullPreviewHref ? (
          <Button
            as="a"
            href={fullPreviewHref}
            target="_blank"
            rel="noreferrer"
            variant="tertiary"
            size="xsmall"
            icon={<ExternalLinkIcon aria-hidden />}
          >
            Åpne i eget vindu
          </Button>
        ) : (
          <Detail as="span" className={styles.stageStats}>
            Eget vindu er klart når utkastet er lagret
          </Detail>
        )}
      </div>
    </section>
  );
});
