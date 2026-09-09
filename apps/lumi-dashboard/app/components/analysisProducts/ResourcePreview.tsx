import {
  BodyShort,
  Box,
  CopyButton,
  HStack,
  Table,
  Tabs,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { useId } from "react";
import type { AnalysisResource } from "~/types/analysisProducts";
import styles from "./ResourcePreview.module.css";

export function ResourcePreview({ resource }: { resource: AnalysisResource }) {
  const hintId = useId();
  return (
    <VStack gap="space-16" className={styles.preview}>
      <Box background="neutral-soft" borderRadius="8" padding="space-12">
        <HStack align="center" gap="space-8" wrap={false}>
          <VStack gap="space-4" className={styles.name}>
            <BodyShort size="small" textColor="subtle">
              Tabellnavn i eksporten
            </BodyShort>
            <code>{resource.name}</code>
          </VStack>
          <CopyButton
            copyText={resource.name}
            title="Kopier tabellnavn"
            activeText="Tabellnavn kopiert"
            size="small"
          />
        </HStack>
      </Box>
      <Tabs defaultValue="rows" size="small">
        <Tabs.List aria-label="Visning av eksporttabellen">
          <Tabs.Tab value="rows" label="Eksempelrader" />
          <Tabs.Tab
            value="columns"
            label={`Kolonner (${resource.columns.length.toLocaleString("nb-NO")})`}
          />
        </Tabs.List>
        <Tabs.Panel value="rows">
          <VStack gap="space-12" paddingBlock="space-16 space-0">
            {resource.syntheticRows.length === 0 ||
            resource.columns.length === 0 ? (
              <BodyShort size="small" textColor="subtle">
                Ingen eksempelrader i denne forhåndsvisningen.
              </BodyShort>
            ) : (
              <>
                <BodyShort id={hintId} size="small" textColor="subtle">
                  Alle {resource.columns.length.toLocaleString("nb-NO")}{" "}
                  kolonner vises i eksportrekkefølge. Rull sidelengs for å se
                  resten.
                </BodyShort>
                <Box
                  borderWidth="1"
                  borderColor="neutral-subtle"
                  borderRadius="8"
                  className={styles.scrollRegion}
                  tabIndex={0}
                  role="region"
                  aria-label="Eksempelrader, rull vannrett for alle kolonner"
                  aria-describedby={hintId}
                >
                  <Table size="small" className={styles.rows}>
                    <caption className={styles.caption}>
                      Syntetiske eksempelrader
                    </caption>
                    <Table.Header>
                      <Table.Row>
                        {resource.columns.map((column) => (
                          <Table.HeaderCell key={column.name} scope="col">
                            <code>{column.name}</code>
                          </Table.HeaderCell>
                        ))}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {resource.syntheticRows.map((row) => (
                        <Table.Row key={JSON.stringify(row)}>
                          {resource.columns.map((column) => (
                            <Table.DataCell key={column.name}>
                              {row[column.name] == null ? (
                                <abbr title="Ingen verdi">NULL</abbr>
                              ) : (
                                String(row[column.name])
                              )}
                            </Table.DataCell>
                          ))}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </Box>
              </>
            )}
          </VStack>
        </Tabs.Panel>
        <Tabs.Panel value="columns">
          <VStack as="dl" margin="space-0" aria-label="Kolonner og betydning">
            {resource.columns.map((column) => (
              <Box
                key={column.name}
                paddingBlock="space-16"
                className={styles.column}
              >
                <HStack as="dt" gap="space-8" align="center">
                  <code className={styles.columnName}>{column.name}</code>
                  <Tag size="xsmall" variant="outline" data-color="neutral">
                    {column.type}
                  </Tag>
                </HStack>
                <Box as="dd" margin="space-0" paddingBlock="space-8 space-0">
                  <VStack gap="space-4">
                    <BodyShort size="small">{column.description}</BodyShort>
                    <BodyShort size="small" textColor="subtle">
                      {column.nullable
                        ? "Kan mangle (NULL)"
                        : "Har alltid en verdi"}
                    </BodyShort>
                  </VStack>
                </Box>
              </Box>
            ))}
          </VStack>
        </Tabs.Panel>
      </Tabs>
    </VStack>
  );
}
