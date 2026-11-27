import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyInline } from "../components/LumiSurveyInline";
import type { SurveyDocumentV1 } from "../components/surveyTypes";
import { SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

const RATING_VARIANTS = ["emoji", "stars", "thumbs", "nps"] as const;
type RatingVariant = (typeof RATING_VARIANTS)[number];

interface LayoutArgs {
  /** Width of the element the survey stands in, in pixels. */
  width: number;
  /** The rating variant of the first question. */
  variant: RatingVariant;
}

/**
 * One of every field, so each is measured where it is narrowest. The long
 * word has no place to break and is wider than the narrowest column.
 */
const layoutDocument = (variant: RatingVariant): SurveyDocumentV1 => ({
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "side",
      title: "Arbeidsavklaringspengeberegningen",
      description: "Vi bruker svarene til å gjøre kalkulatoren bedre.",
      questions: [
        {
          id: "vurdering",
          type: "rating",
          variant,
          prompt: "Hvor lett var det å bruke kalkulatoren?",
          description: "Tenk på forrige gang du brukte den.",
          required: true,
        },
        {
          id: "oppgave",
          type: "singleChoice",
          prompt: "Fikk du gjort det du kom for?",
          options: [
            { value: "ja", label: "Ja" },
            { value: "delvis", label: "Delvis, men jeg måtte lete lenge" },
            { value: "nei", label: "Nei" },
          ],
        },
        {
          id: "kanaler",
          type: "multiChoice",
          prompt: "Hvor har du lett etter svar?",
          options: [
            { value: "nav", label: "På nav.no" },
            { value: "telefon", label: "På telefon" },
          ],
        },
        {
          id: "tema",
          type: "multiChoice",
          variant: "combobox",
          prompt: "Hva gjaldt det?",
          options: [
            { value: "soknad", label: "Sende søknad" },
            { value: "status", label: "Sjekke status" },
          ],
        },
        {
          id: "kommentar",
          type: "text",
          prompt: "Hva kunne vært bedre?",
        },
      ],
    },
  ],
});

const Survey = ({ variant }: Pick<LayoutArgs, "variant">) => (
  <LumiSurveyInline
    surveyId="layout"
    survey={layoutDocument(variant)}
    transport={SUCCESS_TRANSPORT}
    headingLevel="3"
  />
);

/**
 * Not in the Storybook menu. The browser tests in `e2e/` open these stories
 * and measure how wide the survey is: jsdom, which the other tests run in,
 * has no layout.
 */
const meta: Meta<LayoutArgs> = {
  title: "Tester/Inline layout",
  tags: ["!dev", "!autodocs"],
  parameters: { layout: "fullscreen" },
  args: { width: 256, variant: "emoji" },
  argTypes: {
    width: { control: "number" },
    variant: { control: "select", options: RATING_VARIANTS },
  },
};

export default meta;
type Story = StoryObj<LayoutArgs>;

/** The survey in a column of a given width. */
export const Column: Story = {
  render: ({ width, variant }) => (
    <div data-layout-container style={{ width }}>
      <Survey variant={variant} />
    </div>
  ),
};

/**
 * The survey as an item in a flex row. The content beside it takes the room
 * that is left, so the survey gets the width it asks for.
 */
export const FlexRow: Story = {
  render: ({ width, variant }) => (
    <div data-layout-container style={{ display: "flex", gap: 16, width }}>
      <p style={{ flex: "1 1 0", minWidth: 0, margin: 0 }}>
        Innholdet surveyen spør om.
      </p>
      <Survey variant={variant} />
    </div>
  ),
};

/**
 * The survey in a flex row beside a long text. Both shrink, and the text
 * asks for far more room than the survey does.
 */
export const FlexRowBesideLongText: Story = {
  render: ({ width, variant }) => (
    <div data-layout-container style={{ display: "flex", gap: 16, width }}>
      <p style={{ margin: 0 }}>
        Her står en lang tekst fra appen, som ville tatt hele raden om den fikk
        lov. Den forklarer hva kalkulatoren regner ut, hvilke tall den bruker,
        og hvorfor resultatet kan avvike fra det brukeren får i vedtaket sitt.
        Teksten fortsetter over flere setninger for å ligne innholdet på en ekte
        side.
      </p>
      <Survey variant={variant} />
    </div>
  ),
};

/** The survey in an element that takes the width of its content. */
export const ShrinkToFit: Story = {
  render: ({ variant }) => (
    <div data-layout-container style={{ display: "inline-block" }}>
      <Survey variant={variant} />
    </div>
  ),
};
