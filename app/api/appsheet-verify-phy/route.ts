import { NextResponse } from "next/server";
import { fetchAppSheetRows } from "@/lib/appsheet";
import {
  categoryFromCnrc,
  cnrcPayloadFromRow,
  formatOfficialCnrc,
  getClientName,
  getClientType,
  getMoralClientName,
  getRawNif,
  getRawNis,
  getRawRc,
  isMoralClient,
  namesLookSimilar,
  splitPersonName
} from "@/lib/rc-parser";
import { lookupSidjilcomCompany } from "@/lib/sidjilcom";
import type { CompanyResult, SidjilcomSearchPayload } from "@/lib/types";

const maxDefaultRows = 50;

function normalizeId(value: string) {
  return value.replace(/\D/g, "");
}

function buildNamePayload(row: Record<string, unknown>, category: "physique" | "morale"): SidjilcomSearchPayload | null {
  if (category === "morale") {
    const raisonSociale = getMoralClientName(row);
    if (!raisonSociale) return null;
    return {
      nrc1: "",
      nrc2: "B",
      nrc3: "",
      nrc4: "",
      nrc5: "16",
      searchType: "morale",
      lookupMode: "name",
      language: /[\u0600-\u06FF]/.test(raisonSociale) ? "ar" : "fr",
      nomCommercial: raisonSociale
    };
  }

  const appName = getClientName(row);
  const split = splitPersonName(appName);
  if (!split.nom || !split.prenom) return null;
  return {
    nrc1: "",
    nrc2: "A",
    nrc3: "",
    nrc4: "",
    nrc5: "16",
    searchType: "physique",
    lookupMode: "name",
    language: /[\u0600-\u06FF]/.test(appName) ? "ar" : "fr",
    nom: split.nom,
    prenom: split.prenom
  };
}

function officialIds(company: CompanyResult) {
  const details = company.details;
  return {
    nif: normalizeId(details?.merchant.nif || details?.commercant.nif || details?.rawFields?.NIF || ""),
    nis: normalizeId(details?.merchant.nis || details?.commercant.nis || details?.rawFields?.NIS || "")
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || maxDefaultRows), 200);

  try {
    const rows = await fetchAppSheetRows();
    const selectedRows = rows.slice(0, limit);
    const results = [];

    for (const row of selectedRows) {
      const rawRc = getRawRc(row);
      const appNif = normalizeId(getRawNif(row));
      const appNis = normalizeId(getRawNis(row));
      const cnrc = cnrcPayloadFromRow(row);
      const categoryByRc = categoryFromCnrc(cnrc, row);
      const category = categoryByRc === "unknown" ? (isMoralClient(row) ? "morale" : "physique") : categoryByRc;
      const appType = getClientType(row);
      const appName = category === "morale" ? getMoralClientName(row) : getClientName(row);

      const payload: SidjilcomSearchPayload | null = cnrc
        ? {
            ...cnrc,
            searchType: category,
            lookupMode: "rc",
            language: /[\u0600-\u06FF]/.test(appName) ? "ar" : "fr"
          }
        : buildNamePayload(row, category);

      if (!payload) {
        results.push({
          status: "missing_identity",
          category,
          appType,
          appName,
          rawRc,
          appNif,
          appNis,
          row
        });
        continue;
      }

      const lookup = await lookupSidjilcomCompany(payload, { includeDetails: Boolean(appNif || appNis) });

      if (!lookup.ok) {
        results.push({
          status: "lookup_failed",
          category,
          appType,
          appName,
          rawRc,
          appNif,
          appNis,
          cnrc,
          officialCnrc: cnrc ? formatOfficialCnrc(cnrc) : "",
          error: lookup.error,
          code: lookup.code,
          row
        });
        continue;
      }

      const officialName =
        category === "morale"
          ? lookup.company.nom
          : [lookup.company.nom, lookup.company.prenom].filter(Boolean).join(" ");
      const ids = officialIds(lookup.company);
      const rcRoot = cnrc ? `${cnrc.nrc1}${cnrc.nrc2}${cnrc.nrc3}`.toUpperCase() : "";
      const checks = {
        rcMatches: rcRoot ? lookup.company.rc.toUpperCase().includes(rcRoot) : false,
        nifMatches: Boolean(appNif && ids.nif && appNif === ids.nif),
        nisMatches: Boolean(appNis && ids.nis && appNis === ids.nis),
        nameMatches: namesLookSimilar(appName, officialName)
      };
      const hasStrongId = checks.rcMatches || checks.nifMatches || checks.nisMatches;

      results.push({
        status: hasStrongId && checks.nameMatches ? "match" : hasStrongId ? "partial_match" : "mismatch",
        category,
        appType,
        appName,
        rawRc,
        appNif,
        appNis,
        officialNif: ids.nif,
        officialNis: ids.nis,
        appRc: cnrc,
        officialCnrc: cnrc ? formatOfficialCnrc(cnrc) : "",
        official: lookup.company,
        resultCount: lookup.results.length,
        checks,
        row
      });
    }

    return NextResponse.json({
      totalRows: rows.length,
      checkedRows: selectedRows.length,
      results
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur pendant la verification AppSheet."
      },
      { status: 500 }
    );
  }
}
