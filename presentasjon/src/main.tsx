import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
import "./assets/fonts/fonts.css";
import "./theme.css";
import "./engine/forced-colors.css";
import "./engine/deck.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AnswerProvider } from "./components/answerStore";
import { App } from "./engine/App";
import { readRoom, slidesForRoom } from "./engine/rooms";
import { assertValidSlides } from "./engine/validateSlides";
import { readViewMode } from "./engine/viewMode";
import { MenuView } from "./menu/MenuView";
import { slides } from "./slides";
import { TrialView } from "./trial/TrialView";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Mangler #root for presentasjonen");
}

assertValidSlides(slides);
const { search, hash } = window.location;
const view = readViewMode(search, hash, slides);
const room = readRoom(search);
document.documentElement.dataset.deckView = view;
// Night on the stage. Day with `?stil=dag`, or paper with `?stil=papir`
// for a bright room. Always paper for the PDF and the phone page.
const STILER = ["natt", "dag", "papir"] as const;
const wanted = new URLSearchParams(search).get("stil");
const stil =
  view === "trial" || view === "print"
    ? "papir"
    : (STILER.find((name) => name === wanted) ?? "natt");
document.documentElement.dataset.stil = stil;
if (room) document.documentElement.dataset.deckRoom = room;

function page() {
  if (view === "trial") return <TrialView />;
  if (view === "menu") return <MenuView slides={slides} stil={stil} />;
  return (
    <AnswerProvider>
      <App slides={slidesForRoom(slides, room)} view={view} />
    </AnswerProvider>
  );
}

createRoot(root).render(<StrictMode>{page()}</StrictMode>);
