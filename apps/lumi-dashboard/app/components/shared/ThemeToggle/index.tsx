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
        aria-label="Laster tema"
        title="Laster tema"
        icon={<SunIcon aria-hidden className="opacity-0" />}
      />
    );
  }

  const toggleLabel =
    theme === "light" ? "Bytt til mørk modus" : "Bytt til lys modus";

  return (
    <Tooltip content={toggleLabel}>
      <Button
        data-color="neutral"
        variant="tertiary"
        size="small"
        onClick={toggleTheme}
        aria-label={toggleLabel}
        title={toggleLabel}
        icon={
          theme === "light" ? <MoonIcon aria-hidden /> : <SunIcon aria-hidden />
        }
      />
    </Tooltip>
  );
}
