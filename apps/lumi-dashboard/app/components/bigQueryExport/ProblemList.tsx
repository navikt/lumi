import { Alert, Heading, List } from "@navikt/ds-react";
import type { BigQueryExportProblem } from "~/types/bigQueryExport";
import { problemText } from "./format";

export function ProblemList({
  problems,
  team,
  location,
  heading,
}: {
  problems: BigQueryExportProblem[];
  team: string;
  location: string;
  heading: string;
}) {
  return (
    <Alert variant="error" size="small">
      <Heading level="3" size="xsmall" spacing>
        {heading}
      </Heading>
      <List as="ul" size="small">
        {problems.map((problem) => {
          const text = problemText(problem, { team, location });
          return (
            <List.Item
              key={`${problem.code}:${problem.detail ?? ""}`}
              title={text.title}
            >
              {text.hint}
            </List.Item>
          );
        })}
      </List>
    </Alert>
  );
}
