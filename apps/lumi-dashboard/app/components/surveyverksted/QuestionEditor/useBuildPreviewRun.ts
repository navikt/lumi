import { useCallback, useState } from "react";

interface BuildPreviewRun {
  /** Bumped whenever the build preview must start again. */
  run: number;
  /** Records the page the build preview moved to, without a restart. */
  showPage: (pageId: string) => void;
  /** Starts the build preview again on the selected page. */
  restart: () => void;
}

/**
 * Restarts the build preview when the author picks a page other than the one
 * it shows. The outline follows the respondent through showPage, which keeps
 * the preview running, so answers and «Tilbake» survive.
 */
export function useBuildPreviewRun(pageId: string): BuildPreviewRun {
  const [stage, setStage] = useState({ shownPageId: pageId, run: 0 });
  let current = stage;
  if (pageId !== stage.shownPageId) {
    current = { shownPageId: pageId, run: stage.run + 1 };
    setStage(current);
  }
  const showPage = useCallback((shownPageId: string) => {
    setStage((previous) =>
      previous.shownPageId === shownPageId
        ? previous
        : { ...previous, shownPageId },
    );
  }, []);
  const restart = useCallback(() => {
    setStage((previous) => ({ ...previous, run: previous.run + 1 }));
  }, []);
  return { run: current.run, showPage, restart };
}
