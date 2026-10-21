import delMedUtvikler from "../../assets/skjermbilder/verksted-del-med-utvikler.webp";
import forhandsvisning from "../../assets/skjermbilder/verksted-forhandsvisning.webp";
import provHele from "../../assets/skjermbilder/verksted-prov-hele.webp";
import start from "../../assets/skjermbilder/verksted-start.webp";
import versjon from "../../assets/skjermbilder/verksted-versjon.webp";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
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
  /** Controls marked with an ink frame, in the same pixels as `crop`. */
  marks?: readonly Box[];
  /** First build step that shows it. Later screenshots cover earlier ones. */
  from: number;
}

/** The screenshot frame on the stage, below the title and clear of the Teams corner. */
export const FRAME = { x: 112, y: 336, width: 1000, height: 573 } as const;
const MARK_PAD = 10;

/** The mark in frame pixels: the control and some room round it. */
function markStyle(mark: Box, crop: Box, scale: number) {
  return {
    left: (mark.x - crop.x) * scale - MARK_PAD,
    top: (mark.y - crop.y) * scale - MARK_PAD,
    width: mark.width * scale + MARK_PAD * 2,
    height: mark.height * scale + MARK_PAD * 2,
  };
}

/**
 * Screenshots stacked in one frame. Each one fades in over the one before,
 * with its own marks, so a mark never shows on the wrong screenshot.
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
      {shots.map((shot) => {
        const scale = FRAME.width / shot.crop.width;
        return (
          <div key={shot.src} className="shot__layer" data-from={shot.from}>
            <img className="shot__image" src={shot.src} alt={shot.alt} />
            {shot.marks?.map((mark) => (
              <span
                key={`${mark.x},${mark.y}`}
                className="shot__mark"
                style={markStyle(mark, shot.crop, scale)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The name of the marked control, beside the frame, with a small copy of the
 * mark. `note` names where it is. Shown only on its own build step.
 */
export function Callout({
  shown,
  name,
  note,
  className,
}: {
  shown: boolean;
  name: string;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("shot-callout", className)}
      data-reveal=""
      data-revealed={shown ? "" : undefined}
    >
      {note && <p className="shot-callout__note">{note}</p>}
      <p className="shot-callout__name">
        <span className="shot-callout__key" aria-hidden="true" />
        {name}
      </p>
    </div>
  );
}

interface Step {
  shot: Shot;
  /** The marked control, as named in Surveyverksted. */
  name?: string;
  note?: string;
}

const STEPS: readonly Step[] = [
  {
    shot: {
      from: 0,
      src: start,
      alt: "Start et utkast i Surveyverksted: Hva vil dere finne ut?, Navn på utkastet, Foreslått survey-ID og knappen Opprett utkast.",
      crop: { x: 0, y: 1060, width: 1640, height: 940 },
      marks: [{ x: 282, y: 1846, width: 968, height: 96 }],
    },
    name: "Opprett utkast",
  },
  {
    shot: {
      from: 1,
      src: forhandsvisning,
      alt: "Utkastet Etter dialogmøtet. Til venstre redigeres spørsmålet, til høyre viser forhåndsvisningen spørsmålet i den ekte widgeten.",
      crop: { x: 729, y: 466, width: 2439, height: 1398 },
      marks: [{ x: 2284, y: 746, width: 768, height: 1060 }],
    },
  },
  {
    shot: {
      from: 2,
      src: provHele,
      alt: "Utkastet med knappen Prøv hele undersøkelsen over forhåndsvisningen.",
      crop: { x: 1400, y: 131, width: 1800, height: 1031 },
      marks: [{ x: 2637, y: 312, width: 515, height: 96 }],
    },
    name: "Prøv hele undersøkelsen",
  },
  {
    shot: {
      from: 3,
      src: delMedUtvikler,
      alt: "Dialogen Del med utvikler: Klar til å dele versjon 1, med knappen Del versjon 1.",
      crop: { x: 1008, y: 660, width: 1183, height: 678 },
      marks: [{ x: 1760, y: 1176, width: 278, height: 96 }],
    },
    note: "Del med utvikler",
    name: "Del versjon 1",
  },
  {
    shot: {
      from: 4,
      src: versjon,
      alt: "Versjonssiden Ta surveyen inn i appen, med knappene Kopier TypeScript og Last ned JSON.",
      crop: { x: 230, y: 20, width: 1902, height: 1090 },
      marks: [{ x: 405, y: 800, width: 388, height: 96 }],
    },
    name: "Kopier TypeScript",
  },
];

function SammeUtkast({ step }: SlideProps) {
  return (
    <div className="slide">
      <h2 className="slide-title">Hele teamet jobber i samme utkast</h2>
      <ShotFrame shots={STEPS.map((s) => s.shot)} />
      <div className="shot-side">
        <Tag kind="screenshot" />
        {STEPS.map(
          (s) =>
            s.name && (
              <Callout
                key={s.shot.src}
                shown={step === s.shot.from}
                name={s.name}
                note={s.note}
              />
            ),
        )}
      </div>
      <p className="slide-text shot-text" data-from={1}>
        Utkastet lagres for teamet. Forhåndsvisningen sender ingen svar.
      </p>
      <RouteProgress at={0} />
    </div>
  );
}

export const sammeUtkast: Slide = {
  id: "samme-utkast",
  title: "Hele teamet jobber i samme utkast",
  steps: STEPS.length - 1,
  notes: `Alle i Nais-teamet jobber i samme utkast: designere, produktfolk og utviklere.

Fra start: Hva vil dere finne ut? og Opprett utkast.

Klikk 1: utkastet, med forhåndsvisningen i den ekte widgeten. Den sender ingenting. Utkastet lagres for teamet.

Klikk 2: Prøv hele undersøkelsen.

Klikk 3: Del med utvikler, så Del versjon 1.

Klikk 4: versjonssiden med Kopier TypeScript.

Når man spør: teamet velger siden i appen. Widgeten kan starte som en liten knapp, og teamet bestemmer hvor lenge den blir borte etter at noen har svart eller lukket den.

Faggruppa: mer tid her. Faggruppa er ferdig med denne etter ti minutter.`,
  Component: SammeUtkast,
};
