import type { Slide } from "../../engine";
import { Answer, Line, LineMap, Station } from "../../map";
import "./avslutning.css";

/**
 * The case, from the owner. Replace the texts here and nothing else: the
 * title in at most eight words, the three texts in twelve words together.
 * A text that starts with «[TRENGER» is drawn dashed, as not there yet.
 * Show an answer on the slide only with <Tag kind="example" /> or
 * <Tag kind="screenshot" /> next to it.
 */
const CASE = {
  title: "[TRENGER: hva teamet endret, maks åtte ord]",
  asked: "[TRENGER: spørsmålet, appen og hvem som svarte]",
  saw: "[TRENGER: det dere så, og hvor mange svar]",
  changed: "[TRENGER: det dere endret, og hvordan dere ser om det hjalp]",
};

const Y = 540;
const COLUMNS = [112, 677, 1243] as const;
const RING = 22;
const DISC = 40;

function isPlaceholder(text: string) {
  return text.startsWith("[TRENGER");
}

function CaseText({ text }: { text: string }) {
  return (
    <p
      className={
        isPlaceholder(text)
          ? "caset__text caset__text--placeholder"
          : "caset__text"
      }
    >
      {text}
    </p>
  );
}

interface CaseStepProps {
  x: number;
  label: string;
  text: string;
  from: number;
}

function CaseStep({ x, label, text, from }: CaseStepProps) {
  return (
    <div className="end-at caset__step" data-from={from} style={{ left: x }}>
      <p className="end-label caset__label">{label}</p>
      <CaseText text={text} />
    </div>
  );
}

function Caset() {
  return (
    <div className="slide">
      <h2
        className={
          isPlaceholder(CASE.title)
            ? "slide-title caset__title--placeholder"
            : "slide-title"
        }
      >
        {CASE.title}
      </h2>
      <LineMap label="Caset i tre stasjoner på en linje: det vi spurte om, det vi så i svarene, og det vi endret.">
        <Line
          points={[
            [COLUMNS[0] + RING, Y],
            [COLUMNS[2] + RING, Y],
          ]}
        />
        <Station x={COLUMNS[0] + RING} y={Y} from={1} />
        <g data-from={2}>
          <Answer x={COLUMNS[1] + DISC} y={Y} r={DISC} />
        </g>
        <Station x={COLUMNS[2] + RING} y={Y} from={3} />
      </LineMap>
      <CaseStep
        x={COLUMNS[0]}
        label="Det vi spurte om"
        text={CASE.asked}
        from={1}
      />
      <CaseStep x={COLUMNS[1]} label="Det vi så" text={CASE.saw} from={2} />
      <CaseStep
        x={COLUMNS[2]}
        label="Det vi endret"
        text={CASE.changed}
        from={3}
      />
    </div>
  );
}

export const caset: Slide = {
  id: "caset",
  title: CASE.title,
  steps: 3,
  notes: `[TRENGER: caset]

Tre spørsmål du må svare på:
1. Hvilket spørsmål stilte dere, i hvilken app og til hvem?
2. Hva så dere i svarene som dere ikke visste fra før, og hvor mange svar bygde det på?
3. Hva gjorde dere annerledes etterpå, og hvordan ser dere om det hjalp?

Alt på sliden må tåle å være offentlig. Ekte fritekst skal ikke vises. Tall og mønstre går fint.

Klikk 1: Det vi spurte om. Klikk 2: Det vi så. Klikk 3: Det vi endret.

Tid: Med standard er du midt i denne etter 20 minutter.`,
  Component: Caset,
};
