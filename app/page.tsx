import Link from "next/link";
import { ArrowRight, Building2, Clock3, Search, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";

const metrics = [
  { label: "Recherches du jour", value: "24", icon: Search },
  { label: "Entreprises suivies", value: "128", icon: Building2 },
  { label: "Dernière synchronisation", value: "10:42", icon: Clock3 }
];

export default function DashboardPage() {
  return (
    <DashboardShell title="Tableau de bord" subtitle="Vue opérationnelle des recherches CNRC">
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <section key={metric.label} className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{metric.value}</p>
              </div>
              <span className="rounded-md bg-brand-50 p-2 text-brand-700">
                <metric.icon aria-hidden className="h-5 w-5" />
              </span>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-brand-700">
              <ShieldCheck aria-hidden className="h-5 w-5" />
              <span className="text-sm font-semibold">Recherche sécurisée côté serveur</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Consultez un numéro RC en quelques secondes</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Le cookie Sidjilcom reste protégé dans les variables serveur. Les recherches abouties sont archivées
              dans Supabase pour faciliter le suivi client.
            </p>
          </div>
          <Link
            href="/recherche-cnrc"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Lancer une recherche
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
