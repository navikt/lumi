import start from "../../assets/skjermbilder/verksted-start.webp";
import utkast from "../../assets/skjermbilder/verksted-utkast.webp";
import versjon from "../../assets/skjermbilder/verksted-versjon.webp";
import { Tag } from "../../components/Tag";
import { type Slide, type SlideProps, useSlide } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { LineMap, MapText } from "../../map";
import { type Boks, Ramme } from "./SporsmalPeker";
import "./verksted.css";

/*
 * Surveyverksted in four steps, one per click, so the room can follow
 * what the team does. The stills are the mock Surveyverksted in the light
 * theme, taken 1100 CSS px wide and shown at 1.17 stage px per CSS px: the
 * page's whole width, with UI text at about 19 px. The line on the right
 * names the steps as Surveyverksted does. The step on screen is the team's
 * green, and a ring in the same green shows where to look. The question
 * and the preview are on the same page, so the camera scrolls down it.
 * The other steps are other pages, and fade in.
 */

/** The dashboard's width when the stills were taken, in CSS px. */
const SHOT_WIDTH = 1100;
const WINDOW = { x: 112, y: 140, width: 1290, height: 880 } as const;
const SCALE = WINDOW.width / SHOT_WIDTH;

type BildeId = "start" | "utkast" | "versjon";

/** The stills, cropped to what the steps show. Heights in CSS px. */
const BILDER: Record<BildeId, { src: string; height: number }> = {
  start: { src: start, height: 750 },
  utkast: { src: utkast, height: 2102 },
  versjon: { src: versjon, height: 750 },
};

interface Steg {
  /** The name Surveyverksted uses: a heading or a button. */
  label: string;
  bilde: BildeId;
  /** The top of the view in the still, in CSS px. */
  top: number;
  /** What the ring goes round, in the still's CSS px. */
  ring: Boks;
  /**
   * How far the ring stands out from it, sideways and up and down, and
   * its corners, in stage px. Sideways it leaves room for the label.
   */
  grow: readonly [number, number];
  radius: number;
  /** What the still shows, for screen readers. */
  alt: string;
}

/**
 * Measured in the stills: the question with its field, the question
 * text with its field, the widget and the TypeScript card.
 */
const STEG: readonly Steg[] = [
  {
    label: "Start et utkast",
    bilde: "start",
    top: 0,
    ring: { x: 41, y: 276, width: 364, height: 133 },
    grow: [18, 8],
    radius: 16,
    alt: "Surveyverksted med testdata. I Start et utkast er «Hvordan opplevde brukeren tjenesten?» valgt under «Hva vil dere finne ut?». Utkastet heter Dagen så langt, og foreslått survey-ID er dagen-sa-langt.",
  },
  {
    label: "Rediger spørsmålet",
    bilde: "utkast",
    top: 0,
    ring: { x: 381, y: 326, width: 670, height: 101 },
    grow: [16, 10],
    radius: 16,
    alt: "Utkastet Dagen så langt. Spørsmålsteksten er skrevet om til «Hvordan har dagen vært så langt?», og svaret er en vurdering.",
  },
  {
    label: "Forhåndsvis siden",
    bilde: "utkast",
    top: 1340,
    ring: { x: 651, y: 1567, width: 382, height: 504 },
    grow: [8, 8],
    radius: 20,
    alt: "Lenger ned på siden viser forhåndsvisningen widgeten: «Hvordan har dagen vært så langt?» med fem smilefjes, «Hva kan vi gjøre bedre? (valgfritt)», varselet om personopplysninger og knappen Send.",
  },
  {
    label: "Del med utvikler",
    bilde: "versjon",
    top: 0,
    ring: { x: 16, y: 279, width: 328, height: 240 },
    grow: [4, 4],
    radius: 18,
    alt: "Versjon 1 er delt. Under «Ta surveyen inn i appen» står pnpm add @navikt/lumi-survey, kortet TypeScript med knappen Kopier TypeScript, og kortet JSON-dokument.",
  },
];

