import { useLayoutEffect, useRef } from "react";
import { useAnswer } from "../../components/answerStore";
import { LiveSurvey } from "../../components/LiveSurvey";
import { PayloadSummary } from "../../components/PayloadSummary";
import { Tag } from "../../components/Tag";
import { useNetworkCalls } from "../../components/useNetworkCalls";
import { SALEN_SURVEY } from "../../content/salen";
import { Reveal, type Slide, type SlideProps } from "../../engine";
import "./svar.css";

/** A plain app page behind the widget: only its top bar, nothing that loads. */
function AppPage() {
  return (
    <div className="app-page" aria-hidden="true">
      <div className="app-page__bar" />
    </div>
  );
}

/** The clock time of an ISO timestamp, written the Norwegian way: 13.07. */
function clockTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}.${pad(date.getMinutes())}`;
}

/**
 * Where the kept answer lifts off from: the Send button, low in the widget,
 * measured on the stage so the flight starts there at any window size.
 * Written as custom properties that the lift-off animation reads. Measured
 * when the kept answer shows, on step 1.
 */
function useLiftOff(
  app: React.RefObject<HTMLDivElement | null>,
  dot: React.RefObject<SVGSVGElement | null>,
  step: number,
) {
  useLayoutEffect(() => {
    if (step < 1) return;
    const appBox = app.current?.getBoundingClientRect();
    const dotEl = dot.current;
    // The row the dot sits in, not the dot: the dot may be mid-flight.
    const rowBox = dotEl?.parentElement?.getBoundingClientRect();
    const stage = dotEl?.closest(".slide")?.getBoundingClientRect();
    if (!appBox || !dotEl || !rowBox || !stage || stage.width === 0) return;
    const scale = stage.width / 1920;
    const fromX = appBox.left + appBox.width * 0.62;
    const fromY = appBox.top + appBox.height * 0.86;
    const dotX = rowBox.left + (dotEl.width.baseVal.value / 2) * scale;
    const dotY = rowBox.top + rowBox.height / 2;
    const dx = (fromX - dotX) / scale;
    const dy = (fromY - dotY) / scale;
    dotEl.style.setProperty("--lift-x", `${Math.round(dx)}px`);
    dotEl.style.setProperty("--lift-y", `${Math.round(dy)}px`);
  }, [app, dot, step]);
}

function SvarMeg({ active, step }: SlideProps) {
  const { payload, setPayload } = useAnswer();
  const calls = useNetworkCalls(active);
  const sentAt = payload ? clockTime(payload.submittedAt) : null;
  const appRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGSVGElement>(null);
  useLiftOff(appRef, dotRef, step);

  return (
    <div className="slide svar">
      <h2 className="slide-title">Svar meg</h2>
      <p className="svar__meter">
        Nettverkskall fra siden <strong>{calls}</strong>
      </p>
      <div ref={appRef} className="svar__app">
        <LiveSurvey
          survey={SALEN_SURVEY}
          surveyId="hvor-bor-svaret"
          scale={1.4}
          viewport={{ width: 1280, height: 800 }}
          onPayload={setPayload}
          label="Den ekte Lumi-widgeten i en app. Svaret sendes ikke noe sted."
          className="svar__frame"
        >
          <AppPage />
        </LiveSurvey>
        <Tag kind="live" className="svar__tag" />
      </div>
      <div className="svar__side">
        {payload ? (
          <>
            <PayloadSummary payload={payload} />
            {/* Next to the payload, where the eyes are after Send. */}
            <p className="svar__sent">
              {sentAt ? `Send trykket kl. ${sentAt}.` : "Send trykket."} {calls}{" "}
              nettverkskall.
            </p>
          </>
        ) : (
          <p className="svar__empty">
            Svar i widgeten, så ser dere her hva appen ville sendt.
          </p>
        )}
        <Reveal at={1} className="svar__kept">
          <svg
            ref={dotRef}
            width="72"
            height="72"
            viewBox="0 0 72 72"
            aria-hidden="true"
          >
            <circle cx="36" cy="36" r="30" className="map-answer" />
          </svg>
          <span>
            Svaret blir liggende her.
            <br />
            Vi følger det om litt.
          </span>
        </Reveal>
      </div>
    </div>
  );
}

export const svarMeg: Slide = {
  id: "svar-meg",
  title: "Svar meg",
  steps: 1,
  notes: `Ordrett: «Før jeg forklarer noe, skal dere svare på en survey. Det dere ser, er den ekte widgeten, samme pakke som appene våre bruker. Hvordan har dagen vært så langt? Skriv et tall fra én til fem i chatten, eller si det høyt i rommet. Fem er best.»

Les svarene fra chatten høyt, for eksempel: Jeg ser to firere og en femmer. Hva sier rommet?

Velg det første tallet som kommer.

«Tekstfeltet fyller jeg ut selv. Under feltet står det at man ikke skal skrive navn eller andre personopplysninger. Jeg gjør det likevel.»

Skriv: Fikk ikke sendt skjemaet. Send svar til ola.nordmann@example.com
Tips: ha teksten i utklippstavla og lim den inn.

Før Send: «Se på telleren. Hva tror dere den viser når jeg trykker Send?»
Trykk Send.

«Til høyre ser dere det appen ville sendt til sin egen backend. Telleren viser nettverkskall fra siden, og den står på null. Widgeten sender aldri noe selv. Det gjør appen den ligger i, og denne appen er en presentasjon som ikke sender noe.»

Klikk: «Svaret blir liggende her, og vi henter det fram igjen om litt.»

Etter Send virker piltastene. Ikke trykk Esc, for i fullskjerm avslutter Esc fullskjermen.`,
  Component: SvarMeg,
};
