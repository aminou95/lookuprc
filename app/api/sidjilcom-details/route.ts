import { NextResponse } from "next/server";
import { checkRateLimit, getCachedCompany, publicIp, upsertCompanyDetails } from "@/lib/cnrc-cache";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { appendSearchEvent, getGoogleCachedCompany, getGoogleCachedCompanyByRc } from "@/lib/google-sheets";
import { lookupSidjilcomCompany, lookupSidjilcomDetailsById } from "@/lib/sidjilcom";
import type { CompanyResult, SidjilcomDetails, SidjilcomSearchPayload } from "@/lib/types";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function inferIdCommercant(payload: SidjilcomSearchPayload, rc: string) {
  const normalized = rc.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (/^\d{2}(A|B|D|S|W1|W2)\d{7}\d{2}\d{2}$/.test(normalized)) return normalized;
  if (payload.nrc1 && payload.nrc2 && payload.nrc3 && payload.nrc4 && payload.nrc5) {
    return `${payload.nrc1}${payload.nrc2}${payload.nrc3}${payload.nrc4}${payload.nrc5}`.toUpperCase();
  }
  return normalized;
}

function payloadFromExactRc(
  payload: SidjilcomSearchPayload,
  rcOrId: string
): SidjilcomSearchPayload | null {
  const normalized = rcOrId.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const match = normalized.match(/^(\d{2})(W1|W2|A|B|D|S)(\d{7})(\d{2})(\d{2})$/i);

  if (!match) {
    return null;
  }

  return {
    ...payload,
    searchType: "morale",
    lookupMode: "rc",
    nrc1: match[1],
    nrc2: match[2].toUpperCase() as SidjilcomSearchPayload["nrc2"],
    nrc3: match[3],
    nrc4: match[4],
    nrc5: match[5]
  };
}

