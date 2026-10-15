import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoReadOnlyNotice } from "~/components/surveyverksted/DemoReadOnlyNotice";

describe("DemoReadOnlyNotice", () => {
  it("explains that the demo cannot save and links to the signed-in Surveyverksted", () => {
    render(<DemoReadOnlyNotice />);

    expect(screen.getByText(/Demoen lagrer ikke utkast/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Logg inn i Lumi-dashboardet" }),
    ).toHaveAttribute(
      "href",
      "https://lumi-dashboard.ansatt.nav.no/surveyverksted",
    );
  });
});
