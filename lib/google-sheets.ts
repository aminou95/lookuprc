import crypto from "crypto";
import { serverEnv } from "@/lib/env";
import type { CnrcPayload, CompanyResult, SidjilcomAnnex, SidjilcomDetails, SidjilcomSearchPayload } from "@/lib/types";

const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const tokenUrl = "https://oauth2.googleapis.com/token";

const searchHeaders = [
  "created_at",
  "event",
  "search_type",
  "lookup_mode",
  "language",
  "nrc1",
  "nrc2",
  "nrc3",
  "nrc4",
  "nrc5",
  "search_nom",
  "search_prenom",
  "search_raison_sociale",
  "rc",
  "nom",
  "prenom",
  "adresse",
  "statut",
  "id_commercant",
  "result_count",
  "metadata_json"
];

const companyHeaders = [
  "updated_at",
  "cnrc_key",
  "search_type",
  "language",
  "rc",
  "nom_fr",
  "prenom_fr",
  "nom_ar",
  "prenom_ar",
  "adresse",
  "statut",
  "id_commercant",
  "has_secondaires",
  "details_available",
  "nrc1",
  "nrc2",
  "nrc3",
  "nrc4",
  "nrc5",
  "details_json"
];

const detailsHeaders = [
  "updated_at",
  "rc",
  "date_immatriculation",
  "numero_inscription",
  "date_modification",
  "nom_fr",
  "prenom_fr",
  "nom_ar",
  "prenom_ar",
  "date_naissance",
  "lieu_naissance",
  "nis",
  "nif",
  "etat_civil",
  "nationalite",
  "regime_matrimonial",
  "type_commerce",
  "adresse",
  "commune",
  "code_postal",
  "nom_commercial",
  "date_debut_exploitation",
  "telephone",
  "fax",
  "email",
  "appartenance_local",
  "nature_acquisition_local",
  "proprietaire_local",
  "fonds_numero_rc",
  "fonds_proprietaire",
  "fonds_adresse",
  "raw_json"
];
const activityHeaders = ["updated_at", "rc", "activity_count", "activities_text", "activities_json"];
const annexHeaders = ["updated_at", "parent_rc", "annex_count", "annexes_text", "annexes_json"];
const comptesHeaders = ["updated_at", "rc", "compte_count", "exercices", "comptes_json"];

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
const ensuredSheets = new Set<string>();

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function getConfig() {
  const spreadsheetId = serverEnv("GOOGLE_SHEETS_SPREADSHEET_ID").trim();
  const clientEmail = serverEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL").trim();
  const privateKey = serverEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n").trim();
  const searchSheetName = serverEnv("GOOGLE_SHEETS_SHEET_NAME").trim() || "Recherches";

  if (!spreadsheetId || !clientEmail || !privateKey) return null;
  return {
    spreadsheetId,
    clientEmail,
    privateKey,
    searchSheetName,
    companiesSheetName: serverEnv("GOOGLE_SHEETS_COMPANIES_SHEET_NAME").trim() || "Entreprises",
    detailsSheetName: serverEnv("GOOGLE_SHEETS_DETAILS_SHEET_NAME").trim() || "Details",
    activitiesSheetName: serverEnv("GOOGLE_SHEETS_ACTIVITIES_SHEET_NAME").trim() || "Activites",
    annexesSheetName: serverEnv("GOOGLE_SHEETS_ANNEXES_SHEET_NAME").trim() || "Secondaires",
    comptesSheetName: serverEnv("GOOGLE_SHEETS_COMPTES_SHEET_NAME").trim() || "ComptesSociaux"
  };
}

export function isGoogleSheetsConfigured() {
  return Boolean(getConfig());
}

function quotedRange(sheetName: string, range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}

