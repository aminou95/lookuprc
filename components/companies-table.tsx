"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CompanyRecord } from "@/lib/types";

export function CompaniesTable({ compact = false }: { compact?: boolean }) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCompanies() {
      try {
        const response = await fetch("/api/companies", { cache: "no-store" });
        const data = await response.json();

        if (!mounted) return;

        if (!response.ok) {
          setError(data.error ?? "Chargement impossible.");
          return;
        }

        setCompanies(data.companies ?? []);
        setWarning(data.warning ?? null);
      } catch {
        if (mounted) setError("Erreur réseau pendant le chargement.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCompanies();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-line bg-white">
        <Loader2 aria-hidden className="h-5 w-5 animate-spin text-brand-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex gap-2">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white shadow-soft">
      {warning ? <div className="border-b border-line px-4 py-3 text-sm text-amber-700">{warning}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">RC</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Prénom</th>
              {!compact ? <th className="px-4 py-3">Adresse</th> : null}
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">CNRC</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {companies.length ? (
              companies.map((company) => (
                <tr key={company.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{company.rc || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{company.nom || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{company.prenom || "-"}</td>
                  {!compact ? <td className="min-w-72 px-4 py-3 text-slate-700">{company.adresse || "-"}</td> : null}
                  <td className="px-4 py-3 text-slate-700">{company.statut || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {company.nrc1} {company.nrc2} {company.nrc3} / {company.nrc4} - {company.nrc5}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Intl.DateTimeFormat("fr-DZ", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(company.created_at))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={compact ? 6 : 7}>
                  Aucun historique enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
