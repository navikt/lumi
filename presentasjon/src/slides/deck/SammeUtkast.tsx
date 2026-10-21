import delMedUtvikler from "../../assets/skjermbilder/verksted-del-med-utvikler.webp";
import forhandsvisning from "../../assets/skjermbilder/verksted-forhandsvisning.webp";
import provHele from "../../assets/skjermbilder/verksted-prov-hele.webp";
import start from "../../assets/skjermbilder/verksted-start.webp";
import versjon from "../../assets/skjermbilder/verksted-versjon.webp";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

/** A rectangle in the pixels of the source PNG (2× the browser's CSS px). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One screenshot in the frame, cut from a source PNG with cwebp. */
export interface Shot {
  src: string;
  alt: string;
  /** The cut, as given to `cwebp -crop`. Same aspect ratio as the frame. */
  crop: Box;
  /** The control marked with an ink frame, in the same pixels as `crop`. */
  mark?: Box;
  /** First build step that shows it. Later screenshots cover earlier ones. */
  from: number;
}

/** The screenshot frame on the stage, below the title and clear of the Teams corner. */
export const FRAME = { x: 112, y: 336, width: 1000, height: 573 } as const;
/** Room between the control and its ink frame. */
const MARK_PAD = 10;
/** The smallest ink frame, so a small control is still easy to find. */
const MARK_MIN = 64;
/** Callout names start here, right of the frame. */
const CALLOUT_X = 1160;
/** Room between the end of the line and the name. */
const CALLOUT_GAP = 20;
/** The line height of a callout name, so the line meets its middle. */
const NAME_LINE = 52;
const LINE_WIDTH = 6;

/** The mark in frame pixels: centred on the control, with room round it. */
function markBox(mark: Box, crop: Box) {
  const scale = FRAME.width / crop.width;
  const width = Math.max(mark.width * scale + MARK_PAD * 2, MARK_MIN);
  const height = Math.max(mark.height * scale + MARK_PAD * 2, MARK_MIN);
  return {
    left: (mark.x + mark.width / 2 - crop.x) * scale - width / 2,
    top: (mark.y + mark.height / 2 - crop.y) * scale - height / 2,
    width,
    height,
  };
}

/**
 * Screenshots stacked in one frame, tagged on its upper left edge. Each one
 * fades in over the one before, with its own mark, so a mark never shows on
 * the wrong screenshot.
 */
export function ShotFrame({ shots }: { shots: readonly Shot[] }) {
  return (
    <div
      className="shot"
      style={{
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.width,
        height: FRAME.height,
      }}
    >
      {shots.map((shot) => (
        <div key={shot.src} className="shot__layer" data-from={shot.from}>
          <img className="shot__image" src={shot.src} alt={shot.alt} />
          {shot.mark && (
            <span
              className="shot__mark"
              style={markBox(shot.mark, shot.crop)}
            />
          )}
        </div>
      ))}
      <Tag kind="screenshot" className="shot__tag" />
    </div>
  );
}

/**
 * The name of the marked control, right of the frame, joined to the mark by
 * an ink line. `note` names where it is. Shown only on its own build step.
 */
export function Callout({
  shown,
  crop,
  mark,
  name,
  note,
}: {
  shown: boolean;
  crop: Box;
  mark: Box;
  name: string;
  note?: string;
}) {
  const box = markBox(mark, crop);
  const y = FRAME.y + box.top + box.height / 2;
  const lineStart = FRAME.x + box.left + box.width;
  return (
    <div
      className="shot-callout"
      data-reveal=""
      data-revealed={shown ? "" : undefined}
    >
      <span
        className="shot-callout__line"
        style={{
          left: lineStart,
          top: y - LINE_WIDTH / 2,
          width: CALLOUT_X - CALLOUT_GAP - lineStart,
          height: LINE_WIDTH,
        }}
      />
      <div
        className="shot-callout__label"
        style={{ left: CALLOUT_X, top: y + NAME_LINE / 2 }}
      >
        {note && <p className="shot-callout__note">{note}</p>}
        <p
          className="shot-callout__name"
          style={{ lineHeight: `${NAME_LINE}px` }}
        >
          {name}
        </p>
      </div>
    </div>
  );
}

