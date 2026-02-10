import { LinkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Heading,
  Hide,
  Show,
  Table,
  VStack,
} from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { useStats } from "~/hooks/useStats";
import styles from "./UrgentUrls.module.css";

export function UrgentUrls() {
  const { data: stats } = useStats();

  if (
    !stats?.lowestRatingPaths ||
    Object.keys(stats.lowestRatingPaths).length === 0
  ) {
    return null;
  }

  const urls = Object.entries(stats.lowestRatingPaths)
    .map(([path, data]) => ({
      path,
      count: data.count,
      average: data.averageRating,
    }))
    .sort((a, b) => a.average - b.average);

  return (
    <DashboardCard padding="0" className={styles.overflowHidden}>
      <Box
        padding={{ xs: "space-16", md: "space-20" }}
        borderWidth="0 0 1 0"
        borderColor="neutral-subtle"
      >
        <Heading size="small" className={styles.titleRow}>
          <LinkIcon aria-hidden /> Sider med lavest score
        </Heading>
      </Box>
      {/* Desktop: Table view */}
      <Show above="md">
        <Table size="small">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>URL / Path</Table.HeaderCell>
              <Table.HeaderCell align="right">Snitt</Table.HeaderCell>
              <Table.HeaderCell align="right">Antall</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {urls.map((row) => (
              <Table.Row key={row.path}>
                <Table.DataCell>
                  <UrlLink path={row.path} />
                </Table.DataCell>
                <Table.DataCell align="right">
                  {row.average.toFixed(1)}
                </Table.DataCell>
                <Table.DataCell align="right">{row.count}</Table.DataCell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Show>
      {/* Mobile: List view */}
      <Hide above="md">
        <VStack gap="space-0">
          {urls.map((row) => (
            <Box
              key={row.path}
              padding="space-12"
              borderWidth="0 0 1 0"
              borderColor="neutral-subtle"
            >
              <VStack gap="space-4">
                <UrlLink path={row.path} truncate />
                <BodyShort size="small" textColor="subtle">
                  Snitt: {row.average.toFixed(1)} • {row.count} svar
                </BodyShort>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Hide>
    </DashboardCard>
  );
}

/**
 * URL link component with truncation support for mobile
 */
function UrlLink({
  path,
  truncate = false,
}: {
  path: string;
  truncate?: boolean;
}) {
  const href = path.startsWith("http") ? path : `https://www.nav.no${path}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.urlLink} ${truncate ? styles.urlLinkTruncate : ""}`}
    >
      {path}
    </a>
  );
}
