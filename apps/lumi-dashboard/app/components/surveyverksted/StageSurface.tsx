import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { LumiSurveyDock, type LumiSurveyTransport } from "@navikt/lumi-survey";
import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { documentNeedsWideDock } from "~/utils/surveyDocument";
import styles from "./verksted.module.css";

const inertTransport: LumiSurveyTransport = {
  submit: async () => undefined,
};

const DOCK_OFFSET = 16;
const DOCK_WIDTH = 384; // 24rem
const NPS_DOCK_WIDTH = 512; // 32rem

export interface StageSurfaceProps {
  /** A document that passes validateSurveyDocumentV1 */
  document: SurveyDocumentV1;
  /**
   * Collision-free identity for this document within the session — a
   * monotonically bumped counter or an immutable id. Changing it remounts
   * the dock so no respondent state survives a document change.
   */
  instanceKey: string | number;
  surveyId: string;
  environmentTag: string;
  initialPageId?: string;
  /** Bump to restart the respondent flow */
  nonce?: number;
  successTitle: string;
  successBody: ReactNode;
}

/**
 * A miniature page with the real LumiSurveyDock docked in its corner.
 * The scaled wrapper's transform makes it the containing block for the
 * dock's fixed positioning — production placement, faithfully contained.
 */
export const StageSurface = memo(function StageSurface({
  document,
  instanceKey,
  surveyId,
  environmentTag,
  initialPageId,
  nonce = 0,
  successTitle,
  successBody,
}: StageSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 480, height: 560 });
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setViewport({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const requiredWidth =
    (documentNeedsWideDock(document) ? NPS_DOCK_WIDTH : DOCK_WIDTH) +
    DOCK_OFFSET * 2;
  const scale = Math.min(1, viewport.width / requiredWidth);
  const innerWidth = Math.round(viewport.width / scale);
  const innerHeight = Math.round(viewport.height / scale);
  const panelMaxHeight = `${Math.max(280, innerHeight - DOCK_OFFSET * 2 - 8)}px`;

  const dockKey = useMemo(
    () => `${instanceKey}:${initialPageId ?? ""}:${nonce}`,
    [instanceKey, initialPageId, nonce],
  );

  return (
    <div ref={viewportRef} className={styles.stageViewport}>
      <div
        className={styles.stageInner}
        style={{
          width: innerWidth,
          height: innerHeight,
          transform: `scale(${scale})`,
        }}
      >
        <div className={styles.stageBackdrop} aria-hidden>
          <div className={styles.stageChrome}>
            <span />
            <span />
            <span />
            <span className={styles.stageUrl}>nav.no</span>
          </div>
          <div className={styles.stagePage}>
            <span className={styles.stageLine} data-width="55" />
            <span className={styles.stageLine} data-width="34" />
            <span className={styles.stageLine} data-width="72" />
            <span className={styles.stageLine} data-width="48" />
          </div>
        </div>
        <LumiSurveyDock
          key={dockKey}
          surveyId={surveyId}
          survey={document}
          transport={inertTransport}
          context={{ tags: { environment: environmentTag } }}
          behavior={{
            initialOpen: true,
            hideAfterSubmit: false,
            questionLayout: "auto",
            showProgress: true,
            storageStrategy: "none",
            initialPageId,
            simulatedViewport: { width: innerWidth, height: innerHeight },
          }}
          style={{ offset: DOCK_OFFSET, panelMaxHeight }}
          success={
            document.success?.title.trim()
              ? undefined
              : { title: successTitle, body: successBody }
          }
        />
      </div>
    </div>
  );
});
