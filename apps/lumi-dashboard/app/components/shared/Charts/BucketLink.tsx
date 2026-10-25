import { Link as AkselLink } from "@navikt/ds-react";
import { createLink } from "@tanstack/react-router";
import type { ReactNode } from "react";
import styles from "./Charts.module.css";
import type { bucketFeedbackSearch } from "./timeSeriesParts";

const RouterLink = createLink(AkselLink);

/**
 * A day, week or month in a chart's table, as a link to its answers in
 * Tilbakemeldinger. A keyboard cannot reach the chart itself, and a tap on
 * a touch screen only shows the tooltip there.
 */
export function BucketLink({
  search,
  children,
}: {
  search: ReturnType<typeof bucketFeedbackSearch>;
  children: ReactNode;
}) {
  return (
    <RouterLink to="/feedback" search={search}>
      {children} <span className={styles.srOnly}>– åpne svarene</span>
    </RouterLink>
  );
}
