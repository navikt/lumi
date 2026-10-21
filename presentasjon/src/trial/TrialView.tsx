import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  type LumiSurveyTransportPayload,
} from "@navikt/lumi-survey";
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PayloadSummary } from "../components/PayloadSummary";
import { PayloadView } from "../components/PayloadView";
import { useNetworkCalls } from "../components/useNetworkCalls";
import { maskLikeLumiApi } from "../content/masking";
import { SALEN_SURVEY } from "../content/salen";
import "./trial.css";

const BEHAVIOR = {
  initialOpen: true,
  hideAfterSubmit: false,
  storageStrategy: "none",
} as const;

function textAnswer(payload: LumiSurveyTransportPayload): string | null {
  const text = payload.answers.find((answer) => answer.value.type === "text")
    ?.value.text;
  return text?.trim() ? text : null;
}

/** The text answer as Lumi API would store it, with the masked parts marked. */
function StoredText({ text }: { text: string }) {
  return (
    <figure className="trial__stored">
      <figcaption className="trial__stored-caption">
        Lumi API ville lagret:
      </figcaption>
      <p className="trial__stored-text">
        {maskLikeLumiApi(text).map((part, i) =>
          part.masked ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
            <mark key={i} className="trial__masked">
              {part.text}
            </mark>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
      <p className="trial__stored-note">
        Kjente mønstre som e-post og telefonnummer fjernes. Navn gjør ikke det.
      </p>
    </figure>
  );
}

/**
 * The widget is fixed to the bottom of the screen. Its height goes to the
 * page, which keeps that much room under its own content and scrolls
 * focused elements clear of the widget, so nothing stays hidden behind it.
 */
function useDockHeight(containerRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const root = document.documentElement;
    const write = (height: number) =>
      root.style.setProperty("--trial-dock-height", `${Math.ceil(height)}px`);
    const resize = new ResizeObserver((entries) => {
      const dock = entries[0]?.target;
      if (dock) write(dock.getBoundingClientRect().height);
    });
    // The dock renders nothing until it has read its state.
    const watch = () => {
      resize.disconnect();
      const dock = container.firstElementChild;
      if (dock) resize.observe(dock);
      else write(0);
    };
    const mutations = new MutationObserver(watch);
    mutations.observe(container, { childList: true });
    watch();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      root.style.removeProperty("--trial-dock-height");
    };
  }, [containerRef]);
}

/**
 * The phone page (`?prov`): the real widget in the real viewport, with a
 * transport that keeps the answer on the page.
 */
export function TrialView() {
  const [payload, setPayload] = useState<LumiSurveyTransportPayload | null>(
    null,
  );
  const networkCalls = useNetworkCalls(true);
  const transport = useMemo<LumiSurveyTransport>(
    () => ({
      submit: async (submission) => setPayload(submission.transportPayload),
    }),
    [],
  );
  const meterRef = useRef<HTMLParagraphElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  useDockHeight(widgetRef);

  // After Send, the counter and what the app got move up above the widget.
  useEffect(() => {
    if (!payload) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    meterRef.current?.scrollIntoView({
      block: "start",
      behavior: reduce.matches ? "auto" : "smooth",
    });
  }, [payload]);

  const text = payload ? textAnswer(payload) : null;

  return (
    <main className="trial">
      <h1 className="trial__title">Svaret ditt forlater ikke telefonen</h1>
      <p className="trial__lead">
        Widgeten nederst er den samme som team i Nav bruker. Her blir svaret
        liggende på siden og sendes ikke til noen server. I en ekte app går
        svaret til appens egen backend.
      </p>
      <p ref={meterRef} className="trial__meter">
        Nettverkskall fra siden: <strong>{networkCalls}</strong>
      </p>
      {payload ? (
        <>
          <PayloadSummary payload={payload} className="trial__payload" />
          <details className="trial__details">
            <summary>Vis alt appen ville fått</summary>
            <PayloadView payload={payload} caption="Hele payloaden" />
          </details>
          {text && <StoredText text={text} />}
        </>
      ) : (
        <p className="trial__empty">Svar i widgeten og trykk Send.</p>
      )}
      <p className="trial__more">
        Mer om Lumi:{" "}
        <a href="https://navikt.github.io/lumi/">navikt.github.io/lumi</a>
      </p>
      <div ref={widgetRef} className="trial__widget">
        <LumiSurveyDock
          surveyId="hvor-bor-svaret"
          survey={SALEN_SURVEY}
          transport={transport}
          behavior={BEHAVIOR}
        />
      </div>
    </main>
  );
}
