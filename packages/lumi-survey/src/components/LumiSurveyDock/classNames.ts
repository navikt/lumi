import styles from "./LumiSurveyDock.module.css";

export const CLASS_NAMES = {
  container: styles.container ?? "lumi-survey-dock",
  panel: styles.panel ?? "lumi-survey-dock__panel",
  header: styles.header ?? "lumi-survey-dock__header",
  headerText: styles.headerText ?? "lumi-survey-dock__header-text",
  ratingSection: styles.ratingSection ?? "lumi-survey-dock__rating",
  ratingHeading: styles.ratingHeading ?? "lumi-survey-dock__rating-heading",
  ratingDescription:
    styles.ratingDescription ?? "lumi-survey-dock__rating-description",
  ratingField: styles.ratingField ?? "lumi-survey-dock__rating-field",
  ratingFieldset: styles.ratingFieldset ?? "lumi-survey-dock__rating-fieldset",
  ratingRow: styles.ratingRow ?? "lumi-survey-dock__rating-row",
  ratingButton: styles.ratingButton ?? "lumi-survey-dock__rating-button",
  minimizedButton:
    styles.minimizedButton ?? "lumi-survey-dock__minimized-button",
};

export const joinClassNames = (
  ...classNames: Array<string | false | undefined>
): string => classNames.filter(Boolean).join(" ");
