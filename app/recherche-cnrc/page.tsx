import { DashboardShell } from "@/components/dashboard-shell";
import { SearchForm } from "@/components/search-form";

export default function RechercheCnrcPage() {
  return (
    <DashboardShell title="Recherche Sidjilcom" subtitle="Recherche par CNRC, personne physique ou personne morale">
      <SearchForm />
    </DashboardShell>
  );
}
