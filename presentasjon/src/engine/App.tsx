import { useEffect } from "react";
import { Deck } from "./Deck";
import { PresenterView } from "./PresenterView";
import { PrintView } from "./PrintView";
import type { Slide } from "./types";
import type { ViewMode } from "./viewMode";

const TITLES: Record<ViewMode, string> = {
  audience: "Lumi – presentasjon",
  presenter: "Lumi – presentatørvisning",
  print: "Lumi – utskrift",
};

interface AppProps {
  slides: readonly Slide[];
  view: ViewMode;
}

export function App({ slides, view }: AppProps) {
  useEffect(() => {
    document.title = TITLES[view];
  }, [view]);

  if (view === "presenter") return <PresenterView slides={slides} />;
  if (view === "print") return <PrintView slides={slides} />;
  return <Deck slides={slides} />;
}
