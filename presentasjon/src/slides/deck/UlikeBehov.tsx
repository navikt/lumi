import type { Slide } from "../../engine";
import { cx } from "../../engine/css";
import "./bevis.css";

/**
 * Two rows of the same form and weight: placement, not ranking. The kind of
 * tool, not a product: Nav has used several tools from vendors. Lumi's
 * limit is set as strongly as the facts, since it is what decides for the
 * open pages on nav.no.
 */
const TOOLS = [
  { name: "Eksterne verktøy", how: "Uten utvikler", where: "også åpne sider" },
  {
    name: "Lumi",
    how: "I appens kode",
    where: "krever innlogging",
    limit: true,
  },
] as const;

function UlikeBehov() {
  return (
    <div className="slide verktoy">
      <h2 className="verktoy__title">
        Eksterne verktøy og Lumi passer til ulike behov
      </h2>
      <ul className="verktoy__rows">
        {TOOLS.map((tool) => (
          <li key={tool.name} className="verktoy__row">
            <span className="verktoy__name">{tool.name}</span>
            <span className="verktoy__facts">
              <span className="verktoy__how">{tool.how}</span>
              <span
                className={cx(
                  "verktoy__where",
                  "limit" in tool && "verktoy__where--limit",
                )}
              >
                {tool.where}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="verktoy__choice" data-from={1}>
        Teamet velger hvem som lager surveyen,
        <br />
        og om svaret skal bli i Nav.
      </p>
    </div>
  );
}

export const ulikeBehov: Slide = {
  id: "ulike-behov",
  title: "Eksterne verktøy og Lumi passer til ulike behov",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Si bare hva hver type verktøy passer til.

Ordrett: «Skal noen publisere surveyer uten utvikler, er eksterne verktøy laget for det.»

Lumi krever innlogget bruker i oppsettet vi dokumenterer, fordi appens backend veksler brukerens token. For åpne sider på nav.no er det dette som avgjør.

Klikk 1: «Teamet velger hvem som lager surveyen, og om svaret skal bli i Nav.»`,
  Component: UlikeBehov,
};
