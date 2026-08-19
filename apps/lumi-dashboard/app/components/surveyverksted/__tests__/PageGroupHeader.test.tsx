import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageGroupHeader } from "~/components/surveyverksted/PageGroupHeader";

const noop = () => {};

describe("PageGroupHeader", () => {
  it("keeps the fields behind an add button on a page without one", () => {
    // The first thing an author meets should not be an empty title box —
    // that is what taught every page to ship a heading it did not need.
    render(
      <PageGroupHeader
        title={undefined}
        description={undefined}
        onChangeTitle={noop}
        onChangeDescription={noop}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Legg til felles overskrift" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Felles overskrift"),
    ).not.toBeInTheDocument();
  });

  it("reveals the fields and focuses the title when the author asks for one", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [title, setTitle] = useState<string | undefined>(undefined);
      return (
        <PageGroupHeader
          title={title}
          description={undefined}
          onChangeTitle={setTitle}
          onChangeDescription={noop}
        />
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "Legg til felles overskrift" }),
    );

    const title = screen.getByLabelText("Felles overskrift");
    expect(title).toHaveFocus();

    await user.type(title, "Om deg");
    expect(title).toHaveValue("Om deg");
  });

  it("shows an existing heading without making the author reveal it", () => {
    render(
      <PageGroupHeader
        title="Om opplevelsen"
        description="Tenk på siste besøk."
        onChangeTitle={noop}
        onChangeDescription={noop}
      />,
    );

    expect(screen.getByLabelText("Felles overskrift")).toHaveValue(
      "Om opplevelsen",
    );
    expect(screen.getByLabelText("Felles innledning")).toHaveValue(
      "Tenk på siste besøk.",
    );
    expect(
      screen.queryByRole("button", { name: "Legg til felles overskrift" }),
    ).not.toBeInTheDocument();
  });

  it("reveals for a page that only carries a shared introduction", () => {
    render(
      <PageGroupHeader
        title={undefined}
        description="Tenk på siste besøk."
        onChangeTitle={noop}
        onChangeDescription={noop}
      />,
    );

    expect(screen.getByLabelText("Felles innledning")).toHaveValue(
      "Tenk på siste besøk.",
    );
  });

  it("clears the field to undefined so the page drops the key entirely", async () => {
    const user = userEvent.setup();
    const onChangeTitle = vi.fn();

    render(
      <PageGroupHeader
        title="X"
        description={undefined}
        onChangeTitle={onChangeTitle}
        onChangeDescription={noop}
      />,
    );

    await user.clear(screen.getByLabelText("Felles overskrift"));
    expect(onChangeTitle).toHaveBeenLastCalledWith(undefined);
  });
});
