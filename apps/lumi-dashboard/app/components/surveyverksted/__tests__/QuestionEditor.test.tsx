import {
  createDiscoverySurveyDocument,
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  type SurveyDocumentV1,
  type SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  findHandoffIssues,
  SURVEY_TEMPLATE_PLACEHOLDER_LABELS,
  SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
} from "~/utils/surveyDocument";
import { QuestionEditor } from "../QuestionEditor/QuestionEditor";

// The respondent widget has its own interaction suite; these tests exercise
// controlled author edits and safeguards, independent of its viewport renderer.
vi.mock("../StageSurface", () => ({
  StageSurface: () => <div>Respondentvisning</div>,
}));

const choice: SurveyQuestionV1 = {
  id: "choice",
  type: "singleChoice",
  prompt: "Har du gjennomført møtet?",
  required: true,
  options: [
    { value: "yes", label: "Ja" },
    { value: "no", label: "Nei" },
    { value: "unsure", label: "Usikker" },
  ],
};
const followup: SurveyQuestionV1 = {
  id: "followup",
  type: "text",
  prompt: "Hvordan gikk møtet?",
  maxLength: 1000,
  visibleIf: { questionId: "choice", operator: "EQ", value: "yes" },
};
function makeDocument(
  first: SurveyQuestionV1,
  ...questions: SurveyQuestionV1[]
): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "custom",
    pages: [
      { id: `page-${first.id}`, questions: [first] },
      ...questions.map((question) => ({
        id: `page-${question.id}`,
        questions: [question] as [SurveyQuestionV1],
      })),
    ],
  };
}

function renderEditor(initial = makeDocument(choice, followup)) {
  const onChange = vi.fn<(document: SurveyDocumentV1) => void>();
  const onAdvanced = vi.fn();
  function ControlledEditor() {
    const [document, setDocument] = useState(initial);
    return (
      <QuestionEditor
        document={document}
        surveyId="dialogmote"
        onAdvanced={onAdvanced}
        onChange={(next) => {
          onChange(next);
          setDocument(next);
        }}
      />
    );
  }
  render(<ControlledEditor />);
  return { onChange, onAdvanced };
}

function editor() {
  return within(screen.getByRole("region", { name: "Rediger spørsmål" }));
}
async function selectQuestion(number: number, prompt: string) {
  await userEvent.click(
    screen.getAllByRole("button", {
      name: `Spørsmål ${number} · ${prompt}`,
    })[0],
  );
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Rediger spørsmål" }),
    ).toHaveFocus(),
  );
}

