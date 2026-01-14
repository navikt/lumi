import styles from "./FlexJarDock.module.css";

export const CLASS_NAMES = {
  container: styles.container ?? "flexjar-dock",
  panel: styles.panel ?? "flexjar-dock__panel",
  header: styles.header ?? "flexjar-dock__header",
  headerText: styles.headerText ?? "flexjar-dock__header-text",
  ratingSection: styles.ratingSection ?? "flexjar-dock__rating",
  ratingHeading: styles.ratingHeading ?? "flexjar-dock__rating-heading",
  ratingDescription:
    styles.ratingDescription ?? "flexjar-dock__rating-description",
  ratingField: styles.ratingField ?? "flexjar-dock__rating-field",
  ratingFieldset: styles.ratingFieldset ?? "flexjar-dock__rating-fieldset",
  ratingRow: styles.ratingRow ?? "flexjar-dock__rating-row",
  ratingButton: styles.ratingButton ?? "flexjar-dock__rating-button",
  minimizedButton: styles.minimizedButton ?? "flexjar-dock__minimized-button",
};

export const joinClassNames = (
  ...classNames: Array<string | false | undefined>
): string => classNames.filter(Boolean).join(" ");
