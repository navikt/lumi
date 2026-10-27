import { useEffect } from "react";
import { Deck } from "./Deck";
import { PrintView } from "./PrintView";
import type { Slide } from "./types";
import type { DeckView } from "./viewMode";

const TITLES: Record<DeckView, string> = {
  audience: "Lumi",
  print: "Lumi til utskrift",
};

interface AppProps {
  slides: readonly Slide[];
  view: DeckView;
}

export function App({ slides, view }: AppProps) {
  useEffect(() => {
    document.title = TITLES[view];
  }, [view]);

  if (view === "print") return <PrintView slides={slides} />;
  return <Deck slides={slides} />;
}
