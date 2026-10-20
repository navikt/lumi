/** Cache key for a team's BigQuery export status. */
export const bigQueryExportQueryKey = (team: string) =>
  ["bigquery-export", team] as const;
