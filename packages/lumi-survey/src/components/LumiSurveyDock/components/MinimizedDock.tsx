import { ChatIcon } from "@navikt/aksel-icons";
import { Button } from "@navikt/ds-react";
import type { Ref } from "react";
import { DEFAULT_COPY } from "../../shared/commonDefaults.js";
import { builtInCopyLang } from "../../shared/surveyLanguage.js";

interface MinimizedDockProps {
  label: string;
  onReopen: () => void;
  className: string;
  buttonRef?: Ref<HTMLButtonElement>;
}

export const MinimizedDock = ({
  label,
  onReopen,
  className,
  buttonRef,
}: MinimizedDockProps) => {
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="primary"
      size="medium"
      icon={<ChatIcon aria-hidden />}
      onClick={onReopen}
      className={className}
      // A label replaced through `labels` inherits the page language.
      lang={builtInCopyLang(label === DEFAULT_COPY.minimizedButtonLabel)}
    >
      {label}
    </Button>
  );
};

MinimizedDock.displayName = "LumiSurveyDockMinimized";
