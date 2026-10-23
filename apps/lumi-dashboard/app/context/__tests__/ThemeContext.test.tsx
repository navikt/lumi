import { act, render } from "@testing-library/react";
import { memo } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "../ThemeContext";

type ThemeValue = ReturnType<typeof useTheme>;

const values: ThemeValue[] = [];

// Memoized like a chart: it only renders again when the context changes.
const ThemeReader = memo(function ThemeReader() {
  values.push(useTheme());
  return null;
});

// The root shell renders ThemeProvider again on every navigation.
function Shell({ path }: { path: string }) {
  return (
    <ThemeProvider>
      <span>{path}</span>
      <ThemeReader />
    </ThemeProvider>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    values.length = 0;
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("keeps the context value when it renders again with the same theme", () => {
    const { rerender } = render(<Shell path="/" />);
    expect(values.at(-1)?.theme).toBe("light");
    const rendersBefore = values.length;

    rerender(<Shell path="/feedback" />);
    rerender(<Shell path="/feedback?team=team-esyfo" />);

    expect(values).toHaveLength(rendersBefore);
  });

  it("gives a new value with the same toggleTheme when the theme changes", () => {
    render(<Shell path="/" />);
    const light = values.at(-1);

    act(() => light?.toggleTheme());

    const dark = values.at(-1);
    expect(dark?.theme).toBe("dark");
    expect(dark).not.toBe(light);
    expect(dark?.toggleTheme).toBe(light?.toggleTheme);
  });
});
