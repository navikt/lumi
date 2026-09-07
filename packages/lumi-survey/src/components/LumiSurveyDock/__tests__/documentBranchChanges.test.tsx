import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const survey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "root",
      questions: [
        {
          id: "q1",
          type: "singleChoice",
          prompt: "Har du gjennomført møtet?",
          required: true,
          options: [
            { value: "yes", label: "Gjennomført" },
            { value: "no", label: "Ikke gjennomført" },
          ],
        },
      ],
    },
    {
      id: "completed",
      questions: [
        {
          id: "q2",
          type: "text",
          prompt: "Hvordan gikk møtet?",
          visibleIf: { questionId: "q1", operator: "EQ", value: "yes" },
        },
      ],
    },
    {
      id: "reason",
      questions: [
        {
          id: "q3",
          type: "multiChoice",
          prompt: "Hvorfor ble møtet ikke gjennomført?",
          options: [{ value: "other", label: "Annen grunn" }],
          visibleIf: { questionId: "q1", operator: "EQ", value: "no" },
        },
      ],
    },
    {
      id: "details",
      questions: [
        {
          id: "q4",
          type: "text",
          prompt: "Beskriv grunnen",
          required: true,
          visibleIf: { questionId: "q3", operator: "CONTAINS", value: "other" },
        },
      ],
    },
    {
      id: "support",
      questions: [
        {
          id: "q5",
          type: "multiChoice",
          prompt: "Hva kunne hjulpet?",
          options: [{ value: "other", label: "Annen hjelp" }],
          visibleIf: { questionId: "q3", operator: "EXISTS" },
        },
      ],
    },
    {
      id: "supportDetails",
      questions: [
        {
          id: "q6",
          type: "text",
          prompt: "Beskriv hjelpen",
          required: true,
          visibleIf: { questionId: "q5", operator: "CONTAINS", value: "other" },
        },
      ],
    },
  ],
};

describe("document branch changes", () => {
  beforeEach(() => localStorage.clear());

  it("removes closed descendants from navigation, validation and submission, while restoring cached input on return", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <LumiSurveyDock
        surveyId="branch-change"
        survey={survey}
        transport={{ submit }}
        behavior={{ initialOpen: true, showProgress: true }}
      />,
    );
    await user.click(
      await screen.findByRole("radio", { name: "Ikke gjennomført" }),
    );
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await user.click(screen.getByRole("checkbox", { name: "Annen grunn" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await user.type(screen.getByRole("textbox"), "Tidspunktet passet ikke");
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await user.click(screen.getByRole("checkbox", { name: "Annen hjelp" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await user.type(screen.getByRole("textbox"), "Bedre planlegging");
    for (let index = 0; index < 4; index++)
      await user.click(screen.getByRole("button", { name: "Tilbake" }));
    await user.click(screen.getByRole("radio", { name: "Gjennomført" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(screen.getByRole("textbox")).toHaveAccessibleName(
      /Hvordan gikk møtet/,
    );
    expect(
      screen.queryByRole("button", { name: "Neste" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { hidden: true }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tilbake" }));
    await user.click(screen.getByRole("radio", { name: "Ikke gjennomført" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(screen.getByRole("checkbox", { name: "Annen grunn" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(screen.getByRole("textbox")).toHaveValue("Tidspunktet passet ikke");
    // Clear a required descendant before closing the branch again: it must
    // neither block submission nor leak cached descendants into the payload.
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: "Tilbake" }));
    await user.click(screen.getByRole("button", { name: "Tilbake" }));
    await user.click(screen.getByRole("radio", { name: "Gjennomført" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await user.click(screen.getByRole("button", { name: /Send/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0].answers).toEqual({ q1: "yes" });
    expect(
      submit.mock.calls[0][0].transportPayload.answers.map(
        (answer: { fieldId: string }) => answer.fieldId,
      ),
    ).toEqual(["q1"]);
  });
});
