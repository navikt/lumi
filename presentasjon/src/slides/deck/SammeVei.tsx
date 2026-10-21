import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import { useEffect, useState } from "react";
import { useAnswer } from "../../components/answerStore";
import { Tag } from "../../components/Tag";
import { maskLikeLumiApi } from "../../content/masking";
import {
  Reveal,
  type Slide,
  type SlideProps,
  useRenderMode,
} from "../../engine";
import { Answer, Line, LineMap, MapText, Station, Zone } from "../../map";
import "./svar.css";

const Y = 570;
/**
 * The app's own data, on a dimmed line 48 px clear above the answer's, so
 * the answer disc passes under it without touching.
 */
const LINE_WIDTH = 14;
const OWN_DATA_Y = Y - LINE_WIDTH - 48;
const STOPS = [
  { x: 250, label: "Nettleseren" },
  { x: 760, label: "Appens backend", note: "veksler token" },
  { x: 1180, label: "Lumi API", note: "bare apper på lista" },
  { x: 1600, label: "Databasen", note: "på Nais" },
] as const;

/** Used when nobody answered on the opening slide. */
const EXAMPLE_TEXT =
  "Fikk ikke sendt skjemaet. Send svar til ola.nordmann@example.com";

function answerText(payload: LumiSurveyTransportPayload | null): string | null {
  const answer = payload?.answers.find((item) => item.value.type === "text");
  return answer?.value.text ?? null;
}

function ratingText(payload: LumiSurveyTransportPayload | null): string {
  const rating = payload?.answers.find(
    (answer) => answer.value.type === "rating",
  );
  if (!rating) return "4 av 5";
  return `${rating.value.rating ?? "?"} av ${rating.value.ratingScale ?? "?"}`;
}

/** Which station the answer is at for each build step. Step 3 shows what is stored. */
const STOP_FOR_STEP = [0, 1, 2, 2, 3] as const;

function stopFor(step: number): number {
  return STOP_FOR_STEP[Math.min(Math.max(step, 0), STOP_FOR_STEP.length - 1)];
}

/** How long the room sees the text as it was written, before Lumi API masks it. */
const AS_WRITTEN_MS = 1100;

/**
 * True once the mask is shown. On the step where the stored text appears,
 * the text first shows as written and then dissolves into the mask. Every
 * other time, and with reduced motion, the mask shows at once.
 */
function useMasked(run: boolean): boolean {
  const [masked, setMasked] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!run || reduce.matches) {
      setMasked(true);
      return;
    }
    setMasked(false);
    const timer = window.setTimeout(() => setMasked(true), AS_WRITTEN_MS);
    return () => window.clearTimeout(timer);
  }, [run]);
  return masked;
}

function SammeVei({ step, active }: SlideProps) {
  const { payload } = useAnswer();
  const masked = useMasked(useRenderMode() === "stage" && active && step === 3);
  const fromRoom = payload !== null;
  const text = answerText(payload) ?? (fromRoom ? null : EXAMPLE_TEXT);
  const stored = text ? maskLikeLumiApi(text) : [];
  const at = STOPS[stopFor(step)];
  const storedNow = step >= 3;
  const shift = at.x - STOPS[0].x;

  return (
    <div className="slide">
      <h2 className="slide-title">Svaret går samme vei som appens egne data</h2>
      <LineMap label="Svaret går fra nettleseren til appens backend, samme vei som appens egne data. Backenden veksler token og sender svaret til Lumi API, som bare tar imot fra apper på lista. Svaret lagres i databasen. Alt etter nettleseren ligger på Nais, samme plattform som resten av Navs apper.">
        <Zone
          x={540}
          y={330}
          width={1268}
          height={400}
          tone="nais"
          label="Navs plattform (Nais)"
          note="samme plattform som resten av Navs apper"
          labelAt="top"
          from={1}
        />
        <Line
          points={[
            [STOPS[0].x, OWN_DATA_Y],
            [STOPS[1].x, OWN_DATA_Y],
          ]}
          dim
        />
        <MapText
          x={STOPS[0].x}
          y={OWN_DATA_Y - 34}
          size={30}
          weight={500}
          muted
        >
          appens egne data
        </MapText>
        <Line
          points={[
            [STOPS[0].x, Y],
            [STOPS[3].x, Y],
          ]}
        />
        {STOPS.map((stop) => (
          <Station
            key={stop.label}
            x={stop.x}
            y={Y}
            side="below"
            label={stop.label}
            note={"note" in stop ? stop.note : undefined}
          />
        ))}
        <Answer
          x={STOPS[0].x}
          y={Y}
          r={40}
          style={{ transform: `translate(${shift}px, 0)` }}
        />
      </LineMap>

      <div className="vei__card">
        <div className="vei__card-head">
          {fromRoom ? (
            <span className="vei__source">Svaret fra i stad</span>
          ) : (
            <Tag kind="example" />
          )}
          <span className="vei__rating">dagen: {ratingText(payload)}</span>
        </div>
        {/*
          One row for the text. Until it reaches Lumi API it is the text as
          written. Then it shows what Lumi API stores: on the step it gets
          there, the text dissolves into the mask while the room watches.
        */}
        {text && (
          <p className="vei__text">
            <span className="vei__label">
              {storedNow ? "Lumi API lagrer" : "Fra nettleseren"}
            </span>
            <span className="vei__value">
              {storedNow
                ? stored.map((part, i) =>
                    part.masked && masked ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                      <mark key={i} className="vei__masked">
                        {part.text}
                      </mark>
                    ) : part.masked ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                      <span key={i} className="vei__leaving">
                        {part.original}
                      </span>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                      <span key={i}>{part.text}</span>
                    ),
                  )
                : text}
            </span>
          </p>
        )}
        <Reveal at={3} as="p" className="vei__text">
          <span className="vei__label">Hvem som svarte</span>
          <span className="vei__value">lagres ikke</span>
        </Reveal>
        <Reveal at={3} as="p" className="vei__note">
          Kjente mønstre maskeres. Navn gjør ikke det.
        </Reveal>
      </div>
    </div>
  );
}

export const sammeVei: Slide = {
  id: "samme-vei",
  title: "Svaret går samme vei som appens egne data",
  steps: 4,
  notes: `Inn: «Husker dere svaret fra i stad, med e-postadressen? Nå følger vi det.»

Svaret fra «Svar meg» reiser. Har ingen svart, står et eksempel.

Klikk 1: til appens backend. «Appens backend bytter brukerens innlogging mot en adgang til Lumi API.» TokenX eller Entra ID.
Klikk 2: til Lumi API. Bare apper på lista slipper inn.
Før klikk 3: «Hva tror dere Lumi lagrer av denne teksten? Skriv i chatten.» Vent noen sekunder.
Klikk 3: teksten står først som den ble skrevet, så løses e-postadressen opp. «E-postadressen er borte. Navn fjernes ikke, derfor har teamet en sletteknapp. Hvem som svarte, lagres ikke.»
Klikk 4: i databasen. «Der bor svaret. På Nais, der resten av Navs apper og data er. Lumi legger ikke til en ny leverandør.» Databasen er felles, og Team eSyfo drifter den.

Ut: «Hvem får lese svaret i dashboardet? Bare teamet deres.»`,
  Component: SammeVei,
};
