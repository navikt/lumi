import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SuccessContent } from "../SuccessContent.js";

describe("SuccessContent", () => {
  it("renders title and body", () => {
    render(
      <SuccessContent
        title="Takk for tilbakemeldingen!"
        body="Vi setter pris på din tilbakemelding."
      />,
    );

    expect(
      screen.getByRole("heading", { name: /takk for tilbakemeldingen/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/vi setter pris på din tilbakemelding/i),
    ).toBeInTheDocument();
  });

  it("hides title when showTitle is false", () => {
    render(
      <SuccessContent
        title="Takk for tilbakemeldingen!"
        body="Vi setter pris på din tilbakemelding."
        showTitle={false}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: /takk for tilbakemeldingen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/vi setter pris på din tilbakemelding/i),
    ).toBeInTheDocument();
  });

  it("has live region attributes when announce is true", () => {
    const { container } = render(
      <SuccessContent
        title="Takk!"
        body="Vi setter pris på din tilbakemelding."
        announce={true}
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute("role", "status");
    expect(wrapper).toHaveAttribute("aria-live", "polite");
  });

  it("does not have live region attributes when announce is false", () => {
    const { container } = render(
      <SuccessContent
        title="Takk!"
        body="Vi setter pris på din tilbakemelding."
        announce={false}
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).not.toHaveAttribute("aria-live");
  });

  it("renders ReactNode body content", () => {
    render(
      <SuccessContent
        title="Takk!"
        body={<span data-testid="custom-body">Custom content</span>}
      />,
    );

    expect(screen.getByTestId("custom-body")).toBeInTheDocument();
  });

  it("handles undefined body gracefully", () => {
    render(<SuccessContent title="Takk!" body={undefined} />);

    expect(screen.getByRole("heading", { name: /takk/i })).toBeInTheDocument();
  });
});