function normalizeMoraleDetailId(
  payload: SidjilcomSearchPayload,
  idCommercant: string,
  selectedRc: string,
  selectedCompany?: Pick<CompanyResult, "rc" | "nom" | "prenom" | "adresse" | "statut"> | null
) {
  if ((payload.searchType ?? "cnrc") !== "morale") return idCommercant;

  const normalizedId = idCommercant.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const normalizedRc = (selectedRc || selectedCompany?.rc || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

  if (/^\d{2}(A|B|D|S|W1|W2)\d{7}\d{2}\d{2}$/.test(normalizedId)) {
    return normalizedId;
  }

  if (normalizedRc && normalizedId.startsWith(normalizedRc) && normalizedId.length === normalizedRc.length + 2) {
    return `${normalizedRc}00${normalizedId.slice(-2)}`;
  }

  if (normalizedRc && payload.nrc4 && payload.nrc5) {
    return `${normalizedRc}${payload.nrc4}${payload.nrc5}`;
  }

  return normalizedId;
}

function buildFallbackDetails(company: Pick<CompanyResult, "rc" | "nom" | "prenom" | "adresse" | "statut">): SidjilcomDetails {
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

function isSummaryOnlyDetails(details?: SidjilcomDetails | null) {
  if (!details) return false;

  const source = String(details.rawFields?.Source ?? details.rawFields?.source ?? "")
    .trim()
    .toLowerCase();

  return source === "resume sidjilcom";
}

function hasMeaningfulDetails(details?: SidjilcomDetails | null) {
  if (!details) return false;

  if (isSummaryOnlyDetails(details)) {
    return false;
  }

  const meaningfulRawField = Object.entries(details.rawFields ?? {}).some(([key, value]) => {
    if (!value) return false;
    return !["source", "rc", "statut"].includes(key.trim().toLowerCase());
  });

  return Boolean(
    details.merchant.nom ||
      details.merchant.prenom ||
      details.merchant.adresse ||
      details.merchant.nif ||
      details.merchant.nis ||
      details.commercant.nomFr ||
      details.commercant.nomAr ||
      details.localCommercial.nomCommercial ||
      details.associates.length ||
      details.activities.length ||
      details.activitesExercees.length ||
      meaningfulRawField
  );
}

export async function POST(request: Request) {
  let payload: SidjilcomSearchPayload;
  let idCommercant = "";
  let selectedRc = "";
  let selectedCompany: Pick<CompanyResult, "rc" | "nom" | "prenom" | "adresse" | "statut"> | null = null;

  try {
    const body = (await request.json()) as SidjilcomSearchPayload & {
      payload?: SidjilcomSearchPayload;
      idCommercant?: string;
      rc?: string;
      company?: Pick<CompanyResult, "rc" | "nom" | "prenom" | "adresse" | "statut">;
    };
    payload = body.payload ?? body;
    idCommercant = body.idCommercant ?? "";
    selectedRc = body.rc ?? "";
    selectedCompany = body.company ?? null;
  } catch {
    return jsonError("Payload JSON invalide.", 400, "VALIDATION");
  }

  const searchType = payload.searchType ?? "cnrc";
  const validationErrors = validateSidjilcomSearchPayload(payload);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json({ error: "Champs de recherche invalides.", code: "VALIDATION", fields: validationErrors }, { status: 400 });
  }

  if (searchType === "cnrc") {
    const cached = await getCachedCompany(payload);
    if (cached?.cache.detailsAvailable && !isSummaryOnlyDetails(cached.details) && hasMeaningfulDetails(cached.details)) {
      return NextResponse.json(cached);
    }
  }

  const googleCached = await getGoogleCachedCompany(payload);
  if (
    googleCached?.details &&
    googleCached.cache?.detailsAvailable &&
    !isSummaryOnlyDetails(googleCached.details) &&
    hasMeaningfulDetails(googleCached.details)
  ) {
    return NextResponse.json({
      ...googleCached,
      cache: {
        hit: true,
        detailsAvailable: true,
        checkedAt: googleCached.cache?.checkedAt ?? new Date().toISOString()
      }
    });
  }

  const googleCachedByRc = await getGoogleCachedCompanyByRc(selectedRc || idCommercant);
  if (
    googleCachedByRc?.details &&
    googleCachedByRc.cache?.detailsAvailable &&
    !isSummaryOnlyDetails(googleCachedByRc.details) &&
    hasMeaningfulDetails(googleCachedByRc.details)
  ) {
    return NextResponse.json({
      ...googleCachedByRc,
      cache: {
        hit: true,
        detailsAvailable: true,
        checkedAt: googleCachedByRc.cache?.checkedAt ?? new Date().toISOString()
      }
    });
  }

  if (!checkRateLimit(`details:${publicIp(request)}`, 3, 60_000)) {
    return jsonError("Trop de demandes de details. Veuillez patienter une minute.", 429, "RATE_LIMIT");
  }

  idCommercant = normalizeMoraleDetailId(
    payload,
    idCommercant || inferIdCommercant(payload, selectedRc),
    selectedRc,
    selectedCompany
  );

  if (idCommercant) {
    let detailLookup = await lookupSidjilcomDetailsById(payload, idCommercant);

    if (searchType === "morale" && detailLookup.ok && detailLookup.detailUnavailableReason) {
      const retryPayload = payloadFromExactRc(payload, idCommercant || selectedRc || selectedCompany?.rc || "");

      if (retryPayload) {
        await lookupSidjilcomCompany(retryPayload, { includeDetails: false });
        const retriedLookup = await lookupSidjilcomDetailsById(retryPayload, idCommercant);
        if (retriedLookup.ok && !retriedLookup.detailUnavailableReason) {
          detailLookup = retriedLookup;
        }
      }
    }

    if (!detailLookup.ok) {
      return jsonError(detailLookup.error, detailLookup.status, "NETWORK");
    }

    const fallbackSummary = {
      rc: selectedCompany?.rc || selectedRc || idCommercant,
      nom: selectedCompany?.nom || detailLookup.details.merchant.nom,
      prenom: selectedCompany?.prenom || detailLookup.details.merchant.prenom,
      adresse: selectedCompany?.adresse || detailLookup.details.merchant.adresse,
      statut: selectedCompany?.statut || ""
    };
    const details =
      searchType === "morale" && detailLookup.detailUnavailableReason
        ? buildFallbackDetails(fallbackSummary)
        : detailLookup.details;

    const responseBody = {
      rc: selectedCompany?.rc || details.merchant.rc || idCommercant,
      nom: details.merchant.nom || selectedCompany?.nom || "",
      prenom: details.merchant.prenom || selectedCompany?.prenom || "",
      adresse: details.merchant.adresse || selectedCompany?.adresse || "",
      statut: selectedCompany?.statut || "",
      idCommercant,
      detailUnavailableReason: searchType === "morale" ? undefined : detailLookup.detailUnavailableReason,
      details,
      cache: {
        hit: false,
        detailsAvailable: !isSummaryOnlyDetails(details) && Boolean(detailLookup.details && !detailLookup.detailUnavailableReason),
        checkedAt: new Date().toISOString()
      }
    };

    await appendSearchEvent({
      event: "details_by_id",
      payload,
      company: responseBody,
      resultCount: 1,
      metadata: { detailUnavailableReason: detailLookup.detailUnavailableReason, rawFields: details.rawFields }
    });

    return NextResponse.json(responseBody);
  }

  const lookup = await lookupSidjilcomCompany(payload, { includeDetails: true });
  if (!lookup.ok) {
    return jsonError(lookup.error, lookup.status, lookup.code);
  }

  if (searchType === "cnrc" && lookup.company.details) {
    await upsertCompanyDetails(payload, lookup.company, lookup.company.details);
  }

  await appendSearchEvent({
    event: "details",
    payload,
    company: lookup.company,
    resultCount: lookup.results.length,
    metadata: { detailUnavailableReason: lookup.company.detailUnavailableReason, rawFields: lookup.company.details?.rawFields }
  });

  return NextResponse.json({
    ...lookup.company,
    cache: {
      hit: false,
      detailsAvailable: Boolean(lookup.company.details && !lookup.company.detailUnavailableReason),
      checkedAt: new Date().toISOString()
    }
  });
}
