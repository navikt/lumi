import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import { useAnswer } from "../../components/answerStore";
import { Tag } from "../../components/Tag";
import { maskLikeLumiApi } from "../../content/masking";
import { Reveal, type Slide, type SlideProps } from "../../engine";
import { Answer, Line, LineMap, Station, Zone } from "../../map";
import "./svar.css";

const Y = 570;
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

function SammeVei({ step }: SlideProps) {
  const { payload } = useAnswer();
  const fromRoom = payload !== null;
  const text = answerText(payload) ?? (fromRoom ? null : EXAMPLE_TEXT);
  const stored = text ? maskLikeLumiApi(text) : [];
  const at = STOPS[stopFor(step)];
  const shift = at.x - STOPS[0].x;

  return (
    <div className="slide">
      <h2 className="slide-title">Svaret går samme vei som appens egne data</h2>
      <LineMap label="Svaret går fra nettleseren til appens backend, som veksler token, videre til Lumi API, som bare tar imot fra apper på lista, og lagres i databasen. Alt etter nettleseren ligger på Nais, samme plattform som resten av Navs apper.">
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
        {text && (
          <p className="vei__text">
            <span className="vei__label">Fra nettleseren</span>
            <span className="vei__value">{text}</span>
          </p>
        )}
        {text && (
          <Reveal at={3} as="p" className="vei__text">
            <span className="vei__label">Lumi API lagrer</span>
            <span className="vei__value">
              {stored.map((part, i) =>
                part.masked ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                  <mark key={i} className="vei__masked">
                    {part.text}
                  </mark>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                  <span key={i}>{part.text}</span>
                ),
              )}
            </span>
          </Reveal>
        )}
      </div>
    </div>
  );
}

export const sammeVei: Slide = {
  id: "samme-vei",
  title: "Svaret går samme vei som appens egne data",
  steps: 4,
  notes: `Svaret fra «Svar meg» reiser. Har ingen svart, står et eksempel.

Klikk 1: til appens backend. Den veksler token, TokenX eller Entra ID.
Klikk 2: til Lumi API. Bare apper på lista slipper inn.
Klikk 3: det Lumi API lagrer. E-postadressen er maskert. Navn maskeres ikke.
Klikk 4: i databasen.

«Svarene blir på Nais, der resten av Navs apper og data er.»`,
  Component: SammeVei,
};
