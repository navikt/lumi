import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { LumiSurveyInline } from "../components/LumiSurveyInline";
import type { SurveyDocumentV1 } from "../components/surveyTypes";
import { SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

const DOCUMENT: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "felt",
      questions: [
        { id: "fritekst", type: "text", prompt: "Fritekst" },
        {
          id: "enkeltvalg",
          type: "singleChoice",
          prompt: "Enkeltvalg",
          options: [
            { value: "a", label: "Alfa" },
            { value: "b", label: "Bravo" },
          ],
        },
        {
          id: "flervalg",
          type: "multiChoice",
          prompt: "Flervalg",
          options: [
            { value: "x", label: "Xray" },
            { value: "y", label: "Yankee" },
          ],
        },
        {
          id: "sokbart",
          type: "multiChoice",
          variant: "combobox",
          prompt: "Søkbart flervalg",
          options: [
            { value: "soknad", label: "Sende søknad" },
            { value: "status", label: "Sjekke status" },
          ],
        },
      ],
    },
  ],
};

/**
 * A form of the app with one text field and no submit button, so Enter in
 * the field sends it. The form shows the names of the fields it sent.
 */
const AppForm = () => {
  const [sentFields, setSentFields] = useState<string>();
  return (
    <form
      aria-label="Appens skjema"
      onSubmit={(event) => {
        event.preventDefault();
        setSentFields([...new FormData(event.currentTarget).keys()].join(", "));
      }}
    >
      <label>
        Appens felt <input type="text" name="felt" />
      </label>
      <LumiSurveyInline
        surveyId="skjema"
        survey={DOCUMENT}
        transport={SUCCESS_TRANSPORT}
        behavior={{ questionLayout: "singlePage" }}
      />
      <button type="reset">Nullstill skjemaet</button>
      <output>
        {sentFields === undefined ? "" : `Sendt med: ${sentFields}`}
      </output>
    </form>
  );
};

/**
 * Not in the Storybook menu. The browser tests in `e2e/` open this story to
 * check how a form of the app treats the survey: jsdom and user-event decide
 * which fields Enter submits by where they are in the form, not by their form
 * owner, as a browser does.
 */
const meta: Meta = {
  title: "Tester/Inline i skjema",
  tags: ["!dev", "!autodocs"],
};

export default meta;
type Story = StoryObj;

export const InAppForm: Story = {
  render: () => <AppForm />,
};
