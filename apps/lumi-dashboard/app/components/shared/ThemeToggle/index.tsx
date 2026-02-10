import { MoonIcon, SunIcon } from "@navikt/aksel-icons";
import { Button, Tooltip } from "@navikt/ds-react";
import { useTheme } from "~/context/ThemeContext";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // Avoid flicker during hydration/loading
  if (!theme) {
    return <span aria-hidden="true" className={styles.placeholder} />;
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
