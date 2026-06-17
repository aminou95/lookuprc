"use client";

import type { ReactNode } from "react";
import type { ImportedSidjilcomDetails, SidjilcomDetails } from "@/lib/types";

type Field = {
  label: string;
  value?: string;
  lang?: "fr" | "ar";
  wide?: boolean;
};

type DetailsLike =
  | SidjilcomDetails
  | (ImportedSidjilcomDetails & {
      inscription?: SidjilcomDetails["inscription"];
      commercant?: SidjilcomDetails["commercant"];
      localCommercial?: SidjilcomDetails["localCommercial"];
      fondsCommerce?: SidjilcomDetails["fondsCommerce"];
      activitesExercees?: SidjilcomDetails["activitesExercees"];
    });

function clean(value?: string) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:])/g, "$1")
    .trim();

  if (!text || text === "-" || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") {
    return "";
  }

  return text;
}

function hasArabic(value?: string) {
  return /[\u0600-\u06FF]/.test(value ?? "");
}

function uniqueFields(fields: Field[]) {
  const seen = new Set<string>();

  return fields
    .map((field) => ({ ...field, value: clean(field.value) }))
    .filter((field) => {
      if (!field.value) return false;
      const signature = `${field.label.toLowerCase()}::${field.value.toLowerCase()}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function firstValue(...values: (string | undefined)[]) {
  return values.map(clean).find(Boolean) ?? "";
}

function hasFilledFields(fields: Field[]) {
  return uniqueFields(fields).length > 0;
}

function InfoGrid({ fields }: { fields: Field[] }) {
  const items = uniqueFields(fields);

  if (!items.length) {
    return <p className="text-sm text-slate-500">Aucune information disponible.</p>;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((field) => {
        const isArabic = field.lang === "ar" || hasArabic(field.value);

        return (
        <div
          key={`${field.label}-${field.value}`}
          className={`min-w-0 rounded-xl border border-line bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(241,245,249,0.92))] px-3 py-3 shadow-sm ${field.wide ? "sm:col-span-2 xl:col-span-3" : ""}`}
        >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
            <dd
              className={`mt-1 break-words text-sm font-semibold text-ink ${isArabic ? "text-right text-base leading-7" : ""}`}
              dir={isArabic ? "rtl" : "ltr"}
              lang={isArabic ? "ar" : "fr"}
            >
              {field.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-white">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-[linear-gradient(180deg,_#0d9488,_#2563eb)]" />
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function rawFieldFallback(rawFields: Record<string, string> | undefined, aliases: string[]) {
  const entries = Object.entries(rawFields ?? {});
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());

  for (const [label, value] of entries) {
    const normalized = label.toLowerCase();
    if (normalizedAliases.some((alias) => normalized.includes(alias))) {
      return value;
    }
  }

  return "";
}

function normalizeActivities(details: DetailsLike) {
  const seen = new Set<string>();
  const activities =
    "activities" in details && details.activities?.length
      ? details.activities.map((activity) => ({
          code: "code" in activity ? activity.code : activity.codeActivite,
          libelle: "libelle" in activity ? activity.libelle : activity.libelleActivite,
          agrement: "numeroAgrement" in activity ? activity.numeroAgrement : ""
        }))
      : (details.activitesExercees ?? []).map((activity) => ({
          code: firstValue(activity.code, activity.Code, activity["Code Activite"], activity["Code Activité"]),
          libelle: firstValue(activity.libelle, activity.Libelle, activity["Libellé"], activity["Libelle Activite"]),
          agrement: firstValue(activity.numeroAgrement, activity["Numero Agrement"], activity["Numéro Agrément"])
        }));

  return activities
    .map((activity) => ({
      code: clean(activity.code),
      libelle: clean(activity.libelle),
      agrement: clean(activity.agrement)
    }))
    .filter((activity) => {
      if (!activity.code && !activity.libelle && !activity.agrement) return false;
      const signature = `${activity.code}|${activity.libelle}|${activity.agrement}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function normalizeRows(rows: Record<string, string>[] | undefined) {
  const seen = new Set<string>();

  return (rows ?? [])
    .map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .map(([label, value]) => [label, clean(value)])
          .filter(([, value]) => value)
      )
    )
    .filter((row) => {
      const signature = JSON.stringify(row);
      if (signature === "{}" || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function TechnicalRawFields({ fields }: { fields: Record<string, string> }) {
  const entries = uniqueFields(Object.entries(fields).map(([label, value]) => ({ label, value })));

  if (!entries.length) return null;

  return (
    <details className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-white">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Champs techniques extraits ({entries.length})</summary>
      <div className="mt-4">
        <InfoGrid fields={entries} />
      </div>
    </details>
  );
}

export function SidjilcomDetailsView({
  details,
  onSearchAssociate,
  onSearchActivity,
  associateActionLabel = "Voir les societes de ce gerant",
  activityActionLabel = "Voir les societes de cette activite"
}: {
  details: DetailsLike;
  onSearchAssociate?: (fullName: string) => void;
  onSearchActivity?: (activity: string) => void;
  associateActionLabel?: string;
  activityActionLabel?: string;
}) {
  const merchant = details.merchant ?? {
    rc: "",
    nom: "",
    prenom: "",
    nomAr: "",
    prenomAr: "",
    dateNaissance: "",
    lieuNaissance: "",
    nis: "",
    nif: "",
    etatCivil: "",
    nationalite: "",
    regimeMatrimonial: "",
    dateImmatriculation: "",
    adresse: "",
    commune: "",
    telephone: "",
    dateDebutExploitation: "",
    typeCommerce: ""
  };

  const inscription = details.inscription ?? { dateImmatriculation: "", numeroInscription: "", dateModification: "" };
  const commercant = details.commercant ?? {
    nomFr: "",
    nomAr: "",
    prenomFr: "",
    prenomAr: "",
    dateNaissance: "",
    numeroActeNaissance: "",
    lieuNaissance: "",
    nis: "",
    nif: "",
    etatCivil: "",
    nationalite: "",
    regimeMatrimonial: ""
  };
  const local = details.localCommercial ?? {
    typeCommerce: "",
    adresse: "",
    codePostal: "",
    communeWilayaInscription: "",
    nomCommercial: "",
    dateDebutExploitation: "",
    telephone: "",
    fax: "",
    email: "",
    appartenanceLocal: "",
    natureAcquisitionLocal: "",
    proprietaireLocal: "",
    natureLocation: "",
    dureeBail: ""
  };
  const fonds = details.fondsCommerce ?? {
    appartenanceFonds: "",
    natureAcquisitionFonds: "",
    numeroRc: "",
    proprietaireFonds: "",
    adresseFonds: "",
    natureBail: "",
    dateDebutBail: "",
    dureeBail: ""
  };
  const rawFields = details.rawFields ?? {};

  const rc = firstValue(
    inscription.numeroInscription,
    merchant.rc,
    rawFieldFallback(rawFields, ["numero d'inscription", "numéro d'inscription", "rc"])
  );
  const title = firstValue(
    merchant.nom,
    commercant.nomFr,
    rawFieldFallback(rawFields, ["raison sociale", "nom commercial", "denomination", "nom"]),
    "Entreprise"
  );
  const subtitle = firstValue(merchant.prenom, commercant.prenomFr);
  const activities = normalizeActivities(details);
  const associates = normalizeRows(
    "associates" in details && Array.isArray(details.associates)
      ? details.associates.map((associate) => ({
          "Nom complet": associate.nomComplet,
          "Date de naissance": associate.dateNaissance,
          "Lieu de naissance": associate.lieuNaissance,
          Qualite: associate.qualite,
          Telephone: associate.telephone,
          Fax: associate.fax,
          Nationalite: associate.nationalite
        }))
      : []
  );
  const modifications = normalizeRows(details.modifications);
  const isFallbackSummary = clean(rawFields.Source) === "Resume Sidjilcom";

  const frenchIdentityFields: Field[] = [
    { label: "Nom", value: firstValue(merchant.nom, commercant.nomFr) },
    { label: "Prenom", value: firstValue(merchant.prenom, commercant.prenomFr) },
    { label: "Raison sociale", value: rawFieldFallback(rawFields, ["raison sociale", "denomination", "nom commercial"]) },
    { label: "Date de naissance", value: firstValue(merchant.dateNaissance, commercant.dateNaissance) },
    { label: "Lieu de naissance", value: firstValue(merchant.lieuNaissance, commercant.lieuNaissance), wide: true },
    { label: "Etat civil", value: firstValue(merchant.etatCivil, commercant.etatCivil) },
    { label: "Nationalite", value: firstValue(merchant.nationalite, commercant.nationalite) },
    { label: "Regime matrimonial", value: firstValue(merchant.regimeMatrimonial, commercant.regimeMatrimonial) }
  ];

  const arabicIdentityFields: Field[] = [
    { label: "اللقب", value: firstValue(merchant.nomAr, commercant.nomAr), lang: "ar" },
    { label: "الاسم", value: firstValue(merchant.prenomAr, commercant.prenomAr), lang: "ar" }
  ];

  const registrationFields: Field[] = [
    { label: "Numero d'inscription", value: rc },
    { label: "Date d'immatriculation", value: firstValue(inscription.dateImmatriculation, merchant.dateImmatriculation) },
    { label: "Date de modification", value: inscription.dateModification },
    { label: "NIF", value: firstValue(merchant.nif, commercant.nif) },
    { label: "NIS", value: firstValue(merchant.nis, commercant.nis) },
    { label: "Numero acte naissance", value: commercant.numeroActeNaissance }
  ];

  const localFields: Field[] = [
    { label: "Type de commerce", value: firstValue(local.typeCommerce, merchant.typeCommerce) },
    { label: "Adresse", value: firstValue(local.adresse, merchant.adresse), wide: true },
    { label: "Commune / Wilaya", value: firstValue(local.communeWilayaInscription, merchant.commune) },
    { label: "Code postal", value: local.codePostal },
    { label: "Nom commercial", value: local.nomCommercial },
    { label: "Date debut exploitation", value: firstValue(local.dateDebutExploitation, merchant.dateDebutExploitation) },
    { label: "Telephone", value: firstValue(local.telephone, merchant.telephone) },
    { label: "Fax", value: local.fax },
    { label: "Email", value: local.email },
    { label: "Appartenance local", value: local.appartenanceLocal },
    { label: "Nature acquisition local", value: local.natureAcquisitionLocal },
    { label: "Proprietaire local", value: local.proprietaireLocal },
    { label: "Nature location", value: local.natureLocation },
    { label: "Duree bail", value: local.dureeBail }
  ];

  const fondsFields: Field[] = [
    { label: "Appartenance fonds", value: fonds.appartenanceFonds },
    { label: "Nature acquisition fonds", value: fonds.natureAcquisitionFonds },
    { label: "Numero RC", value: fonds.numeroRc },
    { label: "Proprietaire fonds", value: fonds.proprietaireFonds },
    { label: "Adresse fonds", value: fonds.adresseFonds, wide: true },
    { label: "Nature bail", value: fonds.natureBail },
    { label: "Date debut bail", value: fonds.dateDebutBail },
    { label: "Duree bail", value: fonds.dureeBail }
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-white via-white to-brand-50/40 p-6 shadow-soft ring-1 ring-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche Sidjilcom</p>
            <h2 className="mt-2 break-words text-2xl font-bold tracking-tight text-ink">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>

          <div className="rounded-xl border border-line bg-white/90 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">N RC</p>
            <p className="mt-1 font-mono text-lg font-bold text-ink">{rc || "-"}</p>
          </div>
        </div>
      </section>

      {isFallbackSummary ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
          Resume verifie disponible. Les champs detailles complets n&apos;ont pas ete retournes par la page societe Sidjilcom pour cette requete.
        </section>
      ) : null}

      {(hasFilledFields(frenchIdentityFields) || hasFilledFields(arabicIdentityFields)) && !isFallbackSummary ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {hasFilledFields(frenchIdentityFields) ? (
            <Section title="Identite en francais">
              <InfoGrid fields={frenchIdentityFields} />
            </Section>
          ) : null}

          {hasFilledFields(arabicIdentityFields) ? (
            <Section title="الهوية بالعربية">
              <InfoGrid fields={arabicIdentityFields} />
            </Section>
          ) : null}
        </div>
      ) : null}

      {hasFilledFields(registrationFields) && !isFallbackSummary ? (
        <Section title="Inscription et identifiants">
          <InfoGrid fields={registrationFields} />
        </Section>
      ) : null}

      {hasFilledFields(localFields) ? (
        <Section title={isFallbackSummary ? "Resume de l'etablissement" : "Local commercial"}>
          <InfoGrid fields={localFields} />
        </Section>
      ) : null}

      {hasFilledFields(fondsFields) && !isFallbackSummary ? (
        <Section title="Fonds de commerce">
          <InfoGrid fields={fondsFields} />
        </Section>
      ) : null}

      {!isFallbackSummary ? (
      <Section title="Activites exercees">
        {activities.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Libelle</th>
                  <th className="px-3 py-2">Agrement</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activities.map((activity) => (
                  <tr key={`${activity.code}-${activity.libelle}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{activity.code || "-"}</td>
                    <td className="min-w-72 px-3 py-2 text-slate-700">{activity.libelle || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{activity.agrement || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {onSearchActivity && (activity.code || activity.libelle) ? (
                        <button
                          type="button"
                          onClick={() => onSearchActivity(activity.code || activity.libelle)}
                          className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
                        >
                          {activityActionLabel}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune activite disponible.</p>
        )}
      </Section>
      ) : null}

      {!isFallbackSummary ? (
      <Section title="Gerants / associes">
        {associates.length ? (
          <div className="space-y-3">
            {associates.map((row, index) => {
              const fullName = String(row["Nom complet"] ?? "");
              return (
                <div key={`associate-${index}`} className="rounded-lg border border-line bg-slate-50/90 p-4">
                  <InfoGrid fields={Object.entries(row).map(([label, value]) => ({ label, value: String(value ?? "") }))} />
                  {onSearchAssociate && fullName ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onSearchAssociate(fullName)}
                        className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
                      >
                        {associateActionLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucun gerant ou associe disponible.</p>
        )}
      </Section>
      ) : null}

      {!isFallbackSummary ? (
      <Section title="Modifications">
        {modifications.length ? (
          <div className="space-y-3">
            {modifications.map((row, index) => (
              <div key={`modification-${index}`} className="rounded-lg border border-line bg-slate-50/90 p-4">
                <InfoGrid fields={Object.entries(row).map(([label, value]) => ({ label, value: String(value ?? "") }))} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune modification disponible.</p>
        )}
      </Section>
      ) : null}

      <TechnicalRawFields fields={rawFields} />
    </div>
  );
}
