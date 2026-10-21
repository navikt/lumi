import { useCallback, useState } from "react";
import { toggleFullscreen } from "./fullscreen";
import { HelpDialog } from "./HelpDialog";
import { lastStepOf, upcomingPosition } from "./navigation";
import { OverviewDialog } from "./OverviewDialog";
import { SlidePreview } from "./SlidePreview";
import type { Slide } from "./types";
import { useDeckController } from "./useDeckController";
import { useDeckKeyboard } from "./useDeckKeyboard";
import { useNow } from "./useNow";
import { formatDuration, useTimer } from "./useTimer";

const clockFormat = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
});

interface PresenterViewProps {
  slides: readonly Slide[];
}

/**
 * Presenter window (`?presenter`): current slide, what comes next, notes,
 * timer and clock. Navigation here moves the audience window too.
 */
export function PresenterView({ slides }: PresenterViewProps) {
  const deck = useDeckController(slides);
  const { index, step, black } = deck.state;
  const slide = slides[index];
  const lastStep = lastStepOf(slide);
  const upcoming = upcomingPosition(slides, deck.state);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const now = useNow(500);
  const timer = useTimer(now);

  const releaseFocus = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

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
      releaseFocus,
    },
    !overviewOpen && !helpOpen,
  );

  const upcomingLabel = (() => {
    if (!upcoming) return null;
    if (upcoming.index === index) {
      return `Steg ${upcoming.step + 1} av ${lastStep + 1}`;
    }
    return slides[upcoming.index]?.title ?? "";
  })();

  return (
    <div className="presenter">
      <section className="presenter__current" aria-labelledby="presenter-now">
        <h2 id="presenter-now" className="presenter__label">
          Nå: {slide?.title}
          {black && <span className="presenter__flag">Svart skjerm</span>}
        </h2>
        <SlidePreview
          slides={slides}
          position={{ index, step }}
          mode="preview"
          active
          className="presenter__stage"
        />
      </section>

      <div className="presenter__side">
        <section className="presenter__next" aria-labelledby="presenter-next">
          <h2 id="presenter-next" className="presenter__label">
            Neste
          </h2>
          {upcoming ? (
            <>
              <SlidePreview
                slides={slides}
                position={upcoming}
                mode="preview"
                className="presenter__upcoming"
              />
              <p className="presenter__caption">{upcomingLabel}</p>
            </>
          ) : (
            <p className="presenter__end">Slutt på presentasjonen</p>
          )}
        </section>

        <section className="presenter__notes" aria-labelledby="presenter-notes">
          <h2 id="presenter-notes" className="presenter__label">
            Notater
          </h2>
          {slide?.notes?.trim() ? (
            <div className="presenter__notes-text">{slide.notes.trim()}</div>
          ) : (
            <p className="presenter__muted">Ingen notater.</p>
          )}
        </section>
      </div>

      <footer className="presenter__bar">
        <p className="presenter__position">
          <span className="presenter__count">
            {index + 1} / {slides.length}
          </span>
          {lastStep > 0 && (
            <span className="presenter__muted">
              Steg {step + 1} av {lastStep + 1}
            </span>
          )}
        </p>

        <div className="presenter__controls">
          <button type="button" className="deck-button" onClick={deck.previous}>
            Forrige
          </button>
          <button type="button" className="deck-button" onClick={deck.next}>
            Neste
          </button>
          <button
            type="button"
            className="deck-button"
            aria-pressed={black}
            onClick={deck.toggleBlack}
          >
            Svart skjerm
          </button>
        </div>

        <div className="presenter__timer">
          <span className="presenter__label">Tid</span>
          <span className="presenter__time">
            {formatDuration(timer.elapsedMs)}
          </span>
          <button
            type="button"
            className="deck-button"
            onClick={timer.running ? timer.pause : timer.start}
          >
            {timer.running ? "Pause" : "Start"}
          </button>
          <button type="button" className="deck-button" onClick={timer.reset}>
            Nullstill
          </button>
        </div>

        <p className="presenter__clock">
          <span className="presenter__label">Klokka</span>
          <time className="presenter__time">{clockFormat.format(now)}</time>
        </p>
      </footer>

      {pendingNumber && (
        <div className="deck-badge" aria-hidden="true">
          Gå til lysbilde {pendingNumber}
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
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
