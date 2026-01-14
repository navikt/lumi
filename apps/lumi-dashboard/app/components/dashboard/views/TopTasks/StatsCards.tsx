import { ChatIcon, ThumbDownIcon, ThumbUpIcon } from "@navikt/aksel-icons";
import { DashboardGrid } from "~/components/dashboard";
import { StatCard } from "~/components/dashboard/sections/StatsCards";
import type { TopTasksResponse } from "~/types/api";

interface TopTasksStatsCardsProps {
  data: TopTasksResponse;
}

/**
 * Stats cards specifically for Top Tasks surveys.
 * Displays total submissions, success rate, and failure rate.
 */
export function TopTasksStatsCards({ data }: TopTasksStatsCardsProps) {
  const total = data.totalSubmissions;
  const totalSuccess = data.tasks.reduce(
    (acc, task) => acc + task.successCount,
    0,
  );
  const successRate = total > 0 ? Math.round((totalSuccess / total) * 100) : 0;

  return (
    <DashboardGrid
      columns={{ xs: 2, sm: 3 }}
      gap={{ xs: "space-12", md: "space-16" }}
    >
      <StatCard
        icon={<ChatIcon fontSize="1.25rem" aria-hidden />}
        label="Antall svar"
        value={total.toLocaleString("no-NO")}
        subtitle="Totalt"
      />

      <StatCard
        icon={<ThumbUpIcon fontSize="1.25rem" aria-hidden />}
        label="Suksessrate"
        value={`${successRate}%`}
        subtitle="Gjennomsnitt"
      />

      <StatCard
        icon={<ThumbDownIcon fontSize="1.25rem" aria-hidden />}
        label="Feilrate"
        value={`${100 - successRate}%`}
        subtitle="Ikke fullført"
      />
    </DashboardGrid>
  );
}
