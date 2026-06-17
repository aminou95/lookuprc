"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPaste, Loader2 } from "lucide-react";
import { SidjilcomDetailsView } from "@/components/sidjilcom-details-view";
import type { ImportedSidjilcomDetails } from "@/lib/types";

function FieldList({ fields }: { fields: Record<string, string> }) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      {Object.entries(fields).map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-medium text-ink">{value || "Non renseigné"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ImportSidjilcomDetails() {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<ImportedSidjilcomDetails | null>(null);

  async function pasteFromClipboard() {
    const text = await navigator.clipboard.readText();
    setHtml(text);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setWarning(null);
    setResult(null);

    try {
      const response = await fetch("/api/import-sidjilcom-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Import impossible.");
        return;
      }

      setWarning(data.warning ?? null);
      setResult(data);
    } catch {
      setError("Erreur réseau pendant l'import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">HTML de la page détails Sidjilcom</h2>
            <p className="mt-1 text-sm text-slate-500">Collez le DOM complet de detailsPP.jsp.</p>
          </div>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <ClipboardPaste aria-hidden className="h-4 w-4" />
            Coller HTML Sidjilcom
          </button>
        </div>
        <textarea
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          className="mt-4 min-h-72 w-full rounded-md border border-line p-3 font-mono text-xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          placeholder="Collez ici le HTML copié depuis Sidjilcom..."
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
          >
            {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden className="h-4 w-4" />}
            Extraire les détails
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
        </div>
      </section>

      {result ? <SidjilcomDetailsView details={result} /> : null}

      {false && result ? (
        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h3 className="mb-4 font-semibold text-ink">Commerçant</h3>
            <FieldList fields={result!.merchant} />
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h3 className="mb-4 font-semibold text-ink">Activité Exercée</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Libellé</th>
                    <th className="px-3 py-2">Agrément</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result!.activities.map((activity, index) => (
                    <tr key={`${activity.codeActivite}-${index}`}>
                      <td className="px-3 py-2 font-semibold">{activity.codeActivite || "-"}</td>
                      <td className="px-3 py-2">{activity.libelleActivite || "-"}</td>
                      <td className="px-3 py-2">{activity.numeroAgrement || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h3 className="mb-4 font-semibold text-ink">Modifications</h3>
            {result!.modifications.length ? (
              <div className="space-y-3">
                {result!.modifications.map((modification, index) => (
                  <FieldList key={index} fields={modification} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucune modification trouvée.</p>
            )}
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h3 className="mb-4 font-semibold text-ink">Champs bruts</h3>
            <FieldList fields={result!.rawFields} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
