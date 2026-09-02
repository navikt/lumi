import type {
  LumiSurveyAnswerValue,
  SurveyDocumentV1,
} from "@navikt/lumi-survey";
import { LumiSurveyDock, type LumiSurveyTransport } from "@navikt/lumi-survey";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { documentNeedsWideDock } from "~/utils/surveyDocument";
import styles from "./verksted.module.css";

/**
 * Mirrors the widget's own answer-keeping rule (`shouldDropValue` in the
 * package): blank strings and empty arrays never reach answer state, so the
 * editor's live visibility must ignore them the same way.
 */
function keepsAnswer(value: unknown): value is LumiSurveyAnswerValue {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

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
  /**
   * Reports the stage's current answer state on every answer, and an empty
   * map whenever the dock remounts (document edit, page switch, restart).
   */
  onAnswersChange?: (answers: Record<string, LumiSurveyAnswerValue>) => void;
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
  onAnswersChange,
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

  // Live answer mirror: the dock owns the respondent state; the editor only
  // observes it through the public onAnswer event. A remount (new dockKey)
  // starts a fresh respondent, so the mirror resets with it.
  const answersRef = useRef<Record<string, LumiSurveyAnswerValue>>({});
  const onAnswersChangeRef = useRef(onAnswersChange);
  onAnswersChangeRef.current = onAnswersChange;
  // biome-ignore lint/correctness/useExhaustiveDependencies: dockKey is the intentional trigger — a remounted dock means a fresh respondent, so the mirror resets alongside it
  useEffect(() => {
    answersRef.current = {};
    onAnswersChangeRef.current?.({});
  }, [dockKey]);
  const handleAnswer = useCallback((questionId: string, value: unknown) => {
    const next = { ...answersRef.current };
    if (keepsAnswer(value)) {
      next[questionId] = Array.isArray(value) ? [...value] : value;
    } else {
      delete next[questionId];
    }
    answersRef.current = next;
    onAnswersChangeRef.current?.(next);
  }, []);
  // The dock also clears answers WITHOUT a remount (closing the dock resets
  // by default) — that path fires onReset, not per-question onAnswer, so the
  // mirror must subscribe to both or it reports answers that no longer exist.
  const handleReset = useCallback(() => {
    answersRef.current = {};
    onAnswersChangeRef.current?.({});
  }, []);
  const dockEvents = useMemo(
    () => ({ onAnswer: handleAnswer, onReset: handleReset }),
    [handleAnswer, handleReset],
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
          events={dockEvents}
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
