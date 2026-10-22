import { Alert, Heading, List, VStack } from "@navikt/ds-react";
import type { BigQueryExportProblem } from "~/types/bigQueryExport";
import { fixedBySql, problemText } from "./format";
import { CompactSetupSql, type SqlTarget } from "./SetupSql";

/**
 * What stops the export, with the setup SQL right below when running it
 * again fixes one of the problems.
 */
export function ProblemList({
  problems,
  heading,
  target,
}: {
  problems: BigQueryExportProblem[];
  heading: string;
  target: SqlTarget;
}) {
  const context = { team: target.team, location: target.location };
  return (
    <VStack gap="space-12">
      <Alert variant="error" size="small">
        <Heading level="3" size="xsmall" spacing>
          {heading}
        </Heading>
        <List as="ul" size="small">
          {problems.map((problem) => {
            const text = problemText(problem, context);
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
      {problems.some((problem) => fixedBySql(problem.code)) && (
        <CompactSetupSql target={target} />
      )}
    </VStack>
  );
}
