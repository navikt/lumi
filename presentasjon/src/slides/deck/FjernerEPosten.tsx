import { useId } from "react";
import shot from "../../assets/skjermbilder/dashboard-maskert.webp";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import "./premiss.css";

/*
 * The answer from mer-enn-vi-spor-om, as the team sees it: a row in the mock
 * dashboard (test data), opened. The text is set into a row Lumi had already
 * redacted, so the tag «Redigert» is the dashboard's own. The still is
 * 1146 × 372 CSS px of the dashboard at 1180 px wide, in 3×, and the window
 * shows it 1680 px wide: the UI text is about 26 px on the stage. Each click
 * lights two things in it, and the rest is dimmed, as on i-appen.
 */

const WINDOW = { width: 1680, height: 545 } as const;

/** A mark round a word or a control, in stage px from the window's corner. */
interface Mark {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Measured in the dashboard, times 1680 / 1146. */
const REMOVED: Mark = { x: 840, y: 472, width: 200, height: 37 };
const REDIGERT: Mark = { x: 426, y: 95, width: 124, height: 35 };
const NAME: Mark = { x: 330, y: 472, width: 169, height: 37 };
const DELETE: Mark = { x: 1616, y: 57, width: 35, height: 35 };

/** The light reaches a little past what it marks. */
const PAD = { x: 10, y: 6 } as const;

/** What each step lights. The rest of the window is dimmed. */
const LIT: Record<1 | 2, readonly Mark[]> = {
  1: [REMOVED, REDIGERT],
  2: [NAME, DELETE],
};

/** Shown on its own step only. */
function only(step: number, shown: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === shown ? "" : undefined,
  };
}

function FjernerEPosten({ step }: SlideProps) {
  // A mask id per instance: the overview and the print view show the slide twice.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="slide">
      <h2 className="fjerner__title">
        Lumi fjerner e-postadressen før svaret lagres
      </h2>
      <div className="fjerner__window">
        <img
          className="fjerner__shot"
          src={shot}
          width={WINDOW.width}
          height={WINDOW.height}
          alt="Skjermbilde fra dashboardet med testdata. Tilbakemeldingen er åpnet: vurderingen 1 av 5, og svaret på «Hva kan vi gjøre bedre?»: «Lederen min, Kari Nordmann, svarer ikke. Kontakt henne på [E-POST FJERNET]». Raden er merket Redigert og har en knapp for å slette svaret."
        />
        <svg
          className="fjerner__marks"
          viewBox={`0 0 ${WINDOW.width} ${WINDOW.height}`}
          aria-hidden="true"
        >
          <defs>
            {([1, 2] as const).map((at) => (
              <mask key={at} id={`${id}-${at}`}>
                <rect
                  width={WINDOW.width}
                  height={WINDOW.height}
                  fill="white"
                />
                {LIT[at].map((mark) => (
                  <rect
                    key={`${mark.x} ${mark.y}`}
                    x={mark.x - PAD.x}
                    y={mark.y - PAD.y}
                    width={mark.width + PAD.x * 2}
                    height={mark.height + PAD.y * 2}
                    rx={10}
                    fill="black"
                  />
                ))}
              </mask>
            ))}
          </defs>
          {([1, 2] as const).map((at) => (
            <rect
              key={at}
              className="fjerner__dim"
              width={WINDOW.width}
              height={WINDOW.height}
              mask={`url(#${id}-${at})`}
              {...only(step, at)}
            />
          ))}
        </svg>
      </div>
      <p className="fjerner__caption" data-from={2}>
        Navnet står igjen, men dere kan slette svaret.
      </p>
      <Tag kind="screenshot" className="fjerner__tag" />
    </div>
  );
}

export const fjernerEPosten: Slide = {
  id: "fjerner-e-posten",
  title: "Lumi fjerner e-postadressen før svaret lagres",
  steps: 2,
  notes: `Ordrett inn: «Slik ser teamet det samme svaret i dashboardet.»

Klikk 1: «E-postadressen ble fjernet før svaret ble lagret, og svaret er merket Redigert.» Lumi fjerner det som sikkert er personopplysninger: fødselsnummer, Nav-ident, e-post, telefonnummer, kortnummer og kontonummer.

Klikk 2: «Navn kan ikke Lumi kjenne igjen sikkert, så navnet står igjen. Da sletter teamet svaret, med knappen til høyre.»

Bildet er fra dashboardet med testdata. Teksten fra forrige slide er satt inn i et svar Lumi allerede hadde redigert.`,
  Component: FjernerEPosten,
};
