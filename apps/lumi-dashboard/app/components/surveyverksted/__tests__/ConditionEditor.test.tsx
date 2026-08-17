import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConditionEditor } from "~/components/surveyverksted/ConditionEditor";
import type {
  ReferenceableQuestion,
  VisibleIfConditionV1,
} from "~/utils/surveyDocument";

const referenceable: ReferenceableQuestion[] = [
  {
    id: "rating-1",
    prompt: "Hvordan opplevde du tjenesten?",
    type: "rating",
    pageNumber: 1,
    questionNumber: 1,
  },
  {
    id: "choice-1",
    prompt: "Hva kom du for å gjøre?",
    type: "singleChoice",
    pageNumber: 1,
    questionNumber: 2,
  },
  {
    id: "multi-1",
    prompt: "Hva er viktigst?",
    type: "multiChoice",
    pageNumber: 1,
    questionNumber: 3,
  },
  {
    id: "text-1",
    prompt: "Fortell mer",
    type: "text",
    pageNumber: 1,
    questionNumber: 4,
  },
];

function suggestionsFor(id: string) {
  if (id === "choice-1") {
    return [
      { value: "soke", label: "Søke" },
      { value: "sjekke-status", label: "Sjekke status" },
    ];
  }
  if (id === "rating-1") {
    return [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));
  }
  return [];
}

function ControlledEditor({
  initial,
  referenceable: referenceableOverride,
}: {
  initial: VisibleIfConditionV1;
  referenceable?: ReferenceableQuestion[];
}) {
  const [condition, setCondition] = useState<VisibleIfConditionV1 | undefined>(
    initial,
  );
  return (
    <ConditionEditor
      condition={condition}
      referenceable={referenceableOverride ?? referenceable}
      suggestionsFor={suggestionsFor}
      onChange={setCondition}
    />
  );
}

