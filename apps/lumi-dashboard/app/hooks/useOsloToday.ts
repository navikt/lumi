import { useEffect, useState } from "react";
import { todayInOslo } from "~/utils/dashboardPeriod";

/** Keep date descriptions current without changing the selected URL period. */
export function useOsloToday() {
  const [today, setToday] = useState(todayInOslo);
  useEffect(() => {
    const update = () => setToday(todayInOslo());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}
