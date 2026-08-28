import type {
  LumiSurveyConfig,
  SurveyDocumentV1,
} from "../components/surveyTypes.js";

export const RECOMMENDED_SURVEY_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "rating",
  intro: {
    title: "Hjelp oss å forbedre tjenesten",
    body: "Det tar omtrent ett minutt å svare.",
    startLabel: "Start undersøkelsen",
  },
  pages: [
    {
      id: "opplevelse",
      title: "Din opplevelse",
      description: "Tenk på det du nettopp prøvde å gjøre.",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen din?",
          required: true,
        },
        {
          id: "begrunnelse",
          type: "text",
          prompt: "Hva er den viktigste grunnen til vurderingen?",
          maxLength: 500,
          minRows: 3,
          visibleIf: {
            questionId: "rating",
            operator: "EXISTS",
          },
        },
      ],
    },
    {
      id: "forbedring",
      title: "Hva kan bli bedre?",
      questions: [
        {
          id: "omrader",
          type: "multiChoice",
          prompt: "Hva bør vi forbedre?",
          variant: "checkbox",
          options: [
            { value: "sprak", label: "Språk og forklaringer" },
            { value: "flyt", label: "Steg og navigasjon" },
            { value: "annet", label: "Noe annet" },
          ],
        },
        {
          id: "annet",
          type: "text",
          prompt: "Fortell hva annet vi bør forbedre",
          maxLength: 500,
          visibleIf: {
            questionId: "omrader",
            operator: "CONTAINS",
            value: "annet",
          },
        },
      ],
    },
  ],
  success: {
    title: "Takk for at du svarte",
    body: "Tilbakemeldingen brukes i videreutviklingen av tjenesten.",
  },
} satisfies SurveyDocumentV1;

export const ONE_QUESTION_PER_PAGE_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "forventning",
      title: "Først: forventningen din",
      questions: [
        {
          id: "forventning",
          type: "text",
          prompt: "Hva forventet du å finne?",
          maxLength: 500,
          required: true,
        },
      ],
    },
    {
      id: "resultat",
      title: "Så: resultatet",
      questions: [
        {
          id: "fant-det",
          type: "singleChoice",
          prompt: "Fant du det du lette etter?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "delvis", label: "Delvis" },
            { value: "nei", label: "Nei" },
          ],
        },
      ],
    },
    {
      id: "til-slutt",
      title: "Til slutt",
      questions: [
        {
          id: "forslag",
          type: "text",
          prompt: "Hva ville gjort siden bedre?",
          maxLength: 500,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const GROUPED_PAGE_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "opplevelse",
      title: "Din opplevelse",
      description: "Spørsmålene på siden valideres og sendes videre samlet.",
      questions: [
        {
          id: "vurdering",
          type: "rating",
          prompt: "Hvor fornøyd er du?",
          variant: "emoji",
          required: true,
        },
        {
          id: "begrunnelse",
          type: "text",
          prompt: "Hva er den viktigste grunnen til vurderingen?",
          required: true,
          maxLength: 500,
          minRows: 3,
        },
      ],
    },
    {
      id: "forbedring",
      title: "Forbedring",
      questions: [
        {
          id: "forslag",
          type: "text",
          prompt: "Har du et konkret forslag?",
          maxLength: 500,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const CONDITIONAL_FLOW_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "resultat",
      title: "Resultatet",
      questions: [
        {
          id: "taskSuccess",
          type: "singleChoice",
          prompt: "Fikk du gjort det du kom for?",
          required: true,
          options: [
            { value: "yes", label: "Ja" },
            { value: "partial", label: "Delvis" },
            { value: "no", label: "Nei" },
          ],
        },
      ],
    },
    {
      id: "hindring",
      title: "Hva hindret deg?",
      questions: [
        {
          id: "blocker",
          type: "text",
          prompt: "Hva gjorde at du ikke kom helt i mål?",
          maxLength: 500,
          visibleIf: {
            all: [
              { questionId: "taskSuccess", operator: "EXISTS" },
              {
                questionId: "taskSuccess",
                operator: "NEQ",
                value: "yes",
              },
            ],
          },
        },
      ],
    },
    {
      id: "avslutning",
      questions: [
        {
          id: "annet",
          type: "text",
          prompt: "Er det noe annet du vil fortelle oss?",
          maxLength: 500,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const TEXT_QUESTION_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "tekst",
      title: "Tekstfelt",
      questions: [
        {
          id: "tilbakemelding",
          type: "text",
          prompt: "Hva vil du fortelle oss?",
          description: "Beskriv opplevelsen med egne ord.",
          placeholder: "Skriv her …",
          minRows: 4,
          maxLength: 500,
          required: true,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const SINGLE_CHOICE_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "enkeltvalg",
      title: "Enkeltvalg",
      questions: [
        {
          id: "kanal",
          type: "singleChoice",
          prompt: "Hvordan fant du denne siden?",
          required: true,
          randomize: false,
          options: [
            { value: "sok", label: "Søk" },
            { value: "nav", label: "Navigasjon på nav.no" },
            { value: "lenke", label: "Lenke fra en annen side" },
          ],
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const MULTI_CHOICE_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "flervalg",
      title: "Flervalg",
      questions: [
        {
          id: "temaer",
          type: "multiChoice",
          prompt: "Hvilke deler var nyttige?",
          description: "Velg inntil tre.",
          variant: "checkbox",
          maxSelections: 3,
          required: true,
          options: [
            { value: "oversikt", label: "Oversikten" },
            { value: "forklaringer", label: "Forklaringene" },
            { value: "eksempler", label: "Eksemplene" },
            { value: "neste-steg", label: "Veien videre" },
          ],
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const SEARCHABLE_MULTI_CHOICE_DOCUMENT = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "prioritering",
      title: "Søkbart flervalg",
      questions: [
        {
          id: "priorities",
          type: "multiChoice",
          prompt: "Hvilke oppgaver er viktigst for deg?",
          variant: "combobox",
          maxSelections: 3,
          randomize: true,
          required: true,
          options: [
            { value: "soknad", label: "Sende søknad" },
            { value: "status", label: "Sjekke status" },
            { value: "utbetaling", label: "Se utbetaling" },
            { value: "dokumentasjon", label: "Ettersende dokumentasjon" },
            { value: "vedtak", label: "Lese vedtak" },
            { value: "klage", label: "Sende klage" },
          ],
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

export const LEGACY_SURVEY_CONFIG = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen din?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      maxLength: 500,
      visibleIf: {
        questionId: "rating",
        operator: "EXISTS",
      },
    },
  ],
} satisfies LumiSurveyConfig;
