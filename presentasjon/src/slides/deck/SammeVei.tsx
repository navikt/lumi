import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import type { ReactNode } from "react";
import { useAnswer } from "../../components/answerStore";
import { type MaskedPart, maskLikeLumiApi } from "../../content/masking";
import { Reveal, type Slide, type SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { Answer, Line, LineMap, MapText, Station, Zone } from "../../map";
import "./svar.css";

const Y = 288;
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
  "Fant ikke planen. Send svar til Ola Nordmann, ola.nordmann@example.com";
/** The name in the demo text. Lumi API leaves names as they are. */
const DEMO_NAME = "Ola Nordmann";

function answerText(payload: LumiSurveyTransportPayload | null): string | null {
  const answer = payload?.answers.find((item) => item.value.type === "text");
  return answer?.value.text || null;
}

/** The rating, for an answer from the room without text. */
function ratingText(payload: LumiSurveyTransportPayload | null): string | null {
  const answer = payload?.answers.find((item) => item.value.type === "rating");
  if (answer?.value.type !== "rating") return null;
  return `${answer.value.rating ?? "?"} av ${answer.value.ratingScale ?? "?"}`;
}

/** Which station the answer is at for each build step. Step 3 shows what is stored. */
const STOP_FOR_STEP = [0, 1, 2, 2, 3] as const;
/** The step where the stored text shows and the map steps back. */
const MASK_STEP = 3;

function stopFor(step: number): number {
  return STOP_FOR_STEP[Math.min(Math.max(step, 0), STOP_FOR_STEP.length - 1)];
}

/** About two lines of the 40 px text row. */
const MAX_CHARS = 104;

/**
 * The text cut to about two lines, so a long answer stays clear of the
 * title. A mask is kept whole or left out, so the slide never shows part of
 * an address as stored.
 */
function clip(parts: readonly MaskedPart[]): MaskedPart[] {
  const kept: MaskedPart[] = [];
  let used = 0;
  for (const part of parts) {
    // The address and its mark share a cell as wide as the wider of them.
    const width = Math.max(part.text.length, part.original?.length ?? 0);
    if (used + width <= MAX_CHARS) {
      kept.push(part);
      used += width;
      continue;
    }
    const room = part.masked ? 0 : MAX_CHARS - used - 1;
    kept.push({
      text: `${part.text.slice(0, room).trimEnd()}…`,
      masked: false,
    });
    break;
  }
  return kept;
}

/** The stored text with the demo name marked, so the slide can point at it. */
function withName(text: string): ReactNode {
  const at = text.indexOf(DEMO_NAME);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="vei__name">
        {DEMO_NAME}
        <span className="vei__name-note" aria-hidden="true">
          Navn fjernes ikke.
        </span>
      </span>
      {text.slice(at + DEMO_NAME.length)}
    </>
  );
}

function SammeVei({ step }: SlideProps) {
  const { payload } = useAnswer();
  const fromRoom = payload !== null;
  const text = answerText(payload) ?? (fromRoom ? null : EXAMPLE_TEXT);
  // Without text, the rating travels: it is stored as it is.
  const shown = text ?? ratingText(payload);
  const written = shown ? clip([{ text: shown, masked: false }]) : [];
  const stored = text ? clip(maskLikeLumiApi(text)) : written;
  const named = stored.some(
    (part) => !part.masked && part.text.includes(DEMO_NAME),
  );
  const at = STOPS[stopFor(step)];
  const storedNow = step >= MASK_STEP;
  const focusText = step === MASK_STEP;
  const shift = at.x - STOPS[0].x;

  return (
    <div className={cx("slide vei", focusText && "vei--text")}>
      <LineMap
        className="vei__map"
        label="Svaret går fra nettleseren til appens backend, samme vei som appens egne data. Backenden veksler token og sender svaret til Lumi API, som bare tar imot fra apper på lista. Svaret lagres i databasen. Alt etter nettleseren ligger på Nais, samme plattform som resten av Navs apper."
      >
        <Zone
          x={540}
          y={40}
          width={1404}
          height={440}
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
          size={32}
          weight={600}
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
          className="vei__answer"
          style={{ transform: `translate(${shift}px, 0)` }}
        />
      </LineMap>

      {/*
        The text answer. Until it reaches Lumi API it is the text as written.
        Then it is what Lumi API stores: on that step the address dissolves
        into the mark in the same place, and the name stays.
      */}
      {shown && (
        <div className="vei__answer-text">
          <p className="vei__row">
            <span className="vei__label">
              {storedNow
                ? "Lumi API lagrer"
                : fromRoom
                  ? "Svaret fra i stad"
                  : "Eksempel"}
            </span>
            <span className="vei__value">
              {storedNow
                ? stored.map((part, i) =>
                    part.masked ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                      <span key={i} className="vei__swap">
                        <span className="vei__was" aria-hidden="true">
                          {part.original}
                        </span>
                        <mark className="vei__mark">{part.text}</mark>
                      </span>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
                      <span key={i}>{withName(part.text)}</span>
                    ),
                  )
                : written.map((part) => part.text).join("")}
            </span>
            {storedNow && named && (
              <span className="deck-sr-only"> Navn fjernes ikke.</span>
            )}
          </p>
          {text && !named && (
            <Reveal at={MASK_STEP} as="p" className="vei__row">
              <span className="vei__label" />
              <span className="vei__plain">Navn fjernes ikke.</span>
            </Reveal>
          )}
          <Reveal at={MASK_STEP} as="p" className="vei__row vei__who">
            <span className="vei__label">Hvem som svarte</span>
            <span className="vei__plain">lagres ikke</span>
          </Reveal>
        </div>
      )}

      <h2 className="vei__title">Svaret går samme vei som appens egne data</h2>
    </div>
  );
}

export const sammeVei: Slide = {
  id: "samme-vei",
  title: "Svaret går samme vei som appens egne data",
  steps: 4,
  notes: `Inn: «Nå følger vi svaret fra i stad, det med navnet og e-postadressen.»

Svaret fra surveyen i starten reiser. Har ingen svart, står et eksempel med samme tekst.

Klikk 1: til appens backend. «Svaret går først til appens egen backend. Backenden veksler brukerens innlogging mot et token til Lumi API.» TokenX eller Entra ID.

Klikk 2: til Lumi API. «Lumi API tar bare imot fra apper på lista.»

Før klikk 3: «Hva tror dere Lumi lagrer av denne teksten? Skriv i chatten.» Vent noen sekunder.

Klikk 3: kartet trer tilbake, og e-postadressen løses opp. «E-postadressen er borte før svaret lagres. Navnet står igjen, for navn fjernes ikke. Derfor kan teamet slette et svar i dashboardet. Hvem som svarte, lagres ikke.»

Klikk 4: i databasen. «Der bor svaret, på Nais, der resten av Navs apper og data er. Lumi legger ikke til en ny leverandør.»

Ut: «I dashboardet er det bare teamet deres som kan lese svaret.»`,
  Component: SammeVei,
};