function columnName(index: number) {
  let name = "";
  let current = index;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    current = Math.floor((current - modulo) / 26);
  }
  return name;
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function repairMojibake(value: string) {
  const shouldRepair = [...value].some((char) => [194, 195, 216, 217].includes(char.charCodeAt(0)));
  if (!shouldRepair) return value;

  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function cleanSheetText(value: string | undefined) {
  return repairMojibake(value ?? "").replace(/\s+/g, " ").trim();
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hasMeaningfulDetails(details: SidjilcomDetails | undefined) {
  if (!details) return false;
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

function cnrcKeyFromPayload(payload: Partial<CnrcPayload>) {
  return `${payload.nrc1 ?? ""}${payload.nrc2 ?? ""}${payload.nrc3 ?? ""}${payload.nrc4 ?? ""}${payload.nrc5 ?? ""}`.toUpperCase();
}

function derivePayloadFromRc(rc: string): Partial<CnrcPayload> {
  const match = rc.match(/^(\d{2})(A|B|D|S|W1|W2)(\d{6,7})(\d{2})(\d{2})?$/i);
  if (!match) return {};
  return {
    nrc1: match[1],
    nrc2: match[2].toUpperCase() as CnrcPayload["nrc2"],
    nrc3: match[3],
    nrc4: match[4],
    nrc5: match[5] ?? ""
  };
}

function inferIdFromRow(row: string[]) {
  const existing = (row[11] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const rc = (row[4] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const nrc4 = row[17] || "";
  const nrc5 = row[18] || "";
  const rootPattern = /^\d{2}(A|B|D|S|W1|W2)\d{6,7}$/i;
  const fullPattern = /^\d{2}(A|B|D|S|W1|W2)\d{6,7}\d{4}$/i;

  if (existing && fullPattern.test(existing)) return existing;
  if (rc && fullPattern.test(rc)) return rc;
  if (rc && rootPattern.test(rc) && nrc4 && nrc5) return `${rc}${nrc4}${nrc5}`;
  return rc || existing || undefined;
}

async function getAccessToken() {
  const config = getConfig();
  if (!config) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const jwtPayload = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: sheetsScope,
      aud: tokenUrl,
      exp: now + 3600,
      iat: now
    })
  );
  const unsignedToken = `${jwtHeader}.${jwtPayload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedToken).sign(config.privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    console.log("GOOGLE SHEETS TOKEN FAILED:", response.status, text.slice(0, 500));
    return null;
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000
  };

  return cachedToken.accessToken;
}

async function sheetsRequest(path: string, init: RequestInit = {}) {
  const config = getConfig();
  const accessToken = await getAccessToken();
  if (!config || !accessToken) return null;

  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
}

async function getSpreadsheetSheetNames() {
  const response = await sheetsRequest("?fields=sheets.properties.title");
  if (!response?.ok) return [];
  const data = (await response.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean) as string[];
}

async function ensureSheet(sheetName: string, headers: string[]) {
  const config = getConfig();
  if (!config || ensuredSheets.has(sheetName)) return;

  const sheetNames = await getSpreadsheetSheetNames();
  if (!sheetNames.includes(sheetName)) {
    await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      })
    });
  }

  const headerRange = quotedRange(sheetName, `A1:${columnName(headers.length)}1`);
  const readResponse = await sheetsRequest(`/values/${encodeURIComponent(headerRange)}`);
  const data = readResponse?.ok ? ((await readResponse.json()) as { values?: string[][] }) : {};

  const existingHeaders = data.values?.[0] ?? [];
  const sameHeaders = headers.every((header, index) => existingHeaders[index] === header);
  if (existingHeaders.length && !sameHeaders) {
    await sheetsRequest(`/values/${encodeURIComponent(quotedRange(sheetName, "A:AZ"))}:clear`, {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  if (!existingHeaders.length || !sameHeaders) {
    await sheetsRequest(`/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [headers] })
    });
  }

  ensuredSheets.add(sheetName);
}

