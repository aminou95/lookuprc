"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, Database, Loader2, Search, Sparkles } from "lucide-react";
import { getNrc2Preview, nrc2Options, nrc2PersonneMoraleOptions, validateSidjilcomSearchPayload, wilayaOptions } from "@/lib/cnrc";
import { SidjilcomDetailsView } from "@/components/sidjilcom-details-view";
import type { CnrcPayload, CompanyResult, SidjilcomAnnex, SidjilcomCompteSocial, SidjilcomDetails, SidjilcomSearchPayload } from "@/lib/types";

const initialPayload: SidjilcomSearchPayload = {
  searchType: "cnrc",
  lookupMode: "rc",
  language: "fr",
  nrc1: "22",
  nrc2: "A",
  nrc3: "5912919",
  nrc4: "00",
  nrc5: "16",
  nom: "",
  prenom: "",
  nomCommercial: "",
  activite: ""
};

function digitOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function isMoralLetter(value: string | undefined) {
  return value === "B" || value === "W2" || value === "S";
}

function hasArabicText(value?: string) {
  return /[\u0600-\u06ff]/.test(value ?? "");
}

function payloadWithDetectedLanguage(payload: SidjilcomSearchPayload): SidjilcomSearchPayload {
  const searchText = [payload.nom, payload.prenom, payload.nomCommercial, payload.activite].filter(Boolean).join(" ");
  return hasArabicText(searchText) ? { ...payload, language: "ar" } : payload;
}

