import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "~/components/shared/Header";

export const Route = createFileRoute("/surveyverksted")({
  component: SurveyWorkshopLayout,
});

function SurveyWorkshopLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
