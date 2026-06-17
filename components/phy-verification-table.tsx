"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowDownUp, Filter, Loader2, RefreshCw, Search } from "lucide-react";

type VerificationResult = {
  status: "match" | "partial_match" | "mismatch" | "missing_identity" | "missing_rc" | "lookup_failed" | "unsupported_type";
  category?: "physique" | "morale" | "unknown";
  appType?: string;
  appName?: string;
  rawRc?: string;
  appNif?: string;
  appNis?: string;
  officialNif?: string;
  officialNis?: string;
  officialCnrc?: string;
  error?: string;
  code?: string;
  official?: {
    rc: string;
    nom: string;
    prenom: string;
    adresse: string;
    statut: string;
  };
};

type VerificationResponse = {
  totalRows: number;
  checkedRows: number;
  results: VerificationResult[];
  error?: string;
};

const statusLabels: Record<VerificationResult["status"], string> = {
  match: "Correspond",
  partial_match: "Partiel",
  mismatch: "Different",
  missing_identity: "Identifiant manquant",
  missing_rc: "RC manquant",
  lookup_failed: "Non trouve",
  unsupported_type: "Type inconnu"
};

function statusClass(status: VerificationResult["status"]) {
  if (status === "match") return "bg-emerald-50 text-emerald-700";
  if (status === "partial_match") return "bg-blue-50 text-blue-700";
  if (status === "mismatch") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function categoryLabel(category?: VerificationResult["category"]) {
  if (category === "morale") return "Personne morale";
  if (category === "physique") return "Personne physique";
  return "-";
}

export function PhyVerificationTable() {
  const [data, setData] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VerificationResult["status"]>("all");
  const [sortBy, setSortBy] = useState<"client" | "rc" | "status">("client");

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/appsheet-verify-phy?limit=50", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Impossible de verifier les clients AppSheet.");
        return;
      }

      setData(payload);
    } catch {
      setError("Erreur reseau pendant la verification.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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

  const filteredResults = (data?.results ?? [])
    .filter((result) => {
      const searchText = [
        result.appName,
        result.rawRc,
        result.appNif,
        result.appNis,
        result.officialNif,
        result.officialNis,
        result.officialCnrc,
        result.official?.nom,
        result.official?.prenom
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = searchText.includes(query.trim().toLowerCase());
      const matchesStatus = statusFilter === "all" || result.status === statusFilter;

      return matchesQuery && matchesStatus;
    })
    .sort((first, second) => {
      if (sortBy === "status") return first.status.localeCompare(second.status);
      if (sortBy === "rc") return (first.rawRc || "").localeCompare(second.rawRc || "");
      return (first.appName || "").localeCompare(second.appName || "");
    });

  return (
    <section className="rounded-lg border border-line bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-ink">{filteredResults.length}</span> affiches sur{" "}
          <span className="font-semibold text-ink">{data?.checkedRows ?? 0}</span> clients AppSheet verifies et{" "}
          <span className="font-semibold text-ink">{data?.totalRows ?? 0}</span> lignes AppSheet.
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-slate-50"
        >
          <RefreshCw aria-hidden className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="grid gap-3 border-b border-line px-4 py-4 lg:grid-cols-[minmax(220px,1fr)_220px_220px]">
        <label className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher client, RC, NIF, NIS"
            className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="relative">
          <Filter aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          >
            <option value="all">Tous les statuts</option>
            <option value="match">Correspond</option>
            <option value="partial_match">Partiel</option>
            <option value="mismatch">Different</option>
            <option value="missing_identity">Identifiant manquant</option>
            <option value="lookup_failed">Non trouve</option>
            <option value="unsupported_type">Type inconnu</option>
          </select>
        </label>

        <label className="relative">
          <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          >
            <option value="client">Trier par client</option>
            <option value="rc">Trier par RC</option>
            <option value="status">Trier par statut</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Client AppSheet</th>
              <th className="px-4 py-3">RC AppSheet</th>
              <th className="px-4 py-3">NIF / NIS</th>
              <th className="px-4 py-3">Format officiel</th>
              <th className="px-4 py-3">Nom officiel</th>
              <th className="px-4 py-3">Adresse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredResults.length ? (
              filteredResults.map((result, index) => (
                <tr key={`${result.appName}-${result.rawRc}-${index}`} className="align-top">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                      {statusLabels[result.status]}
                    </span>
                    {result.error ? <p className="mt-2 max-w-52 text-xs text-red-600">{result.error}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{categoryLabel(result.category)}</td>
                  <td className="min-w-56 px-4 py-3 font-medium text-ink">{result.appName || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{result.rawRc || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    <div>NIF: {result.appNif || "-"}</div>
                    <div>NIS: {result.appNis || "-"}</div>
                    {(result.officialNif || result.officialNis) ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Officiel: {result.officialNif || "-"} / {result.officialNis || "-"}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-brand-700">{result.officialCnrc || "-"}</td>
                  <td className="min-w-56 px-4 py-3 text-slate-700">
                    {[result.official?.nom, result.official?.prenom].filter(Boolean).join(" ") || "-"}
                  </td>
                  <td className="min-w-64 px-4 py-3 text-slate-700">{result.official?.adresse || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                  Aucun client AppSheet a verifier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