function rootRcForService(company: CompanyResult, fallbackPayload: SidjilcomSearchPayload) {
  const rc = (company.rc || company.idCommercant || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const match = rc.match(/^(\d{2})(A|B|D|S|W1|W2)(\d{7})/);
  if (match) return `${match[1]}${match[2]}${match[3]}`;
  return `${fallbackPayload.nrc1}${fallbackPayload.nrc2}${fallbackPayload.nrc3}`.toUpperCase();
}

function hasMeaningfulDetails(company: CompanyResult | null) {
  const details = company?.details;
  if (!details || company?.detailUnavailableReason) return false;
  const relevantRawFields = Object.keys(details.rawFields ?? {}).filter((key) =>
    /nif|nis|nom|prenom|raison|adresse|activit|capital|forme|gerant|assoc|date|registre|immatric/i.test(key)
  );
  return Boolean(
    details.merchant?.nom ||
      details.merchant?.nif ||
      details.merchant?.nis ||
      relevantRawFields.length ||
      details.activities?.length ||
      details.activitesExercees?.length
  );
}

function buildFallbackDetails(company: CompanyResult): SidjilcomDetails {
  return {
    merchant: {
      rc: company.rc,
      nom: company.nom,
      prenom: company.prenom,
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
      adresse: company.adresse,
      commune: company.adresse,
      telephone: "",
      dateDebutExploitation: "",
      typeCommerce: ""
    },
    activities: [],
    associates: [],
    inscription: {
      dateImmatriculation: "",
      numeroInscription: company.rc,
      dateModification: ""
    },
    commercant: {
      nomFr: company.nom,
      nomAr: "",
      prenomFr: company.prenom,
      prenomAr: "",
      dateNaissance: "",
      numeroActeNaissance: "",
      lieuNaissance: "",
      nis: "",
      nif: "",
      etatCivil: "",
      nationalite: "",
      regimeMatrimonial: ""
    },
    localCommercial: {
      typeCommerce: "",
      adresse: company.adresse,
      codePostal: "",
      communeWilayaInscription: company.adresse,
      nomCommercial: company.nom,
      dateDebutExploitation: "",
      telephone: "",
      fax: "",
      email: "",
      appartenanceLocal: "",
      natureAcquisitionLocal: "",
      proprietaireLocal: "",
      natureLocation: "",
      dureeBail: ""
    },
    fondsCommerce: {
      appartenanceFonds: "",
      natureAcquisitionFonds: "",
      numeroRc: "",
      proprietaireFonds: "",
      adresseFonds: "",
      natureBail: "",
      dateDebutBail: "",
      dureeBail: ""
    },
    activitesExercees: [],
    modifications: [],
    rawFields: {
      RC: company.rc,
      "Raison sociale": company.nom,
      Adresse: company.adresse,
      Statut: company.statut,
      Source: "Resume Sidjilcom"
    }
  };
}

function DetailValue({ label, value, missing = "Non renseigne" }: { label: string; value?: string | boolean | null; missing?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink">{value || missing}</dd>
    </div>
  );
}

const uiLabels = {
  fr: {
    missing: "Non renseigne",
    searchCnrc: "Recherche CNRC",
    physicalPerson: "Personne physique",
    moralPerson: "Personne morale",
    french: "Francais",
    arabic: "العربية",
    nrc: "N RC",
    raisonSociale: "Raison sociale",
    associateName: "Nom / prenom associe",
    activity: "Code / activite",
    personName: "Nom / prenom",
    associateLastName: "Nom associe",
    associateFirstName: "Prenom associe",
    lastName: "Nom",
    firstNameInput: "Prenom",
    companyName: "Raison sociale / nom commercial",
    activityCode: "Code activite / libelle",
    formatPreview: "Apercu du format",
    searchByName: "Recherche par nom",
    search: "Rechercher",
    resultFound: "Resultat trouve",
    rc: "RC",
    name: "Nom",
    firstName: "Prenom",
    address: "Adresse",
    status: "Statut",
    cache: "Cache",
    saved: "Resultat sauvegarde",
    live: "Resultat verifie maintenant",
    details: "Details",
    detailsLoaded: "Charges",
    detailsUnavailable: "Non disponibles pour cette recherche",
    detailsCached: "Disponibles en cache",
    detailsClick: "Cliquez pour charger",
    showDetails: "Afficher les details",
    showAnnexes: "Voir les secondaires",
    showAccounts: "Voir comptes sociaux",
    emptyResult: "Le resultat s'affichera ici apres la recherche.",
    searchResults: "Resultats de recherche",
    companiesFound: "entreprise(s) trouvee(s)",
    nameHeader: "Nom / Raison sociale",
    action: "Action",
    selected: "Selectionne",
    select: "Selectionner",
    accounts: "Comptes sociaux",
    years: "exercice(s)",
    depositDate: "Date depot",
    otherFields: "Autres champs",
    detail: "Detail",
    annexes: "Etablissements secondaires",
    lastNamePlaceholder: "Ex: TERFI",
    firstNamePlaceholder: "Ex: MOHAMMED AMIN",
    associateLastNamePlaceholder: "Ex: BENATTIA",
    associateFirstNamePlaceholder: "Ex: LAREDJ",
    companyNamePlaceholder: "Ex: SARL NOM ENTREPRISE"
    ,
    activityPlaceholder: "Ex: 605006 ou PRODUCTION CINEMATOGRAPHIQUE",
    showCompaniesForManager: "Voir les societes de ce gerant",
    showCompaniesForActivity: "Voir les societes de cette activite"
  },
  ar: {
    missing: "غير مذكور",
    searchCnrc: "بحث CNRC",
    physicalPerson: "شخص طبيعي",
    moralPerson: "شخص معنوي",
    french: "Français",
    arabic: "العربية",
    nrc: "رقم السجل",
    raisonSociale: "التسمية الاجتماعية",
    associateName: "اسم ولقب الشريك",
    activity: "النشاط / الرمز",
    personName: "اللقب والاسم",
    associateLastName: "لقب الشريك",
    associateFirstName: "اسم الشريك",
    lastName: "اللقب",
    firstNameInput: "الاسم",
    companyName: "الاسم التجاري / اسم الشركة",
    activityCode: "رمز النشاط / الوصف",
    formatPreview: "معاينة الصيغة",
    searchByName: "البحث بالاسم",
    search: "بحث",
    resultFound: "تم العثور على نتيجة",
    rc: "رقم السجل",
    name: "الاسم / التسمية",
    firstName: "الاسم",
    address: "العنوان",
    status: "الحالة",
    cache: "المصدر",
    saved: "نتيجة محفوظة",
    live: "تم التحقق الآن",
    details: "التفاصيل",
    detailsLoaded: "محملة",
    detailsUnavailable: "غير متاحة لهذا البحث",
    detailsCached: "متاحة في الذاكرة",
    detailsClick: "اضغط للتحميل",
    showDetails: "عرض التفاصيل",
    showAnnexes: "عرض الفروع الثانوية",
    showAccounts: "عرض الحسابات الاجتماعية",
    emptyResult: "ستظهر نتيجة البحث هنا.",
    searchResults: "نتائج البحث",
    companiesFound: "نتيجة",
    nameHeader: "الاسم / التسمية الاجتماعية",
    action: "إجراء",
    selected: "مختار",
    select: "اختيار",
    accounts: "الحسابات الاجتماعية",
    years: "سنوات",
    depositDate: "تاريخ الإيداع",
    otherFields: "حقول أخرى",
    detail: "تفصيل",
    annexes: "الفروع الثانوية",
    lastNamePlaceholder: "اكتب اللقب بالعربية",
    firstNamePlaceholder: "اكتب الاسم بالعربية",
    associateLastNamePlaceholder: "اكتب لقب الشريك",
    associateFirstNamePlaceholder: "اكتب اسم الشريك",
    companyNamePlaceholder: "اكتب اسم الشركة بالعربية",
    activityPlaceholder: "اكتب رمز النشاط أو وصفه",
    showCompaniesForManager: "عرض شركات هذا المسير",
    showCompaniesForActivity: "عرض شركات هذا النشاط"
  }
} as const;

export function SearchForm() {
  const [payload, setPayload] = useState<SidjilcomSearchPayload>(initialPayload);
  const [result, setResult] = useState<CompanyResult | null>(null);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [annexesLoading, setAnnexesLoading] = useState(false);
  const [annexDetailsLoading, setAnnexDetailsLoading] = useState<string | null>(null);
  const [annexes, setAnnexes] = useState<SidjilcomAnnex[]>([]);
  const [annexesChecked, setAnnexesChecked] = useState(false);
  const [comptesSociaux, setComptesSociaux] = useState<SidjilcomCompteSocial[]>([]);
  const [comptesSociauxChecked, setComptesSociauxChecked] = useState(false);
  const [comptesSociauxLoading, setComptesSociauxLoading] = useState(false);
  const [compteSocialDetailsLoading, setCompteSocialDetailsLoading] = useState<string | null>(null);

  const searchType = payload.searchType ?? "cnrc";
  const lookupMode = payload.lookupMode ?? (searchType === "cnrc" ? "rc" : "name");
  const language = payload.language ?? "fr";
  const isArabic = language === "ar";
  const t = uiLabels[isArabic ? "ar" : "fr"];
  const validationErrors = useMemo(() => validateSidjilcomSearchPayload(payload), [payload]);
  const isValid = Object.keys(validationErrors).length === 0;
  const nrc2Preview = useMemo(() => getNrc2Preview(payload.nrc2), [payload.nrc2]);
  const hasDetails = hasMeaningfulDetails(result);

  function patchPayload(next: Partial<SidjilcomSearchPayload>) {
    setPayload((current) => payloadWithDetectedLanguage({ ...current, ...next }));
  }

  function changeCategory(nextType: SidjilcomSearchPayload["searchType"]) {
    setResult(null);
    setResults([]);
    setError(null);
    setWarning(null);
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);

    setPayload((current) => {
      const nextMode =
        nextType === "cnrc"
          ? "rc"
          : nextType === "physique" && (current.lookupMode === "associate" || current.lookupMode === "activity")
            ? "name"
            : current.lookupMode ?? "rc";
      return {
        ...current,
        searchType: nextType,
        lookupMode: nextMode,
        nrc2: nextType === "morale" ? (isMoralLetter(current.nrc2) ? current.nrc2 : "B") : isMoralLetter(current.nrc2) ? "A" : current.nrc2
      };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectivePayload = payloadWithDetectedLanguage(payload);
    setResult(null);
    setResults([]);
    setError(null);
    setWarning(null);
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);

    const effectiveValidationErrors = validateSidjilcomSearchPayload(effectivePayload);
    if (Object.keys(effectiveValidationErrors).length > 0) {
      setError("Veuillez corriger les champs avant de lancer la recherche.");
      return;
    }
    setPayload(effectivePayload);

    setLoading(true);

    try {
      const response = await fetch("/api/sidjilcom-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effectivePayload)
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "La recherche a echoue.");
        return;
      }

      const rows = Array.isArray(data.results) ? data.results : [data];
      setResults(rows);
      setResult(rows[0] ?? data);
      setWarning(data.warning ?? null);
    } catch {
      setError("Erreur reseau. Verifiez votre connexion puis reessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails() {
    if (!result || !isValid || !canLoadDetails) return;
    const effectivePayload = payloadWithDetectedLanguage(payload);

    setError(null);
    setWarning(null);
    setDetailsLoading(true);

    try {
      const response = await fetch("/api/sidjilcom-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: effectivePayload,
          idCommercant: result.idCommercant,
          rc: result.rc,
          company: {
            rc: result.rc,
            nom: result.nom,
            prenom: result.prenom,
            adresse: result.adresse,
            statut: result.statut
          }
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le chargement des details a echoue.");
        return;
      }

      const nextResult =
        searchType === "morale" && data.detailUnavailableReason && !data.cache?.detailsAvailable
          ? {
              ...result,
              rc: data.rc || result.rc,
              nom: data.nom || result.nom,
              prenom: data.prenom || result.prenom,
              adresse: data.adresse || result.adresse,
              statut: data.statut || result.statut,
              details: buildFallbackDetails({
                ...result,
                rc: data.rc || result.rc,
                nom: data.nom || result.nom,
                prenom: data.prenom || result.prenom,
                adresse: data.adresse || result.adresse,
                statut: data.statut || result.statut
              }),
              detailUnavailableReason: undefined
            }
          : { ...result, ...data, rc: data.rc || result.rc, nom: data.nom || result.nom, prenom: data.prenom || result.prenom, adresse: data.adresse || result.adresse, statut: data.statut || result.statut };

      setResult(nextResult);
      setWarning(searchType === "morale" ? null : data.detailUnavailableReason ? t.detailsUnavailable : data.cache?.hit ? t.detailsCached : null);
    } catch {
      setError("Erreur reseau pendant le chargement des details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function loadAnnexes() {
    if (!result || !isValid) return;
    const effectivePayload = payloadWithDetectedLanguage(payload);

    setError(null);
    setWarning(null);
    setAnnexesLoading(true);

    try {
      const response = await fetch("/api/sidjilcom-annexes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: effectivePayload, nrc: rootRcForService(result, effectivePayload) })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le chargement des secondaires a echoue.");
        return;
      }

      setAnnexes(data.annexes ?? []);
      setAnnexesChecked(true);
      setWarning(data.annexes?.length ? `${data.annexes.length} etablissement(s) secondaire(s) trouve(s).` : "Aucun secondaire trouve.");
    } catch {
      setError("Erreur reseau pendant le chargement des secondaires.");
    } finally {
      setAnnexesLoading(false);
    }
  }

  async function loadAnnexDetails(annex: SidjilcomAnnex) {
    if (!result || !isValid) return;
    const effectivePayload = payloadWithDetectedLanguage(payload);

    setError(null);
    setWarning(null);
    setAnnexDetailsLoading(annex.idCommercant);

    try {
      const response = await fetch("/api/sidjilcom-annex-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: effectivePayload, idCommercant: annex.idCommercant })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le chargement du detail secondaire a echoue.");
        return;
      }

      setResult({ ...result, details: data.details, detailUnavailableReason: data.detailUnavailableReason });
      setWarning(`Details charges pour le secondaire ${annex.rc}.`);
    } catch {
      setError("Erreur reseau pendant le chargement du detail secondaire.");
    } finally {
      setAnnexDetailsLoading(null);
    }
  }

  async function loadComptesSociaux() {
    if (!result || !isValid || searchType !== "morale") return;
    const effectivePayload = payloadWithDetectedLanguage(payload);

    setError(null);
    setWarning(null);
    setComptesSociauxLoading(true);

    try {
      const response = await fetch("/api/sidjilcom-comptes-sociaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: effectivePayload, nrc: result.rc || result.idCommercant })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le chargement des comptes sociaux a echoue.");
        return;
      }

      const rows = data.comptesSociaux ?? [];
      setComptesSociaux(rows);
      setComptesSociauxChecked(true);
      setWarning(rows.length ? `${rows.length} compte(s) sociaux trouve(s).` : null);
    } catch {
      setError("Erreur reseau pendant le chargement des comptes sociaux.");
    } finally {
      setComptesSociauxLoading(false);
    }
  }

  async function loadCompteSocialDetails(compte: SidjilcomCompteSocial) {
    if (!result || !isValid || searchType !== "morale" || !compte.exercice) return;
    const effectivePayload = payloadWithDetectedLanguage(payload);

    setError(null);
    setWarning(null);
    setCompteSocialDetailsLoading(compte.exercice);

    try {
      const response = await fetch("/api/sidjilcom-compte-social-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: effectivePayload, nrc: rootRcForService(result, effectivePayload), exercice: compte.exercice })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le chargement du detail du compte social a echoue.");
        return;
      }

      setResult({ ...result, details: data.details, detailUnavailableReason: undefined });
      setWarning(`Compte social ${compte.exercice} charge.`);
    } catch {
      setError("Erreur reseau pendant le chargement du compte social.");
    } finally {
      setCompteSocialDetailsLoading(null);
    }
  }

  const nrcOptions = searchType === "morale" ? nrc2PersonneMoraleOptions : nrc2Options;
  const showRcFields = searchType === "cnrc" || lookupMode === "rc";
  const showPhysicalName = (searchType === "physique" && lookupMode === "name") || (searchType === "morale" && lookupMode === "associate");
  const showMoralName = searchType === "morale" && lookupMode === "name";
  const showMoralActivity = searchType === "morale" && lookupMode === "activity";
  const showPrenomColumn = searchType !== "morale" || lookupMode === "associate";
  const canLoadDetails = true;

  function selectResult(company: CompanyResult) {
    setResult({ ...company, details: undefined, detailUnavailableReason: undefined });
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);
    setWarning(results.length > 1 ? `Ligne selectionnee : ${company.rc || company.nom}` : null);
  }

  function changeLookupMode(nextMode: SidjilcomSearchPayload["lookupMode"]) {
    setResult(null);
    setResults([]);
    setError(null);
    setWarning(null);
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);
    patchPayload({ lookupMode: nextMode });
  }

  async function searchByAssociate(fullName: string) {
    const cleaned = fullName.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    const [nom = "", ...rest] = cleaned.split(" ");
    const prenom = rest.join(" ");
    const nextPayload = payloadWithDetectedLanguage({
      ...payload,
      searchType: "morale",
      lookupMode: "associate",
      nom,
      prenom,
      nomCommercial: "",
      activite: ""
    });
    setPayload(nextPayload);
    setResult(null);
    setResults([]);
    setError(null);
    setWarning(null);
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);
    setLoading(true);
    try {
      const response = await fetch("/api/sidjilcom-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "La recherche a echoue.");
        return;
      }
      const rows = Array.isArray(data.results) ? data.results : [data];
      setResults(rows);
      setResult(rows[0] ?? data);
    } catch {
      setError("Erreur reseau. Verifiez votre connexion puis reessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function searchByActivity(activity: string) {
    const activite = activity.trim();
    if (!activite) return;
    const nextPayload = payloadWithDetectedLanguage({
      ...payload,
      searchType: "morale",
      lookupMode: "activity",
      activite,
      nom: "",
      prenom: "",
      nomCommercial: ""
    });
    setPayload(nextPayload);
    setResult(null);
    setResults([]);
    setError(null);
    setWarning(null);
    setAnnexes([]);
    setAnnexesChecked(false);
    setComptesSociaux([]);
    setComptesSociauxChecked(false);
    setLoading(true);
    try {
      const response = await fetch("/api/sidjilcom-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "La recherche a echoue.");
        return;
      }
      const rows = Array.isArray(data.results) ? data.results : [data];
      setResults(rows);
      setResult(rows[0] ?? data);
    } catch {
      setError("Erreur reseau. Verifiez votre connexion puis reessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-[linear-gradient(135deg,_rgba(13,148,136,0.18),_rgba(255,255,255,0.95))] p-4 shadow-soft ring-1 ring-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700/80">Recherche active</p>
              <p className="mt-2 text-lg font-semibold text-ink">{searchType === "cnrc" ? t.searchCnrc : searchType === "physique" ? t.physicalPerson : t.moralPerson}</p>
            </div>
            <span className="rounded-xl bg-white/80 p-2 text-brand-700 shadow-sm">
              <Search className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-[linear-gradient(135deg,_rgba(59,130,246,0.14),_rgba(255,255,255,0.95))] p-4 shadow-soft ring-1 ring-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-600/80">Mode</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {showRcFields ? t.nrc : showMoralActivity ? t.activity : showMoralName ? t.raisonSociale : t.personName}
              </p>
            </div>
            <span className="rounded-xl bg-white/80 p-2 text-accent-600 shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-[linear-gradient(135deg,_rgba(245,158,11,0.16),_rgba(255,255,255,0.95))] p-4 shadow-soft ring-1 ring-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-600/80">Source</p>
              <p className="mt-2 text-lg font-semibold text-ink">{result?.cache?.hit ? t.saved : "Sidjilcom direct"}</p>
            </div>
            <span className="rounded-xl bg-white/80 p-2 text-gold-600 shadow-sm">
              <Database className="h-4 w-4" />
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-panel ring-1 ring-white backdrop-blur">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-4 border-b border-line/80 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  <Building2 className="h-3.5 w-3.5" />
                  CNRC DZ
                </span>
                <span className="inline-flex rounded-full border border-accent-100 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-600">
                  Dashboard de recherche
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "cnrc", label: t.searchCnrc },
                  { value: "physique", label: t.physicalPerson },
                  { value: "morale", label: t.moralPerson }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => changeCategory(item.value as SidjilcomSearchPayload["searchType"])}
                    className={`h-11 rounded-xl border px-3 text-sm font-semibold transition ${
                      searchType === item.value
                        ? "border-brand-600 bg-[linear-gradient(135deg,_rgba(13,148,136,0.12),_rgba(59,130,246,0.06))] text-brand-700 shadow-sm"
                        : "border-line bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="inline-flex rounded-xl border border-line bg-slate-50/90 p-1">
                  {[
                    { value: "fr", label: t.french },
                    { value: "ar", label: t.arabic }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => patchPayload({ language: item.value as SidjilcomSearchPayload["language"] })}
                      className={`h-8 rounded-lg px-3 text-sm font-semibold ${language === item.value ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
                      dir={item.value === "ar" ? "rtl" : "ltr"}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {searchType !== "cnrc" ? (
                  <div className="inline-flex rounded-xl border border-line bg-slate-50/90 p-1">
                    {(searchType === "morale"
                      ? [
                          { value: "rc", label: t.nrc },
                          { value: "name", label: t.raisonSociale },
                          { value: "associate", label: t.associateName },
                          { value: "activity", label: t.activity }
                        ]
                      : [
                          { value: "rc", label: t.nrc },
                          { value: "name", label: t.personName }
                        ]
                    ).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => changeLookupMode(item.value as SidjilcomSearchPayload["lookupMode"])}
                        className={`h-8 rounded-lg px-3 text-sm font-semibold ${lookupMode === item.value ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {showRcFields ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">nrc1</span>
                  <input
                    value={payload.nrc1}
                    onChange={(event) => patchPayload({ nrc1: digitOnly(event.target.value, 2) })}
                    inputMode="numeric"
                    maxLength={2}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    aria-invalid={Boolean(validationErrors.nrc1)}
                  />
                  {validationErrors.nrc1 ? <p className="text-xs text-red-600">{validationErrors.nrc1}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">nrc2</span>
                  <select
                    value={payload.nrc2}
                    onChange={(event) => patchPayload({ nrc2: event.target.value as CnrcPayload["nrc2"] })}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  >
                    {nrcOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">nrc3</span>
                  <input
                    value={payload.nrc3}
                    onChange={(event) => patchPayload({ nrc3: digitOnly(event.target.value, 7) })}
                    inputMode="numeric"
                    maxLength={7}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    aria-invalid={Boolean(validationErrors.nrc3)}
                  />
                  {validationErrors.nrc3 ? <p className="text-xs text-red-600">{validationErrors.nrc3}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">nrc4</span>
                  <input
                    value={payload.nrc4}
                    onChange={(event) => patchPayload({ nrc4: digitOnly(event.target.value, 2) })}
                    inputMode="numeric"
                    maxLength={2}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    aria-invalid={Boolean(validationErrors.nrc4)}
                  />
                  {validationErrors.nrc4 ? <p className="text-xs text-red-600">{validationErrors.nrc4}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">nrc5</span>
                  <select
                    value={payload.nrc5}
                    onChange={(event) => patchPayload({ nrc5: event.target.value })}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  >
                    {wilayaOptions.map((wilaya) => (
                      <option key={wilaya.value} value={wilaya.value}>
                        {wilaya.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {showPhysicalName ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {searchType === "morale" ? t.associateLastName : t.lastName}
                  </span>
                  <input
                    value={payload.nom ?? ""}
                    onChange={(event) => patchPayload({ nom: event.target.value })}
                    dir={isArabic ? "rtl" : "ltr"}
                    lang={isArabic ? "ar" : "fr"}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    placeholder={searchType === "morale" ? t.associateLastNamePlaceholder : t.lastNamePlaceholder}
                    aria-invalid={Boolean(validationErrors.nom)}
                  />
                  {validationErrors.nom ? <p className="text-xs text-red-600">{validationErrors.nom}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {searchType === "morale" ? t.associateFirstName : t.firstNameInput}
                  </span>
                  <input
                    value={payload.prenom ?? ""}
                    onChange={(event) => patchPayload({ prenom: event.target.value })}
                    dir={isArabic ? "rtl" : "ltr"}
                    lang={isArabic ? "ar" : "fr"}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    placeholder={searchType === "morale" ? t.associateFirstNamePlaceholder : t.firstNamePlaceholder}
                    aria-invalid={Boolean(validationErrors.prenom)}
                  />
                  {validationErrors.prenom ? <p className="text-xs text-red-600">{validationErrors.prenom}</p> : null}
                </label>
              </div>
            ) : null}

            {showMoralName ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{t.companyName}</span>
                <input
                  value={payload.nomCommercial ?? ""}
                  onChange={(event) => patchPayload({ nomCommercial: event.target.value })}
                  dir={isArabic ? "rtl" : "ltr"}
                  lang={isArabic ? "ar" : "fr"}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  placeholder={t.companyNamePlaceholder}
                  aria-invalid={Boolean(validationErrors.nomCommercial)}
                />
                {validationErrors.nomCommercial ? <p className="text-xs text-red-600">{validationErrors.nomCommercial}</p> : null}
              </label>
            ) : null}

            {showMoralActivity ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{t.activityCode}</span>
                <input
                  value={payload.activite ?? ""}
                  onChange={(event) => patchPayload({ activite: event.target.value })}
                  dir={isArabic ? "rtl" : "ltr"}
                  lang={isArabic ? "ar" : "fr"}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  placeholder={t.activityPlaceholder}
                  aria-invalid={Boolean(validationErrors.activite)}
                />
                {validationErrors.activite ? <p className="text-xs text-red-600">{validationErrors.activite}</p> : null}
              </label>
            ) : null}

            <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl border border-brand-100 bg-[linear-gradient(135deg,_rgba(13,148,136,0.08),_rgba(59,130,246,0.04),_rgba(255,255,255,0.96))] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{showRcFields ? t.formatPreview : t.searchByName}</p>
                {showRcFields ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-ink" dir="ltr">
                    <span>{payload.nrc1 || "22"}</span>
                    <span dir="rtl" lang="ar" className="inline-block min-w-4 text-center">
                      {nrc2Preview}
                    </span>
                    <span>{payload.nrc3 || "5912919"}</span>
                    <span>/</span>
                    <span>{payload.nrc4 || "00"}</span>
                    <span>-</span>
                    <span>{payload.nrc5 || "16"}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-ink" dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "fr"}>
                    {showPhysicalName
                      ? `${payload.nom || t.lastName} ${payload.prenom || t.firstNameInput}`
                      : showMoralActivity
                        ? payload.activite || t.activity
                        : payload.nomCommercial || t.raisonSociale}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isValid}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,_#0d9488,_#2563eb)] px-5 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
                {t.search}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/95 p-4 text-sm text-red-700 shadow-soft">
              <div className="flex gap-2">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          ) : null}

          {warning ? <div className="rounded-xl border border-amber-200 bg-amber-50/95 p-4 text-sm text-amber-800 shadow-soft">{warning}</div> : null}

          {result ? (
            <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-panel ring-1 ring-white backdrop-blur">
              <div className="border-b border-brand-100 bg-[linear-gradient(135deg,_rgba(13,148,136,0.14),_rgba(59,130,246,0.05),_rgba(255,255,255,0.96))] p-5">
                <div className="mb-4 flex items-center gap-2 text-brand-700">
                  <CheckCircle2 aria-hidden className="h-5 w-5" />
                  <h2 className="font-semibold">{t.resultFound}</h2>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.name}</p>
                    <p className="mt-2 break-words text-lg font-bold text-ink">{result.nom || t.missing}</p>
                    <p className="mt-1 text-sm text-slate-500">{result.adresse || t.missing}</p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-right shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.rc}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-ink">{result.rc || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-slate-50/90 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.status}</p>
                    <p className="mt-1 font-semibold text-ink">{result.statut || t.missing}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-slate-50/90 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.cache}</p>
                    <p className="mt-1 font-semibold text-ink">{result.cache?.hit ? t.saved : t.live}</p>
                  </div>
                </div>

                <dl className="space-y-4 text-sm" dir={isArabic ? "rtl" : "ltr"}>
                  {showPrenomColumn ? <DetailValue label={t.firstName} value={result.prenom} missing={t.missing} /> : null}
                  <DetailValue label={t.details} value={
                    hasDetails
                      ? t.detailsLoaded
                      : result.detailUnavailableReason
                        ? t.detailsUnavailable
                        : result.cache?.detailsAvailable
                          ? t.detailsCached
                          : t.detailsClick
                  } missing={t.missing} />
                </dl>

                {canLoadDetails && !hasDetails ? (
                  <button
                    type="button"
                    onClick={loadDetails}
                    disabled={detailsLoading}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,_#172033,_#0f172a)] px-4 text-sm font-semibold text-white shadow-soft hover:brightness-110 disabled:bg-slate-300"
                  >
                    {detailsLoading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
                    {t.showDetails}
                  </button>
                ) : null}

                {result && (!annexesChecked || annexes.length > 0) ? (
                  <button
                    type="button"
                    onClick={loadAnnexes}
                    disabled={annexesLoading}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent-100 bg-accent-50/60 px-4 text-sm font-semibold text-accent-600 hover:bg-accent-50 disabled:bg-slate-100"
                  >
                    {annexesLoading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
                    {t.showAnnexes}
                  </button>
                ) : null}

                {searchType === "morale" && result && (!comptesSociauxChecked || comptesSociaux.length > 0) ? (
                  <button
                    type="button"
                    onClick={loadComptesSociaux}
                    disabled={comptesSociauxLoading}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold-100 bg-gold-50/70 px-4 text-sm font-semibold text-gold-600 hover:bg-gold-50 disabled:bg-slate-100"
                  >
                    {comptesSociauxLoading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
                    {t.showAccounts}
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-line bg-white/80 p-5 shadow-soft">
              <p className="text-sm text-slate-600" dir={isArabic ? "rtl" : "ltr"}>{t.emptyResult}</p>
            </section>
          )}
        </aside>
      </div>

      {results.length > 1 ? (
        <section className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-white">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-ink">{t.searchResults}</h3>
            <p className="text-sm text-slate-500">{results.length} {t.companiesFound}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-[linear-gradient(180deg,_#f8fafc,_#eef4f8)] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t.rc}</th>
                  <th className="px-3 py-2">{t.nameHeader}</th>
                  {showPrenomColumn ? <th className="px-3 py-2">{t.firstName}</th> : null}
                  <th className="px-3 py-2">{t.address}</th>
                  <th className="px-3 py-2">{t.status}</th>
                  <th className="px-3 py-2">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((company, index) => {
                  const selected = result?.idCommercant
                    ? result.idCommercant === company.idCommercant
                    : result?.rc === company.rc && result?.nom === company.nom;

                  return (
                    <tr key={`${company.idCommercant ?? company.rc}-${index}`} className={selected ? "bg-brand-50/70" : "bg-white hover:bg-slate-50/80"}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{company.rc || "-"}</td>
                      <td className="min-w-48 px-3 py-2 text-slate-700">{company.nom || "-"}</td>
                      {showPrenomColumn ? <td className="px-3 py-2 text-slate-700">{company.prenom || "-"}</td> : null}
                      <td className="min-w-72 px-3 py-2 text-slate-700">{company.adresse || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{company.statut || "-"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => selectResult(company)}
                          className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold ${
                            selected ? "rounded-xl bg-brand-600 text-white shadow-sm" : "rounded-xl border border-line bg-white text-ink hover:bg-slate-50"
                          }`}
                        >
                          {selected ? t.selected : t.select}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {comptesSociaux.length ? (
        <section className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-white">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-ink">{t.accounts}</h3>
            <p className="text-sm text-slate-500">{comptesSociaux.length} {t.years}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-[linear-gradient(180deg,_#f8fafc,_#eef4f8)] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Exercice</th>
                  <th className="px-3 py-2">{t.depositDate}</th>
                  <th className="px-3 py-2">{t.status}</th>
                  <th className="px-3 py-2">{t.otherFields}</th>
                  <th className="px-3 py-2">{t.detail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {comptesSociaux.map((compte, index) => (
                  <tr key={`${compte.exercice || "cs"}-${index}`} className="bg-white hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{compte.exercice || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{compte.dateDepot || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{compte.statut || "-"}</td>
                    <td className="min-w-72 px-3 py-2 text-xs text-slate-500">
                      {Object.entries(compte.raw)
                        .filter(([key, value]) => value && !["exercice", "dateDepot", "statut"].includes(key))
                        .slice(0, 4)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" | ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => loadCompteSocialDetails(compte)}
                        disabled={!compte.exercice || compteSocialDetailsLoading === compte.exercice}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300"
                      >
                        {compteSocialDetailsLoading === compte.exercice ? "..." : t.detail}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {annexes.length ? (
        <section className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-white">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-ink">{t.annexes}</h3>
            <p className="text-sm text-slate-500">{annexes.length} secondaire(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-[linear-gradient(180deg,_#f8fafc,_#eef4f8)] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">N RC</th>
                  <th className="px-3 py-2">Wilaya</th>
                  <th className="px-3 py-2">{t.address}</th>
                  <th className="px-3 py-2">{t.status}</th>
                  <th className="px-3 py-2">{t.detail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {annexes.map((annex) => (
                  <tr key={annex.idCommercant} className="bg-white hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{annex.rc}</td>
                    <td className="px-3 py-2 text-slate-700">{annex.wilaya || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{annex.adresse || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{annex.statut || "-"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => loadAnnexDetails(annex)}
                        disabled={annexDetailsLoading === annex.idCommercant}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300"
                      >
                        {annexDetailsLoading === annex.idCommercant ? "..." : t.detail}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {hasDetails && result?.details ? (
        <SidjilcomDetailsView
          details={result.details}
          onSearchAssociate={searchByAssociate}
          onSearchActivity={searchByActivity}
          associateActionLabel={t.showCompaniesForManager}
          activityActionLabel={t.showCompaniesForActivity}
        />
      ) : null}
    </div>
  );
}


