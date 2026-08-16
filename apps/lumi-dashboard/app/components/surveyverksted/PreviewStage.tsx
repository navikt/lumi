import { ArrowCirclepathIcon, ExternalLinkIcon } from "@navikt/aksel-icons";
import { BodyShort, Button, Detail, Tag, Tooltip } from "@navikt/ds-react";
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { memo, useEffect, useState } from "react";
import { StageSurface } from "./StageSurface";
import styles from "./verksted.module.css";

export interface PreviewStageProps {
  document: SurveyDocumentV1;
  isValid: boolean;
  surveyId: string;
  initialPageId: string;
  fullPreviewHref: string | null;
  stats: { pages: number; questions: number };
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
        <Tooltip content="Start forhåndsvisningen på nytt">
          <Button
            type="button"
            variant="tertiary-neutral"
            size="small"
            icon={<ArrowCirclepathIcon aria-hidden />}
            aria-label="Start forhåndsvisningen på nytt"
            onClick={() => setRestartNonce((nonce) => nonce + 1)}
          />
        </Tooltip>
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
          environmentTag="survey-workshop-editor"
          initialPageId={initialPageId}
          nonce={restartNonce}
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
