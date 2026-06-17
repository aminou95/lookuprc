"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

export function SidjilcomSessionForm() {
  const [curl, setCurl] = useState("");
  const [cookie, setCookie] = useState("");
  const [pAuth, setPAuth] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sidjilcom-session", {
      headers: adminKey ? { "x-admin-key": adminKey } : {}
    })
      .then((response) => response.json())
      .then((data) => {
        setUpdatedAt(data.updatedAt ?? null);
        setSource(data.source ?? null);
      })
      .catch(() => {
        setUpdatedAt(null);
        setSource(null);
      });
  }, [adminKey]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/sidjilcom-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(adminKey ? { "x-admin-key": adminKey } : {}) },
        body: JSON.stringify({ curl, cookie, pAuth })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Session Sidjilcom invalide.");
        return;
      }

      setUpdatedAt(data.updatedAt);
      setSource(data.source ?? "local");
      setMessage("Session premium enregistree cote serveur. Relancez la recherche CNRC.");
      setCurl("");
      setCookie("");
      setPAuth("");
    } catch {
      setError("Impossible d'enregistrer la session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">Session premium Sidjilcom</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Collez la requete cURL du clic Detail depuis l&apos;onglet Network, ou renseignez Cookie et p_auth.
          </p>
        </div>
        {updatedAt ? (
          <div className="inline-flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            Configuree
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Cle admin</span>
          <input
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            placeholder="SIDJILCOM_ADMIN_KEY"
            type="password"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">cURL Network Sidjilcom</span>
          <textarea
            value={curl}
            onChange={(event) => setCurl(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-md border border-line p-3 font-mono text-xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            placeholder="curl 'https://sidjilcom.cnrc.dz/...' -H 'Cookie: ...'"
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Cookie</span>
            <input
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              placeholder="COOKIE_SUPPORT=true; JSESSIONID=..."
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">p_auth</span>
            <input
              value={pAuth}
              onChange={(event) => setPAuth(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              placeholder="WXpQdZFW"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
          >
            {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Save aria-hidden className="h-4 w-4" />}
            Enregistrer la session
          </button>
          {message ? <p className="text-sm text-brand-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        {source ? <p className="text-xs text-slate-500">Source active: {source}</p> : null}
        {updatedAt ? <p className="text-xs text-slate-500">Derniere mise a jour: {new Date(updatedAt).toLocaleString("fr-FR")}</p> : null}
      </form>
    </section>
  );
}