async function appendRows(sheetName: string, headers: string[], rows: unknown[][]) {
  const config = getConfig();
  if (!config || rows.length === 0) return;

  await ensureSheet(sheetName, headers);
  const response = await sheetsRequest(
    `/values/${encodeURIComponent(quotedRange(sheetName, `A:${columnName(headers.length)}`))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: rows })
    }
  );

  if (!response?.ok) {
    const text = response ? await response.text() : "No response";
    console.log("GOOGLE SHEETS APPEND FAILED:", sheetName, response?.status, text.slice(0, 500));
  }
}

async function upsertRow(sheetName: string, headers: string[], keyColumnIndex: number, key: string, row: unknown[]) {
  const config = getConfig();
  if (!config || !key) return;

  await ensureSheet(sheetName, headers);
  const readResponse = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(sheetName, `A2:${columnName(headers.length)}`))}`);
  const data = readResponse?.ok ? ((await readResponse.json()) as { values?: string[][] }) : {};
  const rowIndex = (data.values ?? []).findIndex((existingRow) => existingRow[keyColumnIndex] === key);

  if (rowIndex >= 0) {
    const sheetRowNumber = rowIndex + 2;
    const previousRow = data.values?.[rowIndex] ?? [];
    const mergedRow = row.map((value, index) => {
      if (index === 0) return value;
      return value === "" || value === undefined || value === null ? previousRow[index] ?? "" : value;
    });
    await sheetsRequest(
      `/values/${encodeURIComponent(quotedRange(sheetName, `A${sheetRowNumber}:${columnName(headers.length)}${sheetRowNumber}`))}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [mergedRow] })
      }
    );
    return;
  }

  await appendRows(sheetName, headers, [row]);
}

function companyRow(payload: SidjilcomSearchPayload, company: Partial<CompanyResult>) {
  const details = company.details;
  const merchant = details?.merchant;
  const rc = company.rc || merchant?.rc || "";
  const derivedPayload = derivePayloadFromRc(rc);

  return [
    new Date().toISOString(),
    cnrcKeyFromPayload({
      nrc1: payload.nrc1 || derivedPayload.nrc1 || "",
      nrc2: payload.nrc2 || derivedPayload.nrc2 || "A",
      nrc3: payload.nrc3 || derivedPayload.nrc3 || "",
      nrc4: payload.nrc4 || derivedPayload.nrc4 || "",
      nrc5: payload.nrc5 || derivedPayload.nrc5 || ""
    }),
    payload.searchType ?? "cnrc",
    payload.language ?? "fr",
    rc,
    merchant?.nom || company.nom || "",
    merchant?.prenom || company.prenom || "",
    merchant?.nomAr || "",
    merchant?.prenomAr || "",
    merchant?.adresse || company.adresse || "",
    company.statut ?? "",
    company.idCommercant ?? "",
    company.hasSecondaires === undefined ? "" : String(Boolean(company.hasSecondaires)),
    String(Boolean(details)),
    payload.nrc1 || derivedPayload.nrc1 || "",
    payload.nrc2 || derivedPayload.nrc2 || "",
    payload.nrc3 || derivedPayload.nrc3 || "",
    payload.nrc4 || derivedPayload.nrc4 || "",
    payload.nrc5 || derivedPayload.nrc5 || "",
    compactJson(details)
  ];
}

function detailRow(rc: string, details: SidjilcomDetails) {
  return [
    new Date().toISOString(),
    rc,
    details.inscription.dateImmatriculation,
    details.inscription.numeroInscription,
    details.inscription.dateModification,
    details.commercant.nomFr || details.merchant.nom,
    details.commercant.prenomFr || details.merchant.prenom,
    details.commercant.nomAr || details.merchant.nomAr,
    details.commercant.prenomAr || details.merchant.prenomAr,
    details.commercant.dateNaissance || details.merchant.dateNaissance,
    details.commercant.lieuNaissance || details.merchant.lieuNaissance,
    details.commercant.nis || details.merchant.nis,
    details.commercant.nif || details.merchant.nif,
    details.commercant.etatCivil || details.merchant.etatCivil,
    details.commercant.nationalite || details.merchant.nationalite,
    details.commercant.regimeMatrimonial || details.merchant.regimeMatrimonial,
    details.localCommercial.typeCommerce || details.merchant.typeCommerce,
    details.localCommercial.adresse || details.merchant.adresse,
    details.localCommercial.communeWilayaInscription || details.merchant.commune,
    details.localCommercial.codePostal,
    details.localCommercial.nomCommercial,
    details.localCommercial.dateDebutExploitation || details.merchant.dateDebutExploitation,
    details.localCommercial.telephone || details.merchant.telephone,
    details.localCommercial.fax,
    details.localCommercial.email,
    details.localCommercial.appartenanceLocal,
    details.localCommercial.natureAcquisitionLocal,
    details.localCommercial.proprietaireLocal,
    details.fondsCommerce.numeroRc,
    details.fondsCommerce.proprietaireFonds,
    details.fondsCommerce.adresseFonds,
    compactJson(details.rawFields)
  ];
}

function normalizeActivities(details?: SidjilcomDetails) {
  if (!details) return [];
  const activities = [
    ...details.activities.map((activity) => ({
      code: activity.code,
      libelle: activity.libelle,
      numeroAgrement: ""
    })),
    ...(details.activitesExercees ?? []).map((activity) => {
      const values = Object.values(activity).map((value) => String(value ?? "")).filter(Boolean);
      return {
        code: values[0] ?? "",
        libelle: values.slice(1).join(" | "),
        numeroAgrement: String(activity["N agrement"] ?? activity["N° agrément"] ?? "")
      };
    })
  ];

  const seen = new Set<string>();
  return activities.filter((activity) => {
    const key = `${activity.code}|${activity.libelle}`;
    if ((!activity.code && !activity.libelle) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function activitiesRow(rc: string, details?: SidjilcomDetails) {
  const activities = normalizeActivities(details);
  return [
    new Date().toISOString(),
    rc,
    String(activities.length),
    activities.map((activity) => [activity.code, activity.libelle].filter(Boolean).join(" - ")).join("\n"),
    compactJson(activities)
  ];
}

export async function appendSearchEvent({
  event,
  payload,
  company,
  resultCount,
  metadata
}: {
  event: string;
  payload: SidjilcomSearchPayload;
  company?: Partial<CompanyResult> | null;
  resultCount?: number;
  metadata?: unknown;
}) {
  const config = getConfig();
  if (!config) return;

  try {
    const searchRow = [
      new Date().toISOString(),
      event,
      payload.searchType ?? "cnrc",
      payload.lookupMode ?? "rc",
      payload.language ?? "fr",
      payload.nrc1 ?? "",
      payload.nrc2 ?? "",
      payload.nrc3 ?? "",
      payload.nrc4 ?? "",
      payload.nrc5 ?? "",
      payload.nom ?? "",
      payload.prenom ?? "",
      payload.nomCommercial ?? "",
      company?.rc ?? "",
      company?.nom ?? "",
      company?.prenom ?? "",
      company?.adresse ?? "",
      company?.statut ?? "",
      company?.idCommercant ?? "",
      String(resultCount ?? ""),
      compactJson(metadata)
    ];

    if (company?.rc) {
      await upsertRow(config.searchSheetName, searchHeaders, 13, company.rc, searchRow);
    } else {
      await appendRows(config.searchSheetName, searchHeaders, [searchRow]);
    }

    if (company?.rc || company?.details?.merchant.rc) {
      await appendCompanySnapshot(payload, company);
    }
  } catch (error) {
    console.log("GOOGLE SHEETS APPEND ERROR:", error instanceof Error ? error.message : error);
  }
}

export async function appendCompanySnapshot(payload: SidjilcomSearchPayload, company: Partial<CompanyResult>) {
  const config = getConfig();
  if (!config) return;

  const rc = company.rc || company.details?.merchant.rc || "";
  if (!rc) return;

  await upsertRow(config.companiesSheetName, companyHeaders, 4, rc, companyRow(payload, company));
  if (company.details) {
    await upsertRow(config.detailsSheetName, detailsHeaders, 1, rc, detailRow(rc, company.details));
    await upsertRow(config.activitiesSheetName, activityHeaders, 1, rc, activitiesRow(rc, company.details));
  }
}

export async function appendAnnexes(payload: SidjilcomSearchPayload, parentRc: string, annexes: SidjilcomAnnex[]) {
  const config = getConfig();
  if (!config) return;

  const now = new Date().toISOString();
  await upsertRow(
    config.annexesSheetName,
    annexHeaders,
    1,
    parentRc,
    [
      now,
      parentRc,
      String(annexes.length),
      annexes.map((annex) => `${annex.rc} | ${annex.wilaya} | ${annex.statut} | ${annex.adresse}`).join("\n"),
      compactJson(annexes)
    ]
  );

  if (parentRc) {
    await appendCompanySnapshot(payload, { rc: parentRc, hasSecondaires: annexes.length > 0 });
  }
}

export async function appendComptesSociaux(payload: SidjilcomSearchPayload, rc: string, comptes: { exercice: string; dateDepot?: string; statut?: string; raw?: unknown }[]) {
  const config = getConfig();
  if (!config) return;

  const now = new Date().toISOString();
  await upsertRow(
    config.comptesSheetName,
    comptesHeaders,
    1,
    rc,
    [
      now,
      rc,
      String(comptes.length),
      comptes.map((compte) => compte.exercice).filter(Boolean).join(", "),
      compactJson(comptes)
    ]
  );
  await appendCompanySnapshot(payload, { rc });
}

export async function appendCompteSocialDetails(payload: SidjilcomSearchPayload, rc: string, exercice: string, details: unknown) {
  const config = getConfig();
  if (!config) return;

  await upsertRow(config.comptesSheetName, comptesHeaders, 1, rc, [
    new Date().toISOString(),
    rc,
    "1",
    exercice,
    compactJson({ exercice, details })
  ]);
  await appendCompanySnapshot(payload, { rc });
}

export async function getGoogleCachedCompany(payload: SidjilcomSearchPayload) {
  const config = getConfig();
  if (!config) return null;

  try {
    await ensureSheet(config.companiesSheetName, companyHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.companiesSheetName, "A2:T"))}`);
    if (!response?.ok) return null;

    const data = (await response.json()) as { values?: string[][] };
    const key = cnrcKeyFromPayload(payload);
    const rows = (data.values ?? []).filter((row) => row[1] === key);
    const row = rows.at(-1);
    if (!row) return null;
    const normalizedRowRc = (row[4] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (normalizedRowRc && normalizedRowRc !== key && !key.startsWith(normalizedRowRc) && !normalizedRowRc.startsWith(key)) {
      return null;
    }

    const parsedDetails = parseJson<SidjilcomDetails | undefined>(row[19], undefined);
    const details = hasMeaningfulDetails(parsedDetails) ? parsedDetails : undefined;
    if (!row[5] && !row[6] && !row[9] && !row[10] && !details) return null;
    return {
      rc: cleanSheetText(row[4]),
      nom: cleanSheetText(row[5]),
      prenom: cleanSheetText(row[6]),
      adresse: cleanSheetText(row[9]),
      statut: cleanSheetText(row[10]),
      idCommercant: inferIdFromRow(row),
      hasSecondaires: row[12] === "true",
      details,
      cache: {
        hit: true,
        detailsAvailable: hasMeaningfulDetails(details),
        checkedAt: row[0] ?? null
      }
    } satisfies CompanyResult;
  } catch (error) {
    console.log("GOOGLE SHEETS CACHE READ ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleCachedCompanyByRc(rc: string) {
  const config = getConfig();
  const normalizedRc = rc.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!config || !normalizedRc) return null;

  try {
    await ensureSheet(config.companiesSheetName, companyHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.companiesSheetName, "A2:T"))}`);
    if (!response?.ok) return null;

    const data = (await response.json()) as { values?: string[][] };
    const rows = (data.values ?? []).filter((row) => {
      const rowRc = (row[4] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (rowRc === normalizedRc || normalizedRc.startsWith(rowRc)) return true;
      return rowRc.startsWith(normalizedRc) && rowRc.length <= normalizedRc.length + 4;
    });
    const row = rows.at(-1);
    if (!row) return null;

    const parsedDetails = parseJson<SidjilcomDetails | undefined>(row[19], undefined);
    const details = hasMeaningfulDetails(parsedDetails) ? parsedDetails : undefined;
    return {
      rc: cleanSheetText(row[4]),
      nom: cleanSheetText(row[5]),
      prenom: cleanSheetText(row[6]),
      adresse: cleanSheetText(row[9]),
      statut: cleanSheetText(row[10]),
      idCommercant: inferIdFromRow(row),
      hasSecondaires: row[12] === "true",
      details,
      cache: {
        hit: true,
        detailsAvailable: hasMeaningfulDetails(details),
        checkedAt: row[0] ?? null
      }
    } satisfies CompanyResult;
  } catch (error) {
    console.log("GOOGLE SHEETS CACHE RC READ ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleCachedAnnexes(parentRc: string) {
  const config = getConfig();
  const normalizedRc = parentRc.toUpperCase().replace(/[^0-9A-Z-]/g, "");
  if (!config || !normalizedRc) return null;

  try {
    await ensureSheet(config.annexesSheetName, annexHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.annexesSheetName, "A2:E"))}`);
    if (!response?.ok) return null;

    const data = (await response.json()) as { values?: string[][] };
    const rows = (data.values ?? []).filter((row) => cleanSheetText(row[1]).toUpperCase().replace(/[^0-9A-Z-]/g, "") === normalizedRc);
    const row = rows.at(-1);
    if (!row) return null;

    const annexes = parseJson<SidjilcomAnnex[]>(row[4], []).filter((annex) => annex?.rc);
    if (!annexes.length) return null;

    return {
      annexes,
      cache: {
        hit: true,
        checkedAt: row[0] ?? null
      }
    };
  } catch (error) {
    console.log("GOOGLE SHEETS ANNEX CACHE READ ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleCachedComptesSociaux(rc: string) {
  const config = getConfig();
  const normalizedRc = rc.toUpperCase().replace(/[^0-9A-Z-]/g, "");
  if (!config || !normalizedRc) return null;

  try {
    await ensureSheet(config.comptesSheetName, comptesHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.comptesSheetName, "A2:E"))}`);
    if (!response?.ok) return null;

    const data = (await response.json()) as { values?: string[][] };
    const rows = (data.values ?? []).filter((row) => cleanSheetText(row[1]).toUpperCase().replace(/[^0-9A-Z-]/g, "") === normalizedRc);
    const row = rows.at(-1);
    if (!row) return null;

    const parsed = parseJson<Array<{ exercice: string; dateDepot?: string; statut?: string; raw?: unknown }> | { exercice?: string; details?: unknown }>(row[4], []);
    const comptesSociaux = Array.isArray(parsed) ? parsed.filter((item) => item?.exercice) : [];
    if (!comptesSociaux.length) return null;

    return {
      comptesSociaux,
      cache: {
        hit: true,
        checkedAt: row[0] ?? null
      }
    };
  } catch (error) {
    console.log("GOOGLE SHEETS COMPTES CACHE READ ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleCachedCompteSocialDetails(rc: string, exercice: string) {
  const config = getConfig();
  const normalizedRc = rc.toUpperCase().replace(/[^0-9A-Z-]/g, "");
  const normalizedExercice = exercice.trim();
  if (!config || !normalizedRc || !normalizedExercice) return null;

  try {
    await ensureSheet(config.comptesSheetName, comptesHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.comptesSheetName, "A2:E"))}`);
    if (!response?.ok) return null;

    const data = (await response.json()) as { values?: string[][] };
    const rows = (data.values ?? []).filter((row) => cleanSheetText(row[1]).toUpperCase().replace(/[^0-9A-Z-]/g, "") === normalizedRc);

    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      const parsed = parseJson<{ exercice?: string; details?: unknown; rawFields?: Record<string, string> } | Array<unknown>>(row[4], {});
      if (Array.isArray(parsed)) continue;
      if ((parsed.exercice ?? "").trim() !== normalizedExercice) continue;

      return {
        exercice: normalizedExercice,
        details: parsed.details ?? {},
        rawFields: parsed.rawFields ?? {},
        cache: {
          hit: true,
          checkedAt: row[0] ?? null
        }
      };
    }

    return null;
  } catch (error) {
    console.log("GOOGLE SHEETS COMPTE DETAIL CACHE READ ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleSheetCompanies() {
  const config = getConfig();
  if (!config) return null;

  try {
    await ensureSheet(config.companiesSheetName, companyHeaders);
    const response = await sheetsRequest(`/values/${encodeURIComponent(quotedRange(config.companiesSheetName, "A2:T"))}`);
    if (!response?.ok) return [];

    const data = (await response.json()) as { values?: string[][] };
    return (data.values ?? [])
      .map((row, index) => ({
        id: `sheet-${index}-${row[1] ?? ""}`,
        created_at: row[0] ?? "",
        nrc1: row[14] ?? "",
        nrc2: (row[15] ?? "A") as CnrcPayload["nrc2"],
        nrc3: row[16] ?? "",
        nrc4: row[17] ?? "",
        nrc5: row[18] ?? "",
        rc: row[4] ?? "",
        nom: row[5] ?? "",
        prenom: row[6] ?? "",
        adresse: row[9] ?? "",
        statut: row[10] ?? "",
        idCommercant: inferIdFromRow(row)
      }))
      .filter((row) => row.rc || row.nom || row.nrc3)
      .reverse();
  } catch (error) {
    console.log("GOOGLE SHEETS READ ERROR:", error instanceof Error ? error.message : error);
    return [];
  }
}
