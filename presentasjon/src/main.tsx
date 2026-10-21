import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
import "./assets/fonts/fonts.css";
import "./theme.css";
import "./engine/deck.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AnswerProvider } from "./components/answerStore";
import { App } from "./engine/App";
import { readRoom, slidesForRoom } from "./engine/rooms";
import { assertValidSlides } from "./engine/validateSlides";
import { readViewMode } from "./engine/viewMode";
import { slides } from "./slides";
import { TrialView } from "./trial/TrialView";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Mangler #root for presentasjonen");
}

assertValidSlides(slides);
const search = window.location.search;
const trial = new URLSearchParams(search).has("prov");
const view = readViewMode(search);
const room = readRoom(search);
document.documentElement.dataset.deckView = trial ? "trial" : view;
if (room) document.documentElement.dataset.deckRoom = room;

createRoot(root).render(
  <StrictMode>
    {trial ? (
      <TrialView />
    ) : (
      <AnswerProvider>
        <App slides={slidesForRoom(slides, room)} view={view} />
      </AnswerProvider>
    )}
  </StrictMode>,
);
