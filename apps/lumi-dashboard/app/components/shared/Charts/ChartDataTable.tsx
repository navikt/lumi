import { BodyShort, Box, ReadMore, Table } from "@navikt/ds-react";
import type { ReactNode } from "react";
import styles from "./Charts.module.css";

export interface ChartDataTableColumn {
  label: string;
  align?: "left" | "right";
}

export interface ChartDataTableRow {
  key: string;
  header: ReactNode;
  cells: ReactNode[];
}

interface ChartDataTableProps {
  /** Accessible name of the table, also read out after «Vis som tabell». */
  label: string;
  /** Heading of the first column, which holds each row's header. */
  rowHeader: string;
  columns: ChartDataTableColumn[];
  rows: ChartDataTableRow[];
  /**
   * Shows a loading text instead of the table. The disclosure stays open, so
   * a filter change does not close a table the viewer has opened.
   */
  loading?: boolean;
}

/**
 * The chart's numbers as a table behind «Vis som tabell». Screen readers only
 * get a short summary of the chart itself, so the table is its text
 * alternative (WCAG 1.1.1). It is collapsed by default, so the page does not
 * read out long tables unless asked.
 */
export function ChartDataTable({
  label,
  rowHeader,
  columns,
  rows,
  loading = false,
}: ChartDataTableProps) {
  return (
    <ReadMore
      size="small"
      header={
        <>
          Vis som tabell
          {/* Tells the buttons apart when a page has several charts. */}
          <span className={styles.srOnly}>: {label}</span>
        </>
      }
    >
      {loading ? (
        <BodyShort size="small">Laster tallene …</BodyShort>
      ) : (
        // Narrow cards may scroll sideways. The region can take focus, so
        // keyboard users can scroll it too.
        <Box
          className={styles.dataTableViewport}
          tabIndex={0}
          role="region"
          aria-label={label}
        >
          <Table size="small" aria-label={label}>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell scope="col">{rowHeader}</Table.HeaderCell>
                {columns.map((column) => (
                  <Table.HeaderCell
                    key={column.label}
                    scope="col"
                    align={column.align ?? "right"}
                  >
                    {column.label}
                  </Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.key}>
                  <Table.HeaderCell scope="row">{row.header}</Table.HeaderCell>
                  {row.cells.map((cell, index) => (
                    <Table.DataCell
                      key={columns[index]?.label ?? index}
                      align={columns[index]?.align ?? "right"}
                    >
                      {cell}
                    </Table.DataCell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Box>
      )}
    </ReadMore>
  );
}
