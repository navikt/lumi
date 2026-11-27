import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../../core/types.js";
import { ComboboxMultiChoiceField } from "../ComboboxMultiChoiceField.js";

type MultiChoiceQuestion = ChoiceQuestion & { type: "multiChoice" };

function renderField(question: MultiChoiceQuestion) {
  const onChange = vi.fn<(value: string[]) => void>();
  // biome-ignore lint/correctness/noComponentHookFactories: Created once per test, outside React rendering, to isolate its state.
  function Controlled() {
    const [value, setValue] = useState<LumiSurveyAnswerValue>([]);
    return (
      <ComboboxMultiChoiceField
        question={question}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        validationErrorMessage="Du må svare på spørsmålet."
        isMissing={false}
        disabled={false}
      />
    );
  }
  render(<Controlled />);
  return { onChange };
}

describe("ComboboxMultiChoiceField", () => {
  it("answers with the option the keyboard is on, also when two values look alike", async () => {
    const user = userEvent.setup();
    // Aksel builds the id of an option from its value: lower case, with
    // spaces as hyphens. These two values would get the same id.
    const { onChange } = renderField({
      id: "tema",
      type: "multiChoice",
      variant: "combobox",
      prompt: "Hva gjaldt det?",
      options: [
        { value: "A B", label: "Første" },
        { value: "a-b", label: "Andre" },
      ],
    });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(["A B"]);

    const ids = [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("answers with the option that is clicked, and removes it again", async () => {
    const user = userEvent.setup();
    const { onChange } = renderField({
      id: "tema",
      type: "multiChoice",
      variant: "combobox",
      prompt: "Hva gjaldt det?",
      options: [
        { value: "Ja", label: "Ja, helt" },
        { value: "ja", label: "Ja, delvis" },
      ],
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Ja, delvis" }));
    expect(onChange).toHaveBeenLastCalledWith(["ja"]);

    await user.click(screen.getByRole("option", { name: "Ja, helt" }));
    expect(onChange).toHaveBeenLastCalledWith(["ja", "Ja"]);

    await user.click(screen.getByRole("option", { name: "Ja, delvis" }));
    expect(onChange).toHaveBeenLastCalledWith(["Ja"]);
  });

  it("stops at the largest number of options the question allows", async () => {
    const user = userEvent.setup();
    const { onChange } = renderField({
      id: "tema",
      type: "multiChoice",
      variant: "combobox",
      prompt: "Hva gjaldt det?",
      maxSelections: 1,
      options: [
        { value: "soknad", label: "Søknad" },
        { value: "status", label: "Status" },
      ],
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Søknad" }));
    await user.click(screen.getByRole("option", { name: "Status" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["soknad"]);
  });
});
