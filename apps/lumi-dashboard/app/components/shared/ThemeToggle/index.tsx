import { MoonIcon, SunIcon } from "@navikt/aksel-icons";
import { Button, Tooltip } from "@navikt/ds-react";
import { useTheme } from "~/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // Avoid flicker during hydration/loading
  if (!theme) {
    return (
      <Button
        variant="tertiary-neutral"
        size="small"
        disabled
        icon={<SunIcon aria-hidden className="opacity-0" />}
      />
    );
  }

  return (
    <Tooltip
      content={theme === "light" ? "Bytt til mørk modus" : "Bytt til lys modus"}
    >
      <Button
        variant="tertiary-neutral"
        size="small"
        onClick={toggleTheme}
        icon={
          theme === "light" ? <MoonIcon aria-hidden /> : <SunIcon aria-hidden />
        }
      />
    </Tooltip>
  );
}