describe("ConditionEditor", () => {
  it("is disabled with a keyboard-reachable explanation when no earlier questions exist", () => {
    render(
      <ConditionEditor
        condition={undefined}
        referenceable={[]}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /vis bare hvis/i }),
    ).toBeDisabled();
    expect(
      screen.getByText("Ingen tidligere spørsmål å referere til"),
    ).toBeVisible();
  });

  it("offers only EXISTS and CONTAINS against a multiChoice reference", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "multi-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Vilkår")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "inneholder" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "er lik" }),
    ).not.toBeInTheDocument();
  });

  it("shows a missing reference explicitly instead of pretending it is repaired", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "borte", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Spørsmål", { exact: true })).toHaveValue(
      "borte",
    );
    expect(
      screen.getByRole("option", { name: /finnes ikke lenger/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/velg et annet spørsmål/i)).toBeVisible();
  });

  it("keeps an operator that no longer fits and warns", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "text-1", operator: "GT", value: 1 }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Vilkår")).toHaveValue("GT");
    expect(screen.getByText(/passer ikke spørsmålet/i)).toBeVisible();
  });

  it("keeps a value that no longer exists and warns", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "choice-1", operator: "EQ", value: "gammel" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Verdi")).toHaveDisplayValue(
      /gammel.*finnes ikke/i,
    );
    expect(
      screen.getByRole("option", { name: /gammel.*finnes ikke/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/finnes ikke blant alternativene/i)).toBeVisible();
  });

  it("creates a default EXISTS condition on the first earlier question", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={undefined}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /vis bare hvis/i }),
    );
    expect(onChange).toHaveBeenCalledWith({
      questionId: "rating-1",
      operator: "EXISTS",
    });
  });

  it("hides the value field for EXISTS and shows suggestions for EQ", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ questionId: "choice-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    expect(screen.queryByLabelText("Verdi")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Vilkår"), "EQ");
    expect(onChange).toHaveBeenCalledWith({
      questionId: "choice-1",
      operator: "EQ",
      value: "soke",
    });
  });

  it("uses the referenced question's suggestions as value options", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "choice-1", operator: "EQ", value: "soke" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    const value = screen.getByLabelText("Verdi");
    expect(value).toHaveDisplayValue("Søke");
    expect(
      screen.getByRole("option", { name: "Sjekke status" }),
    ).toBeInTheDocument();
  });

  it("treats a string value against a rating reference as stale", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "rating-1", operator: "EQ", value: "3" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("option", { name: /finnes ikke/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/velg en gyldig verdi/i)).toBeVisible();
  });

  it("emits typed values from suggestions", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ questionId: "rating-1", operator: "EQ", value: 3 }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Verdi"),
      screen.getByRole("option", { name: "4" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      questionId: "rating-1",
      operator: "EQ",
      value: 4,
    });
  });

  it("warns about non-string values against text references", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "text-1", operator: "EQ", value: 3 }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/må være tekst/i)).toBeVisible();
  });

  it("warns about empty and whitespace-only values against text references", () => {
    for (const value of ["", "   "]) {
      const { unmount } = render(
        <ConditionEditor
          condition={{ questionId: "text-1", operator: "CONTAINS", value }}
          referenceable={referenceable}
          suggestionsFor={suggestionsFor}
          onChange={() => {}}
        />,
      );
      expect(screen.getByText(/kan ikke være tom/i)).toBeVisible();
      expect(screen.getByLabelText("Verdi")).toHaveAccessibleDescription(
        /kan ikke være tom/i,
      );
      unmount();
    }
  });

  it("emits an empty default when switching to EQ against a text reference", async () => {
    // The empty default is allowed in the draft; the editor must warn and
    // the release gates must block it.
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ questionId: "text-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Vilkår"), "EQ");
    expect(onChange).toHaveBeenCalledWith({
      questionId: "text-1",
      operator: "EQ",
      value: "",
    });
  });

  it("associates repair warnings with the controls they describe", () => {
    render(
      <ConditionEditor
        condition={{ questionId: "text-1", operator: "GT", value: 1 }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Vilkår")).toHaveAccessibleDescription(
      /passer ikke spørsmålet/i,
    );
  });

  it("removes the condition", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ questionId: "rating-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /fjern betingelsen/i }),
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("treats an explicit ANSWER leaf with a stray metadata key as editable", async () => {
    // Runtime and API discriminate on `field` — a stray `key` must not
    // turn an ANSWER condition into a read-only "code condition".
    const onChange = vi.fn();
    const stray = {
      field: "ANSWER" as const,
      questionId: "rating-1",
      key: "ekstra-felt",
      operator: "EXISTS" as const,
    };
    render(
      <ConditionEditor
        condition={stray}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    const operatorSelect = screen.getByLabelText("Vilkår");
    // Editing normalizes the leaf: the stray key is dropped on emit.
    await userEvent.selectOptions(operatorSelect, "EQ");
    expect(onChange).toHaveBeenCalledWith({
      questionId: "rating-1",
      operator: "EQ",
      value: 1,
    });
  });

  it("shows a metadata condition authored in code read-only", () => {
    render(
      <ConditionEditor
        condition={{ field: "METADATA", key: "flow", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Vilkår")).not.toBeInTheDocument();
  });

  it("adds a second condition and emits an all-group", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ questionId: "choice-1", operator: "EQ", value: "soke" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Legg til betingelse" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      all: [
        { questionId: "choice-1", operator: "EQ", value: "soke" },
        { questionId: "rating-1", operator: "EXISTS" },
      ],
    });
  });

  it("shows the combinator toggle only with two or more conditions", () => {
    const { unmount } = render(
      <ConditionEditor
        condition={{ questionId: "rating-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Alle må stemme")).not.toBeInTheDocument();
    unmount();

    render(
      <ConditionEditor
        condition={{
          all: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EXISTS" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Alle må stemme")).toBeInTheDocument();
    expect(screen.getByText("Minst én må stemme")).toBeInTheDocument();
  });

  it("switches the combinator and emits the other group shape", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{
          all: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EXISTS" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByText("Minst én må stemme"));
    expect(onChange).toHaveBeenCalledWith({
      any: [
        { questionId: "rating-1", operator: "EXISTS" },
        { questionId: "choice-1", operator: "EXISTS" },
      ],
    });
  });

  it("removes a row and collapses back to a single leaf", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{
          any: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EQ", value: "soke" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Fjern betingelse 2" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      questionId: "rating-1",
      operator: "EXISTS",
    });
  });

  it("edits one row without touching the others", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{
          all: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EQ", value: "soke" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getAllByLabelText("Vilkår")[1], "NEQ");
    expect(onChange).toHaveBeenCalledWith({
      all: [
        { questionId: "rating-1", operator: "EXISTS" },
        { questionId: "choice-1", operator: "NEQ", value: "soke" },
      ],
    });
  });

  it("unmounts the removed row instead of reusing its DOM for the next row", async () => {
    // With index keys React would keep the clicked button's DOM node and
    // silently let it represent the NEXT row — a second Enter would then
    // delete the wrong condition.
    render(
      <ControlledEditor
        initial={{
          any: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EQ", value: "soke" },
            { questionId: "multi-1", operator: "EXISTS" },
          ],
        }}
      />,
    );
    const removeSecond = screen.getByRole("button", {
      name: "Fjern betingelse 2",
    });
    await userEvent.click(removeSecond);
    expect(removeSecond).not.toBeInTheDocument();
    const remaining = screen.getAllByRole("button", {
      name: /Fjern betingelse \d/,
    });
    expect(remaining).toHaveLength(2);
    // Focus moves EXPLICITLY (with announcement) to the row that took the
    // deleted row's place — never silently via DOM reuse.
    expect(
      screen.getByRole("button", { name: "Fjern betingelse 2" }),
    ).toHaveFocus();
  });

  it("moves focus to the add button when the group collapses to one row", async () => {
    render(
      <ControlledEditor
        initial={{
          any: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EXISTS" },
          ],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Fjern betingelse 2" }),
    );
    expect(
      screen.getByRole("button", { name: "Legg til betingelse" }),
    ).toHaveFocus();
  });

  it("falls back to the header remove button when a mixed group collapses to metadata", async () => {
    // The remaining METADATA leaf renders through the read-only branch,
    // which has no add button — focus must still land somewhere real.
    render(
      <ControlledEditor
        initial={{
          all: [
            { field: "METADATA", key: "flow", operator: "EXISTS" },
            { questionId: "rating-1", operator: "EXISTS" },
          ],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Fjern betingelse 2" }),
    );
    expect(screen.getByText(/metadatabetingelse satt i kode/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Fjern betingelsen" }),
    ).toHaveFocus();
  });

  it("falls back past a disabled add button after removing a row", async () => {
    // Hand-authored refs with no referenceable questions leave the add
    // button disabled — a disabled control can never take focus.
    render(
      <ControlledEditor
        initial={{
          all: [
            { questionId: "borte-1", operator: "EXISTS" },
            { questionId: "borte-2", operator: "EXISTS" },
          ],
        }}
        referenceable={[]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Fjern betingelse 2" }),
    );
    expect(
      screen.getByRole("button", { name: "Fjern betingelsen" }),
    ).toHaveFocus();
  });

  it("names each row group so screen readers can tell rows apart", () => {
    const { unmount } = render(
      <ConditionEditor
        condition={{
          all: [
            { questionId: "rating-1", operator: "EXISTS" },
            { questionId: "choice-1", operator: "EQ", value: "soke" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    const secondRow = screen.getByRole("group", { name: "Betingelse 2" });
    expect(within(secondRow).getByLabelText("Vilkår")).toBeInTheDocument();
    unmount();

    // A single condition needs no differentiation.
    render(
      <ConditionEditor
        condition={{ questionId: "rating-1", operator: "EXISTS" }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /Betingelse/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps metadata rows read-only inside a mixed group but removable", async () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{
          all: [
            { field: "METADATA", key: "flow", operator: "EXISTS" },
            { questionId: "rating-1", operator: "EXISTS" },
          ],
        }}
        referenceable={referenceable}
        suggestionsFor={suggestionsFor}
        onChange={onChange}
      />,
    );
    // Only the ANSWER row is editable; the metadata row shows its key.
    expect(screen.getAllByLabelText("Vilkår")).toHaveLength(1);
    expect(screen.getByText(/flow/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Fjern betingelse 1" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      questionId: "rating-1",
      operator: "EXISTS",
    });
  });
});
