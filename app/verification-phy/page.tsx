import { DashboardShell } from "@/components/dashboard-shell";
import { PhyVerificationTable } from "@/components/phy-verification-table";

export default function VerificationPhyPage() {
  return (
    <DashboardShell title="Verification AppSheet" subtitle="Comparaison PHY et PM avec les donnees Sidjilcom">
      <PhyVerificationTable />
    </DashboardShell>
  );
}
