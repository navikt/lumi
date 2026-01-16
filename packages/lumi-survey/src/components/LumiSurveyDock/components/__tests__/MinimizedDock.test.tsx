import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MinimizedDock } from "../MinimizedDock.js";

describe("MinimizedDock", () => {
  it("renders with correct label", () => {
    render(
      <MinimizedDock
        label="Gi tilbakemelding"
        panelId="test-panel"
        onReopen={vi.fn()}
        className="test-class"
      />,
    );

    expect(
      screen.getByRole("button", { name: /gi tilbakemelding/i }),
    ).toBeInTheDocument();
  });

  it("calls onReopen when clicked", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn();

    render(
      <MinimizedDock
        label="Gi tilbakemelding"
        panelId="test-panel"
        onReopen={onReopen}
        className="test-class"
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it("has correct aria attributes for accessibility", () => {
    render(
      <MinimizedDock
        label="Gi tilbakemelding"
        panelId="test-panel"
        onReopen={vi.fn()}
        className="test-class"
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-controls", "test-panel");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("applies custom className", () => {
    render(
      <MinimizedDock
        label="Gi tilbakemelding"
        panelId="test-panel"
        onReopen={vi.fn()}
        className="custom-class"
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });
});