describe("QuestionEditor controlled editing", () => {
  it("keeps questions with screen-like IDs separate from welcome and thank-you editing", async () => {
    const first: SurveyQuestionV1 = {
      id: "$intro",
      type: "text",
      prompt: "Første spørsmål",
    };
    const second: SurveyQuestionV1 = {
      id: "$success",
      type: "text",
      prompt: "Andre spørsmål",
    };
    const { onChange } = renderEditor(makeDocument(first, second));
    expect(editor().getByLabelText("Spørsmålstekst")).toHaveValue(first.prompt);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Velkomstside" })[0],
    );
    expect(
      screen.getByRole("region", { name: "Rediger velkomstside" }),
    ).toBeInTheDocument();
    await selectQuestion(2, second.prompt);
    await userEvent.type(editor().getByLabelText("Spørsmålstekst"), "!");
    expect(onChange.mock.calls.at(-1)?.[0].pages[1].questions[0]).toMatchObject(
      { id: "$success", prompt: `${second.prompt}!` },
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Takkeside" })[0],
    );
    expect(
      screen.getByRole("region", { name: "Rediger takkeside" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Angre" }));
    expect(editor().getByLabelText("Spørsmålstekst")).toHaveValue(
      second.prompt,
    );
  });

  it("reports a new document without mutating input and undoes one continuous text edit", async () => {
    const initial = makeDocument(choice, followup);
    const snapshot = structuredClone(initial);
    const { onChange } = renderEditor(initial);
    await userEvent.type(editor().getByLabelText("Spørsmålstekst"), " Nå");
    expect(onChange.mock.calls.at(-1)?.[0].pages[0].questions[0].prompt).toBe(
      `${choice.prompt} Nå`,
    );
    expect(initial).toEqual(snapshot);
    expect(
      onChange.mock.calls.at(-1)?.[0].pages[1].questions[0].visibleIf,
    ).toEqual(followup.visibleIf);

    await userEvent.click(screen.getByRole("button", { name: "Angre" }));
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(initial);
    expect(editor().getByLabelText("Spørsmålstekst")).toHaveValue(
      choice.prompt,
    );
    expect(screen.getByRole("button", { name: "Angre" })).toBeDisabled();
  });

  it("clears undo when the parent supplies an independent repaired document", async () => {
    const initial = makeDocument(choice, followup);
    const onChange = vi.fn();
    const props = { surveyId: "dialogmote", onChange, onAdvanced: vi.fn() };
    const { rerender } = render(
      <QuestionEditor {...props} document={initial} />,
    );
    await userEvent.type(editor().getByLabelText("Spørsmålstekst"), "!");
    expect(screen.getByRole("button", { name: "Angre" })).toBeEnabled();
    const repaired = { ...initial, intro: { title: "Ny velkomst" } };
    rerender(<QuestionEditor {...props} document={repaired} />);
    expect(screen.getByRole("button", { name: "Angre" })).toBeDisabled();
  });

  it("adds an answer-based follow-up after the entire source page and can undo it", async () => {
    const initial = makeDocument(choice, followup);
    initial.pages = [
      { id: "group", title: "Møtet", questions: [choice, followup] },
    ];
    const { onChange } = renderEditor(initial);
    await userEvent.click(
      editor().getByRole("button", {
        name: "Legg til oppfølgingsspørsmål for: Ja",
      }),
    );
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next?.pages).toHaveLength(2);
    expect(next?.pages[0]).toEqual(initial.pages[0]);
    expect(next?.pages[1].questions[0]).toMatchObject({
      prompt: "",
      type: "text",
      visibleIf: { questionId: "choice", operator: "EQ", value: "yes" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Angre" }));
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(initial);
  });
});

describe("QuestionEditor condition and analysis safeguards", () => {
  it("distinguishes the current group from joining the previous page", async () => {
    const second: SurveyQuestionV1 = {
      id: "second",
      type: "text",
      prompt: "Andre erfaringer",
    };
    const fourth: SurveyQuestionV1 = {
      id: "fourth",
      type: "text",
      prompt: "Fortell mer",
    };
    const initial = makeDocument(choice, second, followup, fourth);
    initial.pages = [
      initial.pages[0],
      initial.pages[1],
      { id: "group", title: "Detaljer", questions: [followup, fourth] },
    ];
    const { onChange } = renderEditor(initial);
    await selectQuestion(3, followup.prompt);
    expect(
      editor().getByRole("radio", {
        name: "Sammen med de andre spørsmålene på siden",
      }),
    ).toBeChecked();
    const previous = editor().getByRole("radio", {
      name: "Sammen med spørsmål 2",
    });
    expect(previous).not.toBeChecked();
    await userEvent.click(previous);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(
      next?.pages.map((page) => page.questions.map((question) => question.id)),
    ).toEqual([["choice"], ["second", "followup"], ["fourth"]]);
    expect(next?.pages[2]).toEqual({
      id: "group",
      title: "Detaljer",
      questions: [fourth],
    });
  });

  it("creates and edits a rating range follow-up without silently simplifying its rule", async () => {
    const rating: SurveyQuestionV1 = {
      id: "rating",
      type: "rating",
      prompt: "Hvor sannsynlig er det at du anbefaler oss?",
      variant: "nps",
    };
    const { onChange } = renderEditor(makeDocument(rating));
    await userEvent.click(
      editor().getByRole("button", { name: "Ved passive (7–8)" }),
    );
    const condition = {
      all: [
        { questionId: "rating", operator: "GT", value: 6 },
        { questionId: "rating", operator: "LT", value: 9 },
      ],
    };
    expect(
      onChange.mock.calls.at(-1)?.[0].pages[1].questions[0].visibleIf,
    ).toEqual(condition);
    await userEvent.click(editor().getByRole("button", { name: "Endre hvem" }));
    expect(
      editor().getByText(/Dette spørsmålet har en tilpasset svarregel/),
    ).toBeVisible();
    await userEvent.type(
      editor().getByLabelText("Spørsmålstekst"),
      "Hva kan bli bedre?",
    );
    expect(
      onChange.mock.calls.at(-1)?.[0].pages[1].questions[0].visibleIf,
    ).toEqual(condition);
  });

  it("shows the consequence of skipping an optional source before the rule editor is opened", async () => {
    const optional = { ...choice, required: false };
    const answered = {
      ...followup,
      visibleIf: { questionId: "choice", operator: "EXISTS" as const },
    };
    renderEditor(makeDocument(optional, answered));
    await selectQuestion(2, answered.prompt);
    expect(editor().getByText(/Spørsmål 1 er valgfritt/)).toHaveTextContent(
      /Hopper respondenten over det, vises ikke dette spørsmålet/,
    );
    expect(editor().getByRole("button", { name: "Endre hvem" })).toBeVisible();
  });

  it("commits an edited template task to a real stable value so it can be shared", async () => {
    const initial = createTopTasksSurveyDocument({
      tasks: [
        {
          value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
          label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[0],
        },
      ],
    });
    const { onChange } = renderEditor(initial);
    const option = editor().getByLabelText("Alternativ 1");
    await userEvent.clear(option);
    await userEvent.type(option, "Sende søknad");
    await userEvent.tab();
    const next = onChange.mock.calls.at(-1)?.[0];
    if (!next) throw new Error("Expected an edited task document");
    const task = next.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "task");
    if (!task || !("options" in task))
      throw new Error("Expected a task choice field");
    expect(task.options[0]).toEqual({
      value: "sende-soknad",
      label: "Sende søknad",
    });
    expect(
      findHandoffIssues(next).filter((issue) => issue.questionId === "task"),
    ).toEqual([]);
  });

  it("lets authors configure a task-priority list while retaining its minimum two tasks", async () => {
    const initial = createTaskPrioritySurveyDocument({
      tasks: [
        { value: "apply", label: "Søke" },
        { value: "status", label: "Se status" },
      ],
    });
    const { onChange } = renderEditor(initial);
    const priority = initial.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "priority");
    if (!priority) throw new Error("Expected the priority question");
    await userEvent.click(
      editor().getByRole("button", { name: "Handlinger for alternativ 1" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Slett alternativ" }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      editor().getByRole("button", { name: "Legg til svaralternativ" }),
    );
    const edited = onChange.mock.calls
      .at(-1)?.[0]
      .pages.flatMap((page) => page.questions)
      .find((question) => question.id === "priority");
    if (!edited || !("options" in edited))
      throw new Error("Expected edited priority options");
    expect(edited.options).toHaveLength(3);
    expect(edited.required).toBe(true);
    expect(edited.visibleIf).toBeUndefined();
  });

  it("preserves an advanced multi-source condition while opening its editor and editing the wording", async () => {
    const second: SurveyQuestionV1 = {
      id: "second",
      type: "text",
      prompt: "Andre erfaringer",
    };
    const advanced: SurveyQuestionV1 = {
      ...followup,
      visibleIf: {
        any: [
          { questionId: "choice", operator: "EQ", value: "yes" },
          { questionId: "second", operator: "EXISTS" },
        ],
      },
    };
    const { onChange } = renderEditor(makeDocument(choice, second, advanced));
    await selectQuestion(3, advanced.prompt);
    await userEvent.click(editor().getByRole("button", { name: "Endre hvem" }));
    expect(
      editor().getByText(/Dette spørsmålet har en tilpasset svarregel/),
    ).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(editor().getByLabelText("Spørsmålstekst"), "!");
    expect(
      onChange.mock.calls.at(-1)?.[0].pages[2].questions[0].visibleIf,
    ).toEqual(advanced.visibleIf);
  });

  it("blocks changing a source's answer type while value-based follow-ups depend on it", async () => {
    const { onChange } = renderEditor();
    await userEvent.selectOptions(
      editor().getByLabelText("Hvordan skal de svare?"),
      "multiChoice",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Spørsmål 2 følger opp svaralternativer eller verdier her/,
    );
    expect(editor().getByLabelText("Hvordan skal de svare?")).toHaveValue(
      "singleChoice",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("allows type changes when dependents only require an answer and preserves their rules", async () => {
    const answered = {
      ...followup,
      visibleIf: { questionId: "choice", operator: "EXISTS" as const },
    };
    const { onChange } = renderEditor(makeDocument(choice, answered));
    await userEvent.selectOptions(
      editor().getByLabelText("Hvordan skal de svare?"),
      "text",
    );
    expect(onChange.mock.calls.at(-1)?.[0].pages[0].questions[0].type).toBe(
      "text",
    );
    expect(
      onChange.mock.calls.at(-1)?.[0].pages[1].questions[0].visibleIf,
    ).toEqual(answered.visibleIf);
  });

  it("blocks removing an option referenced by a follow-up", async () => {
    const { onChange } = renderEditor();
    await userEvent.click(
      editor().getByRole("button", { name: "Handlinger for alternativ 1" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Slett alternativ" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Spørsmål 2 bruker dette svaret/,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(editor().getByLabelText("Alternativ 1")).toHaveValue("Ja");
  });

  it("removes an unused option without changing stable values or the remaining follow-up", async () => {
    const { onChange } = renderEditor();
    await userEvent.click(
      editor().getByRole("button", { name: "Handlinger for alternativ 3" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Slett alternativ" }),
    );
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next?.pages[0].questions[0]).toMatchObject({
      options: [
        { value: "yes", label: "Ja" },
        { value: "no", label: "Nei" },
      ],
    });
    expect(next?.pages[1].questions[0].visibleIf).toEqual(followup.visibleIf);
  });

  it("keeps required analysis fields unconditional while allowing their wording to change", async () => {
    const initial = createDiscoverySurveyDocument();
    const questions = initial.pages.flatMap((page) => page.questions);
    const success = questions.find((question) => question.id === "success");
    if (!success) throw new Error("Discovery fixture needs a success field");
    const { onChange } = renderEditor(initial);
    await selectQuestion(questions.indexOf(success) + 1, success.prompt);
    expect(
      editor().getByRole("checkbox", { name: "Må besvares" }),
    ).toBeDisabled();
    expect(
      editor().queryByLabelText("Hvordan skal de svare?"),
    ).not.toBeInTheDocument();
    expect(
      editor().queryByRole("button", { name: "Endre hvem" }),
    ).not.toBeInTheDocument();
    expect(
      editor().queryByRole("button", { name: "Handlinger for alternativ 1" }),
    ).not.toBeInTheDocument();
    await userEvent.type(editor().getByLabelText("Spørsmålstekst"), "!");
    const edited = onChange.mock.calls
      .at(-1)?.[0]
      .pages.flatMap((page) => page.questions)
      .find((question) => question.id === "success");
    expect(edited).toMatchObject({ ...success, prompt: `${success.prompt}!` });
    expect(edited?.visibleIf).toBeUndefined();
  });
});
