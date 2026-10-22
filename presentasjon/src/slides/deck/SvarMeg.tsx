import { useLayoutEffect, useRef } from "react";
import { useAnswer } from "../../components/answerStore";
import { LiveSurvey } from "../../components/LiveSurvey";
import { useNetworkCalls } from "../../components/useNetworkCalls";
import { SALEN_SURVEY } from "../../content/salen";
import {
  Reveal,
  type Slide,
  type SlideProps,
  useRenderMode,
} from "../../engine";
import "./svar.css";

/**
 * A dimmed app page behind the widget, so the room sees it sits in an app:
 * a top bar, a menu and content blocks. No real product: the next slide
 * shows one. Drawn in the window's own size, in stage pixels.
 */
function AppPage() {
  const menu = [84, 64, 76, 56, 70];
  return (
    <svg
      className="app-page"
      viewBox="0 0 788 812"
      preserveAspectRatio="xMinYMin slice"
      aria-hidden="true"
    >
      <rect className="app-page__ground" width="788" height="812" />
      <rect className="app-page__bar" width="788" height="84" />
      <rect
        className="app-page__on-bar"
        x="32"
        y="42"
        width="76"
        height="22"
        rx="5"
      />
      {[452, 548, 644].map((x) => (
        <rect
          key={x}
          className="app-page__on-bar"
          x={x}
          y="48"
          width="64"
          height="12"
          rx="6"
        />
      ))}
      <rect
        className="app-page__card"
        x="16"
        y="112"
        width="132"
        height="44"
        rx="8"
      />
      {menu.map((width, i) => (
        <rect
          key={width}
          className="app-page__ink"
          x="34"
          y={128 + i * 52}
          width={width}
          height="12"
          rx="6"
        />
      ))}
      <rect
        className="app-page__ink"
        x="180"
        y="118"
        width="300"
        height="28"
        rx="6"
      />
      {[184, 380, 576].map((y) => (
        <g key={y}>
          <rect
            className="app-page__card"
            x="180"
            y={y}
            width="580"
            height="172"
            rx="10"
          />
          <rect
            className="app-page__ink"
            x="212"
            y={y + 32}
            width="240"
            height="16"
            rx="8"
          />
          <rect
            className="app-page__line"
            x="212"
            y={y + 72}
            width="480"
            height="12"
            rx="6"
          />
          <rect
            className="app-page__line"
            x="212"
            y={y + 102}
            width="400"
            height="12"
            rx="6"
          />
        </g>
      ))}
    </svg>
  );
}

/** Where the kept answer leaves the widget: low in the open panel, where Send was. */
function liftOffPoint(app: HTMLElement): { x: number; y: number } {
  const panel = app
    .querySelector(".lumi-survey-dock__panel")
    ?.getBoundingClientRect();
  const box = panel && panel.width > 0 ? panel : app.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height * 0.78 };
}

/**
 * The kept answer flies from the widget to its ring. Measured on the stage
 * when it shows, on step 1, so the flight starts at the panel at any window
 * size. Written as custom properties that the flight reads.
 */
function useLiftOff(
  app: React.RefObject<HTMLDivElement | null>,
  dot: React.RefObject<SVGSVGElement | null>,
  step: number,
) {
  useLayoutEffect(() => {
    if (step < 1) return;
    const appEl = app.current;
    const dotEl = dot.current;
    const stage = dotEl?.closest(".slide")?.getBoundingClientRect();
    if (!appEl || !dotEl || !stage || stage.width === 0) return;
    const scale = stage.width / 1920;
    const from = liftOffPoint(appEl);
    // The svg box, not the disc: the disc may be mid-flight.
    const box = dotEl.getBoundingClientRect();
    const dx = (from.x - (box.left + box.width / 2)) / scale;
    const dy = (from.y - (box.top + box.height / 2)) / scale;
    dotEl.style.setProperty("--lift-x", `${Math.round(dx)}px`);
    dotEl.style.setProperty("--lift-y", `${Math.round(dy)}px`);
  }, [app, dot, step]);
}

