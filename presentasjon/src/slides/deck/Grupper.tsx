import type { Slide } from "../../engine";
import "./avslutning.css";

/**
 * From the storyboard, with «dere» throughout. The groups answer them in
 * this order.
 */
const QUESTIONS = [
  "Hva skulle dere gjerne visst om hvordan fagsystemet deres blir brukt?",
  "Hvor i arbeidsflyten kan dere spørre saksbehandlere og veiledere uten å forstyrre, og hvor må dere la være?",
  "Hva må på plass før teamet deres kan sette\u00a0i\u00a0gang den første surveyen, og hvem må si ja?",
  "Hva så dere i dag som dere vil ta med til teamet deres, og hva savnet dere?",
] as const;

function Grupper() {
  return (
    <div className="slide">
      <div className="end-at end-board grupper">
        <h2 className="grupper__title">Gruppene svarer på fire spørsmål</h2>
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
        <p className="grupper__chat" data-from={1}>
          Spørsmålene står også i chatten.
        </p>
      </div>
    </div>
  );
}

export const grupper: Slide = {
  id: "grupper",
  title: "Gruppene svarer på fire spørsmål",
  rooms: ["faggruppa"],
  steps: 1,
  notes: `Lim inn spørsmålene i chatten før gruppene går, og klikk. Be gruppene om notatene, så Team Flex også får dem.

Spørsmål én til tre i gruppene, fire i plenum.

Avtal med verten hvor lenge gruppene varer.

Lumi samordner ikke surveyer mellom team. Hvis flere team spør de samme folkene, må teamene snakke sammen.

Til chatten:
1. ${QUESTIONS[0]}
2. ${QUESTIONS[1]}
3. ${QUESTIONS[2].replaceAll("\u00a0", " ")}
4. ${QUESTIONS[3]}`,
  Component: Grupper,
};
