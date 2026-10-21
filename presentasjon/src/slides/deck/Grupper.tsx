import type { Slide } from "../../engine";
import "./avslutning.css";

/** Ordrett fra storyboarden. Gruppene svarer i denne rekkefølgen. */
const QUESTIONS = [
  "Hva skulle du gjerne visst om hvordan fagsystemet ditt blir brukt?",
  "Hvor i arbeidsflyten kan du spørre saksbehandlere og veiledere uten å forstyrre, og hvor må du la være?",
  "Hva må på plass før teamet ditt kan sette\u00a0i\u00a0gang den første surveyen, og hvem må si ja?",
  "Hva så du i dag som du vil ta med til teamet ditt, og hva savnet du?",
] as const;

function Grupper() {
  return (
    <div className="slide">
      <h2 className="slide-title">Gruppene svarer på fire spørsmål</h2>
      <ol className="grupper__list">
        {QUESTIONS.map((question, i) => (
          <li key={question} className="grupper__item">
            <span className="grupper__number" aria-hidden="true">
              {i + 1}
            </span>
            <span className="grupper__question">{question}</span>
          </li>
        ))}
      </ol>
      <p className="end-at slide-text grupper__chat" data-from={1}>
        Spørsmålene står også i chatten.
      </p>
    </div>
  );
}

export const grupper: Slide = {
  id: "grupper",
  title: "Gruppene svarer på fire spørsmål",
  rooms: ["faggruppa"],
  steps: 1,
  notes: `Lim inn spørsmålene i chatten før oppdeling. Be gruppene om notatene, så Team Flex også får dem.

1–3 i gruppene, 4 i plenum.

Avtal med verten hvor lenge gruppene varer.

Lumi samordner ikke surveyer mellom team. Spør flere team de samme folkene, må teamene snakke sammen.

Til chatten:
1. ${QUESTIONS[0]}
2. ${QUESTIONS[1]}
3. ${QUESTIONS[2]}
4. ${QUESTIONS[3]}`,
  Component: Grupper,
};
