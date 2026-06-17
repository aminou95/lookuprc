import { CompaniesTable } from "@/components/companies-table";
import { DashboardShell } from "@/components/dashboard-shell";

export default function HistoriquePage() {
  return (
    <DashboardShell title="Historique" subtitle="Toutes les recherches CNRC enregistrées">
      <CompaniesTable />
    </DashboardShell>
  );
}
