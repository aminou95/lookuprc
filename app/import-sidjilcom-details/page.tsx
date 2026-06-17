import { DashboardShell } from "@/components/dashboard-shell";
import { ImportSidjilcomDetails } from "@/components/import-sidjilcom-details";

export default function ImportSidjilcomDetailsPage() {
  return (
    <DashboardShell title="Importer détails Sidjilcom" subtitle="Extraction automatique depuis le HTML detailsPP.jsp">
      <ImportSidjilcomDetails />
    </DashboardShell>
  );
}