interface Step {
  shot: Shot;
  /** The marked control, as named in Surveyverksted. */
  name?: string;
  note?: string;
}

/*
 * Cut close, so the UI text is at least 22 px on the stage and keeps 24 px
 * clear of the frame: from the 1600×1000 screenshots at 2×, light theme.
 */
const STEPS: readonly Step[] = [
  {
    shot: {
      from: 0,
      src: start,
      alt: "Start et utkast i Surveyverksted: Navn på utkastet, Foreslått survey-ID og knappen Opprett utkast.",
      crop: { x: 172, y: 1300, width: 1190, height: 682 },
      mark: { x: 282, y: 1846, width: 968, height: 96 },
    },
    name: "Opprett utkast",
  },
  {
    shot: {
      from: 1,
      src: forhandsvisning,
      alt: "Forhåndsvisningen i den ekte widgeten: Hadde du alt klart før møtet?, med Ja og Nei, og Hva manglet? (valgfritt) med et tekstfelt.",
      crop: { x: 1832, y: 815, width: 1368, height: 784 },
    },
  },
  {
    shot: {
      from: 2,
      src: provHele,
      alt: "Utkastet med knappen Prøv hele undersøkelsen over forhåndsvisningen.",
      crop: { x: 2134, y: 264, width: 1066, height: 611 },
      mark: { x: 2637, y: 312, width: 515, height: 96 },
    },
    name: "Prøv hele undersøkelsen",
  },
  {
    shot: {
      from: 3,
      src: delMedUtvikler,
      alt: "Dialogen Del med utvikler: Klar til å dele versjon 1, med knappen Del versjon 1.",
      crop: { x: 1124, y: 681, width: 1087, height: 623 },
      mark: { x: 1760, y: 1176, width: 278, height: 96 },
    },
    note: "Del med utvikler",
    name: "Del versjon 1",
  },
  {
    shot: {
      from: 4,
      src: versjon,
      alt: "Versjonssiden: TypeScript, anbefalt, limes inn som en modul i appen. Med knappen Kopier TypeScript.",
      crop: { x: 252, y: 412, width: 1000, height: 573 },
      mark: { x: 405, y: 800, width: 388, height: 96 },
    },
    name: "Kopier TypeScript",
  },
];

function SammeUtkast({ step }: SlideProps) {
  return (
    <div className="slide">
      <h2 className="slide-title">Hele teamet jobber i samme utkast</h2>
      <ShotFrame shots={STEPS.map((s) => s.shot)} />
      <p className="slide-text shot-text" data-from={1}>
        Utkastet lagres for teamet. Forhåndsvisningen sender ingen svar.
      </p>
      {STEPS.map(
        ({ shot, name, note }) =>
          name &&
          shot.mark && (
            <Callout
              key={shot.src}
              shown={step === shot.from}
              crop={shot.crop}
              mark={shot.mark}
              name={name}
              note={note}
            />
          ),
      )}
      <RouteProgress at={0} />
    </div>
  );
}

export const sammeUtkast: Slide = {
  id: "samme-utkast",
  title: "Hele teamet jobber i samme utkast",
  steps: STEPS.length - 1,
  notes: `Alle i Nais-teamet jobber i samme utkast: designere, produktfolk og utviklere.

Fra start: navnet på utkastet, survey-ID-en Surveyverksted foreslår, og Opprett utkast.

Klikk 1: utkastet, med forhåndsvisningen i den ekte widgeten. Den sender ingenting. Utkastet lagres for teamet.

Klikk 2: Prøv hele undersøkelsen.

Klikk 3: Del med utvikler, så Del versjon 1.

Klikk 4: versjonssiden med Kopier TypeScript.

Når man spør: teamet velger siden i appen. Widgeten kan starte som en liten knapp, og teamet bestemmer hvor lenge den blir borte etter at noen har svart eller lukket den.

Faggruppa: mer tid her. Du bør være ferdig med denne etter ti minutter.`,
  Component: SammeUtkast,
};
