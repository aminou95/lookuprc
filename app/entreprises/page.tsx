import { CompaniesTable } from "@/components/companies-table";
import { DashboardShell } from "@/components/dashboard-shell";

export default function EntreprisesPage() {
  return (
    <DashboardShell title="Entreprises" subtitle="Base des entreprises consultées">
      <CompaniesTable compact />
    </DashboardShell>
  );
}
