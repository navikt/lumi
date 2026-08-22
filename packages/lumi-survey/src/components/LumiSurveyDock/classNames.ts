export const CLASS_NAMES = {
  container: "lumi-survey-dock",
  panel: "lumi-survey-dock__panel",
  header: "lumi-survey-dock__header",
  headerText: "lumi-survey-dock__header-text",
  groupHeader: "lumi-survey-dock__group-header",
  ratingSection: "lumi-survey-dock__rating",
  ratingHeading: "lumi-survey-dock__rating-heading",
  ratingDescription: "lumi-survey-dock__rating-description",
  ratingField: "lumi-survey-dock__rating-field",
  ratingFieldset: "lumi-survey-dock__rating-fieldset",
  ratingRow: "lumi-survey-dock__rating-row",
  ratingButton: "lumi-survey-dock__rating-button",
  minimizedButton: "lumi-survey-dock__minimized-button",
  question: "lumi-survey-question",
} as const;

export const joinClassNames = (
  ...classNames: Array<string | false | undefined>
): string => classNames.filter(Boolean).join(" ");
