import { Theme } from "@navikt/ds-react/Theme";
import { act, render, screen } from "@testing-library/react";
import { Component, memo, type ReactNode, Suspense } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { resetThemeForTesting, ThemeProvider, useTheme } from "../ThemeContext";

type ThemeValue = ReturnType<typeof useTheme>;

const values: ThemeValue[] = [];

// Memoized like a chart: it only renders again when the theme changes.
const ThemeReader = memo(function ThemeReader() {
  const value = useTheme();
  values.push(value);
  return <span data-testid="theme">{value.theme ?? "unknown"}</span>;
});

// The root shell renders ThemeProvider again on every navigation.
function Shell({ path }: { path: string }) {
  return (
    <ThemeProvider>
      <Theme hasBackground={false} className="app-theme-root">
        <span>{path}</span>
        <ThemeReader />
      </Theme>
    </ThemeProvider>
  );
}

function themeRoot() {
  return document.querySelector(".app-theme-root");
}

// A fresh page: no theme chosen yet, nothing stored, light system preference.
function resetPage() {
  values.length = 0;
  resetThemeForTesting();
  localStorage.clear();
  delete window.__theme;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  document.body.removeAttribute("data-theme");
}

describe("ThemeProvider and useTheme", () => {
  beforeEach(resetPage);

  it("uses the theme that the theme script chose", () => {
    window.__theme = "dark";
    localStorage.setItem("lumi-theme-preference", "light");

    render(<Shell path="/" />);

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("falls back to the stored theme and then to the system preference", () => {
    localStorage.setItem("lumi-theme-preference", "dark");
    const { unmount } = render(<Shell path="/" />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    unmount();

    resetPage();
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
    } as MediaQueryList);
    render(<Shell path="/" />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(window.matchMedia).toHaveBeenLastCalledWith(
      "(prefers-color-scheme: dark)",
    );
  });

  it("applies the theme to the document and stores it when it mounts", () => {
    window.__theme = "dark";
    localStorage.setItem("theme", "dark");

    render(<Shell path="/" />);

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.body).toHaveAttribute("data-theme", "dark");
    expect(themeRoot()).toHaveClass("aksel-theme", "app-theme-root", "dark");
    expect(themeRoot()).not.toHaveClass("light");
    expect(localStorage.getItem("lumi-theme-preference")).toBe("dark");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("toggles the theme for every reader, the document and the stored preference", () => {
    render(
      <>
        <Shell path="/" />
        <ThemeReader />
      </>,
    );
    expect(themeRoot()).toHaveClass("light");

    act(() => values.at(-1)?.toggleTheme());

    for (const reader of screen.getAllByTestId("theme")) {
      expect(reader).toHaveTextContent("dark");
    }
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.body).toHaveAttribute("data-theme", "dark");
    expect(themeRoot()).toHaveClass("dark");
    expect(themeRoot()).not.toHaveClass("light");
    expect(localStorage.getItem("lumi-theme-preference")).toBe("dark");

    act(() => values.at(-1)?.toggleTheme());

    expect(screen.getAllByTestId("theme")[0]).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(themeRoot()).toHaveClass("light");
    expect(themeRoot()).not.toHaveClass("dark");
    expect(localStorage.getItem("lumi-theme-preference")).toBe("light");
  });

  it("does not render the readers again when the shell renders again", () => {
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

describe("ThemeProvider during hydration", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    resetPage();
    container = document.createElement("div");
    document.body.append(container);
    consoleError = vi.spyOn(console, "error");
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    container.remove();
    consoleError.mockRestore();
  });

  it("hydrates the server HTML without a mismatch and then shows the theme", async () => {
    const html = renderToString(<Shell path="/" />);
    expect(html).toContain("unknown");
    expect(html).toContain('class="aksel-theme app-theme-root"');

    // The theme script has chosen dark before the page hydrates.
    window.__theme = "dark";
    container.innerHTML = html;
    values.length = 0;
    const onRecoverableError = vi.fn();

    await act(async () => {
      root = hydrateRoot(container, <Shell path="/" />, {
        onRecoverableError,
      });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(values.map((value) => value.theme)).toEqual([undefined, "dark"]);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(themeRoot()).toHaveClass("dark");
  });

  // Like a route that failed during server rendering: TanStack Router renders
  // its error page on the server and throws the error again in the browser,
  // where the route's error boundary catches it. The routes sit in a Suspense
  // boundary that React hydrates after the shell. When the theme was a
  // context, setting it right after hydration made React render that boundary
  // at once, and React reported the route's error as recovered (#520).
  it("lets a route that failed on the server hydrate without a recovered error", async () => {
    const routeError = new Error("The route failed");
    let inBrowser = false;

    function FailingRoute(): ReactNode {
      if (inBrowser) throw routeError;
      return <p>En uventet feil oppstod</p>;
    }

    class RouteErrorBoundary extends Component<
      { children: ReactNode },
      { failed: boolean }
    > {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? (
          <p>En uventet feil oppstod</p>
        ) : (
          this.props.children
        );
      }
    }

    const page = (
      <ThemeProvider>
        <Theme hasBackground={false} className="app-theme-root">
          <Suspense fallback={null}>
            <ThemeReader />
            <RouteErrorBoundary>
              <FailingRoute />
            </RouteErrorBoundary>
          </Suspense>
        </Theme>
      </ThemeProvider>
    );

    container.innerHTML = renderToString(page);
    window.__theme = "dark";
    inBrowser = true;
    const onRecoverableError = vi.fn();
    const onCaughtError = vi.fn();

    await act(async () => {
      root = hydrateRoot(container, page, {
        onRecoverableError,
        onCaughtError,
      });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(onCaughtError).toHaveBeenCalledTimes(1);
    expect(onCaughtError.mock.calls[0]?.[0]).toBe(routeError);
    expect(container).toHaveTextContent("En uventet feil oppstod");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });
});