/** A ring's place on the stage, from the still's CSS px. */
function ringOnStage({ ring, top, grow: [gx, gy] }: Steg): Boks {
  return {
    x: Math.round(WINDOW.x + ring.x * SCALE - gx),
    y: Math.round(WINDOW.y + (ring.y - top) * SCALE - gy),
    width: Math.round(ring.width * SCALE + gx * 2),
    height: Math.round(ring.height * SCALE + gy * 2),
  };
}

/**
 * Where a still's view is for a step: where the step is, if it shows this
 * still. Otherwise where the still was last, or where it will first be,
 * so a still that fades does not move.
 */
function topFor(bilde: BildeId, step: number): number {
  const own = STEG.map((steg, index) => ({ steg, index })).filter(
    ({ steg }) => steg.bilde === bilde,
  );
  const past = own.filter(({ index }) => index <= step);
  return (past.at(-1) ?? own[0]).steg.top;
}

/** The line of steps, right of the window and clear above the Teams corner. */
const ROUTE_X = 1452;
const STOP_Y = [212, 400, 588, 776] as const;
const FIRST_Y = STOP_Y[0];
const LAST_Y = STOP_Y[STOP_Y.length - 1];
const LABEL_X = ROUTE_X + 46;

function stopState(index: number, step: number) {
  if (index === step) return "her";
  return index < step ? "gjort" : "senere";
}

function SammeUtkast({ step, active }: SlideProps) {
  const { mode } = useSlide();
  const current = Math.min(Math.max(step, 0), STEG.length - 1);
  // Rings draw themselves when the slide is presented, and are just there
  // in print and in the overview.
  const live = active || mode !== "stage";
  const travelled = (STOP_Y[current] - FIRST_Y) / (LAST_Y - FIRST_Y);
  return (
    <div className="slide verksted-steg">
      <h2 className="verksted-film__title">
        <span className="verksted-film__hva">Dere lager surveyen i</span>{" "}
        <span className="verksted-film__navn">Surveyverksted</span>
      </h2>
      <Tag kind="screenshot" className="verksted-steg__tag" />

      <div className="verksted-film__window verksted-steg__window">
        {(Object.keys(BILDER) as BildeId[]).map((id) => {
          const shown = STEG[current].bilde === id;
          return (
            <img
              key={id}
              className="verksted-steg__bilde"
              src={BILDER[id].src}
              alt={shown ? STEG[current].alt : ""}
              aria-hidden={shown ? undefined : true}
              width={WINDOW.width}
              height={Math.round(BILDER[id].height * SCALE)}
              data-vist={shown ? "" : undefined}
              style={{
                transform: `translateY(${Math.round(-topFor(id, current) * SCALE)}px)`,
              }}
            />
          );
        })}
      </div>

      <LineMap
        className="verksted-steg__kart"
        label={`Steg ${current + 1} av ${STEG.length} i Surveyverksted: ${STEG[current].label}. Stegene er ${STEG.map((steg) => steg.label).join(", ")}.`}
      >
        {STEG.map((steg, index) => (
          <Ramme
            key={steg.label}
            boks={ringOnStage(steg)}
            on={index === current && live}
            tone="team"
            radius={steg.radius}
            // After the fade, or after the camera has scrolled down.
            start={index === 2 ? 1000 : 350}
          />
        ))}

        <path
          d={`M${ROUTE_X} ${FIRST_Y} V${LAST_Y}`}
          className="map-line map-line--dim"
        />
        <path
          d={`M${ROUTE_X} ${FIRST_Y} V${LAST_Y}`}
          pathLength={1}
          className="map-line verksted-steg__rute"
          style={cssVars({ "--igjen": 1 - travelled })}
        />
        {STEG.map((steg, index) => (
          <g
            key={steg.label}
            className={cx(
              "verksted-steg__stopp",
              `verksted-steg__stopp--${stopState(index, current)}`,
            )}
          >
            <circle cx={ROUTE_X} cy={STOP_Y[index]} r={20} />
            <MapText
              x={LABEL_X}
              y={STOP_Y[index]}
              size={34}
              weight={800}
              className="verksted-steg__navn"
            >
              {steg.label}
            </MapText>
          </g>
        ))}
      </LineMap>
    </div>
  );
}

export const sammeUtkast: Slide = {
  id: "samme-utkast",
  title: "Dere lager surveyen i Surveyverksted",
  steps: STEG.length - 1,
  Component: SammeUtkast,
};
