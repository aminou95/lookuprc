import { NextResponse } from "next/server";
import { checkRateLimit, getCachedCompany, publicIp, upsertCompanySummary } from "@/lib/cnrc-cache";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { appendSearchEvent, getGoogleCachedCompaniesByName, getGoogleCachedCompany } from "@/lib/google-sheets";
import { lookupSidjilcomCompany } from "@/lib/sidjilcom";
import type { SidjilcomSearchPayload } from "@/lib/types";

type SidjilcomErrorCode = "CONFIGURATION" | "COOKIE_EXPIRED" | "NO_RESULT" | "NETWORK" | "VALIDATION";

function jsonError(message: string, status: number, code: SidjilcomErrorCode) {
  return NextResponse.json({ error: message, code }, { status });
}

function repairText(value: string) {
  const shouldRepair = [...value].some((char) => [194, 195, 216, 217].includes(char.charCodeAt(0)));
  if (!shouldRepair) return value;

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    return /[\u0600-\u06ff]/.test(repaired) ? repaired : value;
  } catch {
    return value;
  }
}

function isTemporarySidjilcomFailure(status: number, code?: string) {
  return code === "NETWORK" && [502, 503, 504].includes(status);
}

function repairCompany<T extends { nom?: string; prenom?: string; adresse?: string; statut?: string }>(company: T): T {
  return {
    ...company,
    nom: repairText(company.nom ?? ""),
    prenom: repairText(company.prenom ?? ""),
    adresse: repairText(company.adresse ?? ""),
    statut: repairText(company.statut ?? "")
  };
}

export async function POST(request: Request) {
  let payload: SidjilcomSearchPayload;

  try {
    payload = (await request.json()) as SidjilcomSearchPayload;
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
    if (cached) {
      const summary = { ...cached };
      delete summary.details;
      const repaired = repairCompany(summary);
      await appendSearchEvent({
        event: "lookup_cache_hit",
        payload,
        company: repaired,
        resultCount: 1,
        metadata: { cache: true }
      });
      return NextResponse.json({ ...repaired, results: [repaired] });
    }
  }

  if ((payload.lookupMode ?? "rc") === "rc") {
    const googleCached = await getGoogleCachedCompany(payload);
    if (googleCached) {
      const summary = { ...googleCached };
      delete summary.details;
      const repaired = repairCompany(summary);
      await appendSearchEvent({
        event: "lookup_google_cache_hit",
        payload,
        company: repaired,
        resultCount: 1,
        metadata: { cache: true, source: "google_sheets" }
      });
      return NextResponse.json({ ...repaired, results: [repaired] });
    }
  }

  if (!checkRateLimit(`summary:${publicIp(request)}`, 10, 60_000)) {
    return jsonError("Trop de recherches. Veuillez patienter une minute.", 429, "NETWORK");
  }

  const lookup = await lookupSidjilcomCompany(payload, { includeDetails: false });
  if (!lookup.ok) {
    if (isTemporarySidjilcomFailure(lookup.status, lookup.code)) {
      const cachedResults = (await getGoogleCachedCompaniesByName(payload)).map(repairCompany);
      const cachedCompany = cachedResults[0];

      if (cachedCompany) {
        await appendSearchEvent({
          event: "lookup_google_cache_fallback",
          payload,
          company: cachedCompany,
          resultCount: cachedResults.length,
          metadata: { cache: true, source: "google_sheets", upstreamStatus: lookup.status, upstreamError: lookup.error }
        });

        return NextResponse.json({
          ...cachedCompany,
          results: cachedResults,
          cache: {
            hit: true,
            detailsAvailable: Boolean(cachedCompany.details),
            checkedAt: cachedCompany.cache?.checkedAt ?? new Date().toISOString(),
            source: "google_sheets_fallback"
          },
          warning: "Sidjilcom est temporairement indisponible. Resultat charge depuis le cache."
        });
      }
    }

    return jsonError(lookup.error, lookup.status, lookup.code as SidjilcomErrorCode);
  }

  const company = repairCompany(lookup.company);
  const results = lookup.results.map(repairCompany);

  if (searchType === "cnrc") {
    await upsertCompanySummary(payload, company);
  }

  await appendSearchEvent({
    event: "lookup",
    payload,
    company,
    resultCount: results.length,
    metadata: { results }
  });

  return NextResponse.json({
    ...company,
    results,
    cache: {
      hit: false,
      detailsAvailable: false,
      checkedAt: new Date().toISOString()
    }
  });
}
