"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function RechercheCnrcError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
      <div className="flex gap-3">
        <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-semibold">La page de recherche a rencontre une erreur.</h2>
          <p className="mt-1 text-sm">Rechargez la page. Si le probleme revient, le composant sera isole sans casser tout le site.</p>
          <p className="mt-2 rounded-md bg-white/70 px-3 py-2 font-mono text-xs text-red-900">{error.message || error.digest || "Erreur inconnue"}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
            Recharger la recherche
          </button>
        </div>
      </div>
    </div>
  );
}
