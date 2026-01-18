import { MoonIcon, SunIcon } from "@navikt/aksel-icons";
import { Button, Tooltip } from "@navikt/ds-react";
import { useTheme } from "~/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // Avoid flicker during hydration/loading
  if (!theme) {
    return (
      <Button
        data-color="neutral"
        variant="tertiary"
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
        data-color="neutral"
        variant="tertiary"
        size="small"
        onClick={toggleTheme}
        icon={
          theme === "light" ? <MoonIcon aria-hidden /> : <SunIcon aria-hidden />
        }
      />
    </Tooltip>
  );
}
