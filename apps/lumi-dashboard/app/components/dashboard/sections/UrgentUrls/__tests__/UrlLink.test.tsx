import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UrlLink } from "../index";

describe("UrlLink", () => {
  it("renders nav.no URLs as links", () => {
    render(<UrlLink path="https://www.nav.no/no/person" />);

    const link = screen.getByRole("link", {
      name: "https://www.nav.no/no/person",
    });

    expect(link).toHaveAttribute("href", "https://www.nav.no/no/person");
  });

  it("renders valid relative paths as links with nav.no prefix", () => {
    render(<UrlLink path="/no/person" />);

    const link = screen.getByRole("link", { name: "/no/person" });

    expect(link).toHaveAttribute("href", "https://www.nav.no/no/person");
  });

  it("renders external URLs as plain text", () => {
    render(<UrlLink path="https://example.com/path" />);

    expect(screen.getByText("https://example.com/path")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "https://example.com/path" }),
    ).not.toBeInTheDocument();
  });

  it("never renders javascript URLs as links", () => {
    render(<UrlLink path="javascript:alert(1)" />);

    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "javascript:alert(1)" }),
    ).not.toBeInTheDocument();
  });
});
