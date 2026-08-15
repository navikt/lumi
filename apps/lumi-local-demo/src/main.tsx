import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Mangler #root for Lumi local demo");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
