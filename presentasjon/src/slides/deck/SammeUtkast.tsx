import forhandsvisning from "../../assets/skjermbilder/verksted-forhandsvisning.webp";
import provHele from "../../assets/skjermbilder/verksted-prov-hele.webp";
import rediger from "../../assets/skjermbilder/verksted-rediger.webp";
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
 * the wrong screenshot. A covered screenshot is hidden from screen readers,
 * so only the one on top is read.
 */
export function ShotFrame({
  shots,
  step,
}: {
  shots: readonly Shot[];
  step: number;
}) {
  const top = Math.max(
    ...shots.filter((shot) => shot.from <= step).map((shot) => shot.from),
  );
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
        <div
          key={`${shot.src}-${shot.from}`}
          className="shot__layer"
          data-from={shot.from}
          aria-hidden={shot.from < top ? true : undefined}
        >
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
      src: rediger,
      alt: "Et spørsmål redigeres i Surveyverksted: spørsmålsteksten Hva manglet?, svarformen Skriv et svar, og Hvem skal få spørsmålet: vises når svaret på Hadde du alt klart før møtet? er Nei.",
      crop: { x: 732, y: 336, width: 1455, height: 834 },
      mark: { x: 816, y: 955, width: 800, height: 130 },
    },
    name: "Hvem skal få spørsmålet?",
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
      src: versjon,
      alt: "Versjonen utvikleren får etter Del med utvikler: TypeScript, anbefalt, limes inn som en modul i appen. Med knappen Kopier TypeScript.",
      crop: { x: 252, y: 412, width: 1000, height: 573 },
      mark: { x: 405, y: 800, width: 388, height: 96 },
    },
    note: "Del med utvikler",
    name: "Kopier TypeScript",
  },
];

function SammeUtkast({ step }: SlideProps) {
  return (
    <div className="slide">
      <h2 className="slide-title">Hele teamet jobber i samme utkast</h2>
      <ShotFrame shots={STEPS.map((s) => s.shot)} step={step} />
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

Fra start: et spørsmål redigeres. Dere skriver teksten, velger hvordan de skal svare, og bestemmer hvem som får spørsmålet. Her vises «Hva manglet?» bare for dem som svarer «Nei».

Klikk 1: forhåndsvisningen i den ekte widgeten. Utkastet lagres for teamet, og forhåndsvisningen sender ingen svar.

Klikk 2: Prøv hele undersøkelsen.

Klikk 3: Del med utvikler gir en versjon med egen lenke. Utvikleren kopierer TypeScript-koden derfra.

Når man spør: teamet velger siden i appen. Widgeten kan starte som en liten knapp, og teamet bestemmer hvor lenge den blir borte etter at noen har svart eller lukket den.

Faggruppa: mer tid her. Du bør være ferdig med denne etter ti minutter.`,
  Component: SammeUtkast,
};