function SvarMeg({ active, step }: SlideProps) {
  const { setPayload } = useAnswer();
  const calls = useNetworkCalls(active);
  const printed = useRenderMode() === "print";
  const appRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGSVGElement>(null);
  useLiftOff(appRef, dotRef, step);

  return (
    <div className="slide svar">
      <h2 className="svar__title">
        Dere svarer
        <br />
        først
      </h2>
      {/* The real count: fetch, XHR and sendBeacon from the page. */}
      <p className="svar__meter">
        <strong className="svar__count">{calls}</strong>
        <span className="svar__count-label">
          nettverkskall
          <br />
          fra siden
        </span>
      </p>
      <div ref={appRef} className="svar__app">
        <LiveSurvey
          survey={SALEN_SURVEY}
          surveyId="hvor-bor-svaret"
          scale={1.56}
          viewport={{ width: 1280, height: 800 }}
          onPayload={setPayload}
          label="Den ekte Lumi-widgeten i en app. Presentasjonen sender ikke svaret noe sted."
          className="svar__frame"
        >
          <AppPage />
        </LiveSurvey>
      </div>
      {/* The PDF shows the widget inert, so it is not live there. */}
      {!printed && <p className="svar__caption">Den ekte widgeten, live</p>}
      <Reveal at={1} className="svar__kept">
        <svg
          ref={dotRef}
          className="svar__dot"
          width="96"
          height="96"
          viewBox="0 0 96 96"
          aria-hidden="true"
        >
          <circle cx="48" cy="48" r="22" className="map-station__ring" />
          <g className="svar__fly-x">
            <g className="svar__fly-y">
              <circle cx="48" cy="48" r="40" className="map-answer" />
            </g>
          </g>
          <circle cx="48" cy="48" r="40" className="svar__ripple" />
        </svg>
        <p className="svar__kept-text">
          Svaret blir liggende her.
          <br />
          Vi følger det om litt.
        </p>
      </Reveal>
    </div>
  );
}

export const svarMeg: Slide = {
  id: "svar-meg",
  title: "Dere svarer først",
  steps: 1,
  notes: `Inn: «Før jeg forklarer noe, skal dere svare på en survey. Dette er den ekte widgeten, samme pakke som appene bruker. Hvordan har dagen vært så langt? Skriv et tall fra én til fem i chatten, eller si det høyt i rommet. Fem er best.»

Les noen svar høyt, for eksempel: «Jeg ser to firere og en femmer. Hva sier rommet?» Velg det første tallet som kommer.

«Tekstfeltet fyller jeg ut selv. Under feltet står det at man ikke skal skrive navn eller andre personopplysninger. Jeg gjør det likevel.»

Lim inn: Fant ikke planen. Send svar til Ola Nordmann, ola.nordmann@example.com
Ha teksten klar i utklippstavla.

Før Send: «Se på telleren. Hva tror dere den viser når jeg trykker Send?» Trykk Send.

«Den står på null. Presentasjonen gir ikke widgeten noen transport som sender, så svaret blir her i nettleseren. I en app går svaret til appens egen backend på samme domene, og derfra videre til Lumi API.»

Klikk: svaret letter fra widgeten og lander nede til venstre. «Svaret blir liggende her. Vi følger det om litt.»

Til spørsmål: telleren teller fetch, XHR og sendBeacon fra siden. Fonter og bilder telles ikke. Fra versjon 2.5.0 kan widgeten sende svaret selv med transport={{ endpoint }}: JSON med POST til appens backend, bare på samme domene. Backenden veksler token og sender svaret videre til Lumi API. Appen kan også gi widgeten sin egen transport med submit.

Etter Send virker piltastene. Ikke trykk Esc, for i fullskjerm avslutter Esc fullskjermen.`,
  Component: SvarMeg,
};
