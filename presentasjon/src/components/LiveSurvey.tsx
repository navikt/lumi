import {
  type LumiSurveyBehavior,
  type LumiSurveyDefinition,
  LumiSurveyDock,
  type LumiSurveyStyle,
  type LumiSurveyTransport,
  type LumiSurveyTransportPayload,
} from "@navikt/lumi-survey";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { cx } from "../engine/css";
import { useRenderMode } from "../engine/SlideContext";
import { useElementSize } from "../engine/useElementSize";
import "./LiveSurvey.css";

const DOCK_OFFSET = 16;
const MIN_PANEL_HEIGHT = 160;

export interface LiveSurveyProps {
  /**
   * The survey, as given to `LumiSurveyDock`. Define it once outside the
   * component: a new object on every render restarts the widget.
   */
  survey: LumiSurveyDefinition;
  /** Zoom for the widget inside the frame. */
  scale?: number;
  /** Receives exactly what the widget would send. Nothing leaves the browser. */
  onPayload?: (payload: LumiSurveyTransportPayload) => void;
  /** Sent in the payload. Only one live widget is on the stage at a time. */
  surveyId: string;
  /**
   * The window size the widget is told about, and reports in the payload.
   * Defaults to the frame. 1024 or wider counts as desktop.
   */
  viewport?: { width: number; height: number };
  /** Accessible name for the framed area. */
  label?: string;
  /** Drawn behind the widget, like the page of an app. */
  children?: ReactNode;
  className?: string;
}

/**
 * The real `LumiSurveyDock` inside a frame on a slide, as in Surveyverksted:
 * the scaled inner box is the containing block for the dock's fixed
 * position, so the dock sits in the corner of the frame, not the window.
 * Thumbnails and presenter previews get a still frame instead, so there is
 * never more than one live widget in a window. The print view shows the
 * widget as it opens, inert, so the PDF has it and nothing can be sent.
 */
export function LiveSurvey({
  survey,
  scale = 1.5,
  onPayload,
  surveyId,
  viewport,
  label = "Lumi-widgeten",
  children,
  className,
}: LiveSurveyProps) {
  const mode = useRenderMode();
  const live = mode === "stage";
  const printed = mode === "print";
  const boxRef = useRef<HTMLElement>(null);
  const box = useElementSize(boxRef);

  const onPayloadRef = useRef(onPayload);
  useLayoutEffect(() => {
    onPayloadRef.current = onPayload;
  });
  const transport = useMemo<LumiSurveyTransport>(
    () => ({
      submit: async (submission) => {
        onPayloadRef.current?.(submission.transportPayload);
      },
    }),
    [],
  );

  const zoom = scale > 0 ? scale : 1;
  const innerWidth = box ? Math.round(box.width / zoom) : 0;
  const innerHeight = box ? Math.round(box.height / zoom) : 0;
  const reportedWidth = viewport?.width ?? innerWidth;
  const reportedHeight = viewport?.height ?? innerHeight;

  const behavior = useMemo<LumiSurveyBehavior>(
    () => ({
      initialOpen: true,
      hideAfterSubmit: false,
      storageStrategy: "none",
      simulatedViewport: { width: reportedWidth, height: reportedHeight },
    }),
    [reportedWidth, reportedHeight],
  );
  const style = useMemo<LumiSurveyStyle>(
    () => ({
      offset: DOCK_OFFSET,
      panelMaxHeight: `${Math.max(MIN_PANEL_HEIGHT, innerHeight - DOCK_OFFSET * 2)}px`,
    }),
    [innerHeight],
  );

  return (
    <section
      ref={boxRef}
      className={cx("live-survey", className)}
      aria-label={label}
    >
      {children && <div className="live-survey__page">{children}</div>}
      {box && (live || printed) && (
        <div
          className="live-survey__inner"
          style={{
            width: innerWidth,
            height: innerHeight,
            transform: `scale(${zoom})`,
          }}
          inert={printed}
        >
          <LumiSurveyDock
            surveyId={surveyId}
            survey={survey}
            transport={transport}
            behavior={behavior}
            style={style}
          />
        </div>
      )}
      {!live && !printed && (
        <p className="live-survey__still">Widgeten kjører live på scenen</p>
      )}
    </section>
  );
}
