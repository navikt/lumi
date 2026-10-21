import { useCallback, useEffect, useRef, useState } from "react";
import { DeckNav } from "./DeckNav";
import { FittedStage } from "./FittedStage";
import { toggleFullscreen } from "./fullscreen";
import { HelpDialog } from "./HelpDialog";
import { lastStepOf } from "./navigation";
import { OverviewDialog } from "./OverviewDialog";
import { SlideFrame } from "./SlideFrame";
import type { Slide } from "./types";
import { useDeckController } from "./useDeckController";
import { useDeckKeyboard } from "./useDeckKeyboard";
import { useSingleKeyShortcuts } from "./useSingleKeyShortcuts";
import { useSwipe } from "./useSwipe";
import { PRESENTER_WINDOW_NAME, presenterUrl } from "./viewMode";

const NOTICE_MS = 5000;

interface DeckProps {
  slides: readonly Slide[];
}

/** The audience view: one scaled stage with the presented slide. */
export function Deck({ slides }: DeckProps) {
  const deck = useDeckController(slides);
  const { index, step, black } = deck.state;
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const singleKeys = useSingleKeyShortcuts();
  const noDialog = !overviewOpen && !helpOpen;

  const releaseFocus = useCallback(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  const openPresenter = useCallback(() => {
    const popup = window.open(
      presenterUrl(),
      PRESENTER_WINDOW_NAME,
      "popup,width=1280,height=800",
    );
    if (!popup) {
      const message =
        "Nettleseren stoppet presentatørvisningen. Tillat sprettoppvinduer for siden og trykk P igjen.";
      setNotice(message);
      setAnnouncement(message);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const pendingNumber = useDeckKeyboard(
    {
      next: deck.next,
      previous: deck.previous,
      first: deck.first,
      last: deck.last,
      goToSlide: deck.goToSlide,
      toggleOverview: () => setOverviewOpen((open) => !open),
      toggleFullscreen,
      toggleBlack: deck.toggleBlack,
      exitBlack: () => deck.setBlack(false),
      openHelp: () => setHelpOpen(true),
      openPresenter,
      releaseFocus,
    },
    noDialog,
    singleKeys.enabled,
  );
  useSwipe({ next: deck.next, previous: deck.previous }, noDialog);

  // A new slide is announced with its title, a build step on its own.
  const announcedRef = useRef({ index, step, black });
  useEffect(() => {
    const previous = announcedRef.current;
    announcedRef.current = { index, step, black };
    if (previous.index !== index) {
      setAnnouncement(
        `Lysbilde ${index + 1} av ${slides.length}: ${slides[index]?.title ?? ""}`,
      );
    } else if (previous.step !== step) {
      setAnnouncement(`Steg ${step + 1} av ${lastStepOf(slides[index]) + 1}`);
    } else if (previous.black !== black) {
      setAnnouncement(black ? "Svart skjerm" : "Svart skjerm av");
    }
  }, [index, step, black, slides]);

  // The presented slide and its neighbours stay mounted, so stepping and
  // going back and forth keeps live state such as the widget's answers.
  const mounted = [index - 1, index, index + 1].filter(
    (candidate) => candidate >= 0 && candidate < slides.length,
  );
  const stepFor = (candidate: number): number => {
    if (candidate === index) return step;
    return candidate < index ? lastStepOf(slides[candidate]) : 0;
  };

  return (
    <main className="deck" aria-label="Presentasjon">
      <FittedStage className="deck-viewport" stageRef={stageRef} focusable>
        {mounted.map((candidate) => {
          const slide = slides[candidate];
          return (
            <SlideFrame
              key={slide.id}
              slide={slide}
              index={candidate}
              total={slides.length}
              step={stepFor(candidate)}
              active={candidate === index}
              hidden={candidate !== index}
              mode="stage"
            />
          );
        })}
      </FittedStage>
      {black && <div className="deck-blackout" />}
      <div className="deck-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <DeckNav
        index={index}
        total={slides.length}
        onPrevious={deck.previous}
        onNext={deck.next}
        onHelp={() => setHelpOpen(true)}
      />
      {pendingNumber && (
        <div className="deck-badge" aria-hidden="true">
          Gå til lysbilde {pendingNumber}
        </div>
      )}
      {notice && (
        <div className="deck-badge" aria-hidden="true">
          {notice}
        </div>
      )}
      <OverviewDialog
        open={overviewOpen}
        slides={slides}
        currentIndex={index}
        onSelect={(selected) => {
          deck.goTo({ index: selected, step: 0 });
          setOverviewOpen(false);
        }}
        onClose={() => setOverviewOpen(false)}
      />
      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        singleKeys={singleKeys.enabled}
        onSingleKeysChange={singleKeys.setEnabled}
        swipe
      />
    </main>
  );
}
