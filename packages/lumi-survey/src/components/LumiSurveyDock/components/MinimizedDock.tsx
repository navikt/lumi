import { ChatIcon } from "@navikt/aksel-icons";
import { Button } from "@navikt/ds-react";
import type { Ref } from "react";

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
    >
      {label}
    </Button>
  );
};

MinimizedDock.displayName = "LumiSurveyDockMinimized";
