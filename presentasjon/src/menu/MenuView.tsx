import { useEffect } from "react";
import { ROOM_PARAM, ROOMS, slidesForRoom } from "../engine/rooms";
import type { Room, Slide } from "../engine/types";
import { readViewMode } from "../engine/viewMode";
import { SnokulaBilde } from "../slides/deck/snokula/Snokula";
import "./menu.css";

/**
 * Each talk, and who it is for. The soft hyphens let the long name break
 * on a narrow phone instead of running out of its card.
 */
const TALKS: Record<Room, { name: string; audience: string }> = {
  faggruppa: {
    name: "Faggruppa Design for fagsystemer",
    audience: "For dere som lager fagsystemer.",
  },
  frontend: {
    name: "Frontend forum",
    audience: "For dere som utvikler, med de tekniske lysbildene.",
  },
  produktledere: {
    name: "Produkt\u00adleder\u00adakademiet",
    audience: "For dere som leder produktteam.",
  },
};

interface MenuViewProps {
  /** Every slide in the deck. Each talk counts its own. */
  slides: readonly Slide[];
  /** The style the page was opened with. A talk opens in the same one. */
  stil: string;
}

/**
 * The front page, when the address names no room, print view, phone page
 * or slide: the talks, and where to go next.
 */
export function MenuView({ slides, stil }: MenuViewProps) {
  useEffect(() => {
    document.title = "Foredrag om Lumi";
  }, []);

  // A link to a slide, opened while the front page shows, opens the deck.
  useEffect(() => {
    const onHashChange = () => {
      const { search, hash } = window.location;
      if (readViewMode(search, hash, slides) !== "menu") {
        window.location.reload();
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [slides]);

  const withStil = stil === "natt" ? "" : `&stil=${stil}`;

  return (
    <main className="menu">
      <div className="menu__cover">
        <h1 className="menu__title">Lumi</h1>
        <p className="menu__lead">
          Et foredrag om surveyer der svaret blir i Nav, i én utgave for hvert
          publikum.
        </p>
        <SnokulaBilde />
      </div>
      <ul className="menu__talks">
        {ROOMS.map((room) => {
          const { name, audience } = TALKS[room];
          return (
            <li key={room} className="menu__talk">
              <h2 className="menu__talk-title">
                <a href={`?${ROOM_PARAM}=${room}${withStil}`}>{name}</a>
              </h2>
              <p className="menu__talk-audience">{audience}</p>
              <p className="menu__talk-count">
                {slidesForRoom(slides, room).length} lysbilder
              </p>
              <a
                className="menu__talk-pdf"
                href={`?print&${ROOM_PARAM}=${room}`}
              >
                Skriv ut eller lagre som PDF
                <span className="deck-sr-only">, {name}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <h2 className="menu__more-title">Mer om Lumi</h2>
      <ul className="menu__more">
        <li>
          <a href="?prov">Prøv widgeten på mobilen</a>
          <p>Den ekte widgeten, der svaret blir på telefonen.</p>
        </li>
        <li>
          <a href="https://navikt.github.io/lumi/">Dokumentasjonen</a>
          <p>Slik kommer dere i gang med Lumi.</p>
        </li>
      </ul>
    </main>
  );
}
