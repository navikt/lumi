import type { Slide } from "../../engine";
import { Answer, Line, LineMap, Station } from "../../map";
import "./deck.css";

/*
 * The dot of «?» in the title, measured on the glyph: Overpass 800 at 310 px
 * with the monument tracking, the h1 at (112, 168) and a line height of 0.9
 * (see .tittel__title). The dot is round, 54 px across. Move the title and the
 * dot must be measured again.
 */
const DOT = { x: 1023.9, y: 641.4 } as const;
/** The empty station and the answer are both the size of the dot. */
const RING_R = 23;
const DISC_R = 24;
/** Outer edge of the ring: half its stroke outside the radius. */
const RING_EDGE = RING_R + 5;
/** The line comes in low from the left edge and rises into the dot. */
const LINE_Y = 900;

/**
 * The opening. Step 0 waits: the title, with the dot of the question mark as
 * an empty station. On the first click the line draws in and the dot lights:
 * the answer.
 */
function Tittel() {
  return (
    <div className="slide tittel">
      <p className="tittel__kicker">
        Lumi: surveyer i appen, svar på Navs plattform
      </p>
      <h1 className="tittel__title">
        Hvor bor
        <br />
        svaret?
      </h1>
      <p className="tittel__byline">Audun Sørheim, Team eSyfo</p>
      <LineMap label="En linje kommer inn fra venstre kant og stiger opp i prikken under spørsmålstegnet. Prikken er et svar, tegnet som en gyllen skive.">
        <Line
          points={[
            [-20, LINE_Y],
            [DOT.x, LINE_Y],
            [DOT.x, DOT.y + RING_EDGE],
          ]}
          radius={110}
          draw
          from={1}
          className="tittel__line"
        />
        <Station x={DOT.x} y={DOT.y} r={RING_R} />
        <Answer x={DOT.x} y={DOT.y} r={DISC_R} flash from={1} />
      </LineMap>
    </div>
  );
}

export const tittel: Slide = {
  id: "tittel",
  title: "Hvor bor svaret?",
  steps: 1,
  notes: `Fra start står tittelen med en tom stasjon som prikk i spørsmålstegnet. Den kan stå som ventebilde mens folk kommer inn.

Klikk 1 når foredraget starter: linja tegnes inn, og prikken tennes. Vent to sekunder i stillhet.

Så, ordrett: «Jeg heter Audun Sørheim og er utvikler i Team eSyfo, som lager Lumi. Den gule prikken er et svar fra en bruker. I dag skal jeg vise dere hvor det havner.»

Faggruppa: «Om tjue minutter vet dere hvordan dere kan spørre brukerne av fagsystemet deres, og hvor svaret bor. Ha ett spørsmål i bakhodet: hva skulle dere gjerne visst om hvordan fagsystemet deres blir brukt? Det tar vi med i gruppene.»`,
  Component: Tittel,
};
