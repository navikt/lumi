import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntroContent } from "../IntroContent.js";

describe("IntroContent", () => {
  it("renders title and start button with default label", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        startLabel="Start"
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /velkommen/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
  });

  it("renders body when provided", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        body="Vi vil gjerne høre din mening."
        startLabel="Start"
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/vi vil gjerne høre din mening/i),
    ).toBeInTheDocument();
  });

  it("does not render body when not provided", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        startLabel="Start"
        onStart={vi.fn()}
      />,
    );

    // Only heading and button, no BodyLong
    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders custom start label", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        startLabel="Begynn undersøkelsen"
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /begynn undersøkelsen/i }),
    ).toBeInTheDocument();
  });

  it("calls onStart when start button is clicked", async () => {
    const user = userEvent.setup();
    const handleStart = vi.fn();

    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        startLabel="Start"
        onStart={handleStart}
      />,
    );

    await user.click(screen.getByRole("button", { name: /start/i }));

    expect(handleStart).toHaveBeenCalledOnce();
  });

  it("renders heading at level 2", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        startLabel="Start"
        onStart={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Velkommen!");
  });

  it("renders ReactNode body content", () => {
    render(
      <IntroContent
        headingId="test-heading-id"
        title="Velkommen!"
        body={<span data-testid="custom-body">Rik tekst</span>}
        startLabel="Start"
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("custom-body")).toHaveTextContent("Rik tekst");
  });
});
