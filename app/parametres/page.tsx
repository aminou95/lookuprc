import { Cookie, Database, Shield } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SidjilcomSessionForm } from "@/components/sidjilcom-session-form";

const settings = [
  {
    title: "Cookie Sidjilcom",
    description: "Stocké uniquement dans SIDJILCOM_COOKIE côté serveur.",
    icon: Cookie
  },
  {
    title: "Persistance Supabase",
    description: "Utilise SUPABASE_SERVICE_ROLE_KEY pour enregistrer les recherches abouties.",
    icon: Database
  },
  {
    title: "Déploiement Vercel",
    description: "Configurez les variables d'environnement dans les paramètres du projet.",
    icon: Shield
  }
];

export default function ParametresPage() {
  return (
    <DashboardShell title="Paramètres" subtitle="Configuration serveur et déploiement">
      <div className="space-y-5">
        <SidjilcomSessionForm />

        <div className="grid gap-4 lg:grid-cols-3">
          {settings.map((setting) => (
            <section key={setting.title} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <setting.icon aria-hidden className="h-5 w-5 text-brand-700" />
              <h2 className="mt-4 font-semibold text-ink">{setting.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{setting.description}</p>
            </section>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
