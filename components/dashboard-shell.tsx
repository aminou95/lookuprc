"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CheckSquare, Clock3, FileInput, LayoutDashboard, Search, Settings, ShieldCheck, Sparkles } from "lucide-react";

const navigation = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Recherche CNRC", href: "/recherche-cnrc", icon: Search },
  { label: "Importer détails", href: "/import-sidjilcom-details", icon: FileInput },
  { label: "Vérification PHY", href: "/verification-phy", icon: CheckSquare },
  { label: "Historique", href: "/historique", icon: Clock3 },
  { label: "Entreprises", href: "/entreprises", icon: Building2 },
  { label: "Paramètres", href: "/parametres", icon: Settings }
];

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/60 bg-white/78 backdrop-blur-xl lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/70 bg-[linear-gradient(135deg,_rgba(13,148,136,0.14),_rgba(59,130,246,0.08)_55%,_rgba(245,158,11,0.08))] px-6 py-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Recherche premium
            </div>
            <p className="mt-4 text-xl font-bold tracking-tight text-ink">CRLook</p>
            <p className="mt-1 text-sm text-slate-600">Cabinets comptables algériens</p>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-5">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                    active
                      ? "bg-[linear-gradient(90deg,_rgba(13,148,136,0.14),_rgba(59,130,246,0.08))] text-brand-700 shadow-sm ring-1 ring-brand-100"
                      : "text-slate-600 hover:bg-white hover:text-ink hover:shadow-sm"
                  }`}
                >
                  <item.icon aria-hidden className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4">
            <div className="rounded-2xl border border-white/70 bg-[linear-gradient(135deg,_rgba(23,32,51,0.96),_rgba(15,118,110,0.94)_60%,_rgba(37,99,235,0.88))] p-4 text-white shadow-panel">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-xl bg-white/12 p-2">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Session serveur securisee</p>
                  <p className="mt-1 text-xs leading-5 text-white/75">
                    Recherche, details, secondaires et comptes sociaux dans un meme espace de travail.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
                  {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-700">
                    <Search className="h-3.5 w-3.5" />
                    CNRC
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50/80 px-3 py-1.5 text-xs font-semibold text-accent-600">
                    <Building2 className="h-3.5 w-3.5" />
                    PM / PP
                  </span>
                </div>
              </div>
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {navigation.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                        active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <item.icon aria-hidden className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

