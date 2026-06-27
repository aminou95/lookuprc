import * as cheerio from "cheerio";
import { serverEnv } from "@/lib/env";
import { PRIVATE_SIDJILCOM_COOKIE, PRIVATE_SIDJILCOM_P_AUTH } from "@/lib/private-sidjilcom-config";
import { readSidjilcomServerSession, writeSidjilcomServerSession } from "@/lib/sidjilcom-session";
import type { CnrcPayload, CompanyResult, ImportedSidjilcomDetails, SidjilcomAnnex, SidjilcomCompteSocial, SidjilcomDetails, SidjilcomSearchPayload } from "@/lib/types";

const portletPrefix =
  "_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_";
const portletId = "dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK";
const basePageUrl = "https://sidjilcom.cnrc.dz/fr/group/sidjilcom/repertoire-des-commercants";
const basePmGroupPageUrl = "https://sidjilcom.cnrc.dz/group/sidjilcom/repertoire-des-commercants";
const basePmArPageUrl = "https://sidjilcom.cnrc.dz/ar/group/sidjilcom/%D8%A5%D9%8A%D8%AC%D8%A7%D8%AF_%D8%AA%D8%A7%D8%AC%D8%B1";
const refererUrl =
  "https://sidjilcom.cnrc.dz/fr/group/sidjilcom/repertoire-des-commercants?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_mvcPath=%2FrecherchePP.jsp";
const refererArUrl =
  "https://sidjilcom.cnrc.dz/ar/group/sidjilcom/%D8%A5%D9%8A%D8%AC%D8%A7%D8%AF_%D8%AA%D8%A7%D8%AC%D8%B1?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_javax.portlet.action=action";
const refererPmFrUrl =
  "https://sidjilcom.cnrc.dz/fr/group/sidjilcom/repertoire-des-commercants?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_mvcPath=%2FrecherchePM.jsp";
const refererPmGroupActionUrl =
  "https://sidjilcom.cnrc.dz/group/sidjilcom/repertoire-des-commercants?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_javax.portlet.action=actionPM";
const refererPmArUrl =
  "https://sidjilcom.cnrc.dz/ar/group/sidjilcom/%D8%A5%D9%8A%D8%AC%D8%A7%D8%AF_%D8%AA%D8%A7%D8%AC%D8%B1?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_javax.portlet.action=actionPM";

function isArabicPayload(payload?: Pick<SidjilcomSearchPayload, "language">) {
  return payload?.language === "ar";
}

function acceptLanguage(payload?: Pick<SidjilcomSearchPayload, "language">) {
  return isArabicPayload(payload) ? "ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.5" : "fr-FR,fr;q=0.9,ar;q=0.7,en;q=0.5";
}

function repairMojibake(value: string) {
  const shouldRepair = [...value].some((char) => [194, 195, 216, 217].includes(char.charCodeAt(0)));
  if (!shouldRepair) return value;

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    if (/[\u0600-\u06ff]/.test(repaired) || repaired.length < value.length) return repaired;
    return value;
  } catch {
    return value;
  }
}

function cleanCellText(value: string) {
  return repairMojibake(value).replace(/\s+/g, " ").trim();
}

function pageUrlForPayload(payload?: SidjilcomSearchPayload) {
  if (isArabicPayload(payload)) return basePmArPageUrl;
  return isArabicPayload(payload) ? basePmArPageUrl : basePageUrl;
}

function refererForPayload(payload?: SidjilcomSearchPayload) {
  if (payload?.searchType === "morale") return isArabicPayload(payload) ? refererPmArUrl : refererPmFrUrl;
  return isArabicPayload(payload) ? refererArUrl : refererUrl;
}

function buildSidjilcomFormData(payload: SidjilcomSearchPayload, pAuth: string) {
  const formData = new FormData();
  const searchType = payload.searchType ?? "cnrc";
  const lookupMode = payload.lookupMode ?? (searchType === "cnrc" ? "rc" : "name");
  const useCnrc = searchType === "cnrc" || (searchType === "physique" && lookupMode === "rc");
  const useNameSearch = searchType === "physique" && lookupMode === "name";

  formData.set(`${portletPrefix}formDate`, String(Date.now()));
  formData.set(`${portletPrefix}nrc1`, useCnrc ? payload.nrc1 : "");
  formData.set(`${portletPrefix}nrc2`, useCnrc ? payload.nrc2 : useNameSearch ? "-1" : "");
  formData.set(`${portletPrefix}nrc3`, useCnrc ? payload.nrc3 : "");
  formData.set(`${portletPrefix}nrc4`, useCnrc ? payload.nrc4 : "");
  formData.set(`${portletPrefix}nrc5`, useCnrc ? payload.nrc5 : useNameSearch ? "-1" : "");
  formData.set(`${portletPrefix}wilcom`, "");
  formData.set(`${portletPrefix}nom_com`, "");
  formData.set(`${portletPrefix}secteur`, "-1");
  formData.set(`${portletPrefix}activite`, "");
  formData.set(`${portletPrefix}deb_immat`, "");
  formData.set(`${portletPrefix}fin_immat`, "");
  formData.set(`${portletPrefix}nom`, searchType === "physique" ? payload.nom?.trim() ?? "" : "");
  formData.set(`${portletPrefix}prenom`, searchType === "physique" ? payload.prenom?.trim() ?? "" : "");
  formData.set(`${portletPrefix}d_naiss`, "");
  formData.set(`${portletPrefix}nation`, "");
  formData.set(`${portletPrefix}checkboxNames`, "presume");
  formData.set("p_auth", pAuth);
  formData.set(`${portletPrefix}Rechercher`, "");

  return formData;
}

function buildSidjilcomPmFormData(payload: SidjilcomSearchPayload, pAuth: string) {
  const formData = new FormData();
  const lookupMode = payload.lookupMode ?? "name";
  const useRc = lookupMode === "rc";
  const useRaisonSociale = lookupMode === "name";
  const useAssociate = lookupMode === "associate";
  const useActivity = lookupMode === "activity";

  formData.set(`${portletPrefix}formDate`, String(Date.now()));
  formData.set(`${portletPrefix}nrc1`, useRc ? payload.nrc1 ?? "" : "");
  formData.set(`${portletPrefix}nrc2`, useRc ? payload.nrc2 ?? "B" : "-1");
  formData.set(`${portletPrefix}nrc3`, useRc ? payload.nrc3 ?? "" : "");
  formData.set(`${portletPrefix}nrc4`, useRc ? payload.nrc4 ?? "" : "");
  formData.set(`${portletPrefix}nrc5`, useRc ? payload.nrc5 ?? "16" : "-1");
  formData.set(`${portletPrefix}raison_social`, useRaisonSociale ? payload.nomCommercial?.trim() ?? "" : "");
  formData.set(`${portletPrefix}forme_juridi`, "-1");
  formData.set(`${portletPrefix}secteur`, "-1");
  formData.set(`${portletPrefix}activite`, useActivity ? payload.activite?.trim() ?? "" : "");
  formData.set(`${portletPrefix}wilcom`, "");
  formData.set(`${portletPrefix}deb_immat`, "");
  formData.set(`${portletPrefix}fin_immat`, "");
  formData.set(`${portletPrefix}nom_prenom_assoc`, useAssociate ? [payload.nom, payload.prenom].filter(Boolean).join(" ").trim() : "");
  formData.set(`${portletPrefix}d_naiss`, "");
  formData.set(`${portletPrefix}nation`, "");
  formData.set(`${portletPrefix}qualite_associe`, "-1");
  formData.set(`${portletPrefix}checkboxNames`, "presume");
  formData.set("p_auth", pAuth);
  formData.set(`${portletPrefix}Rechercher`, "");

  return formData;
}

function buildSidjilcomPmGetUrl(payload: SidjilcomSearchPayload) {
  const lookupMode = payload.lookupMode ?? "name";
  const useRc = lookupMode === "rc";
  const useRaisonSociale = lookupMode === "name";
  const useAssociate = lookupMode === "associate";
  const useActivity = lookupMode === "activity";
  const rootNrc = useRc ? `${payload.nrc1 ?? ""}${payload.nrc2 ?? ""}${payload.nrc3 ?? ""}` : "";
  const params = new URLSearchParams({
    p_p_id: portletId,
    p_p_lifecycle: "2",
    p_p_state: "normal",
    p_p_mode: "view",
    p_p_cacheability: "cacheLevelPage",
    [`${portletPrefix}cmd`]: "get_csByNrc",
    [`${portletPrefix}mvcPath`]: "/resultatRecherchePm.jsp",
    [`${portletPrefix}nrc2`]: useRc ? payload.nrc2 ?? "B" : "-1",
    [`${portletPrefix}nrc1`]: useRc ? payload.nrc1 ?? "" : "",
    [`${portletPrefix}javax.portlet.action`]: "actionPM",
    [`${portletPrefix}nation`]: "",
    [`${portletPrefix}nrc5`]: useRc ? payload.nrc5 ?? "16" : "-1",
    [`${portletPrefix}formDate`]: String(Date.now()),
    [`${portletPrefix}nrc4`]: useRc ? payload.nrc4 ?? "" : "",
    [`${portletPrefix}Rechercher`]: "",
    [`${portletPrefix}nrc3`]: useRc ? payload.nrc3 ?? "" : "",
    [`${portletPrefix}qualite_associe`]: "-1",
    [`${portletPrefix}fin_immat`]: "",
    [`${portletPrefix}raison_social`]: useRaisonSociale ? payload.nomCommercial?.trim() ?? "" : "",
    [`${portletPrefix}wilcom`]: "",
    [`${portletPrefix}nom_prenom_assoc`]: useAssociate ? [payload.nom, payload.prenom].filter(Boolean).join(" ").trim() : "",
    [`${portletPrefix}activite`]: useActivity ? payload.activite?.trim() ?? "" : "",
    [`${portletPrefix}secteur`]: "-1",
    [`${portletPrefix}forme_juridi`]: "-1",
    [`${portletPrefix}checkboxNames`]: "presume",
    [`${portletPrefix}deb_immat`]: "",
    [`${portletPrefix}presume`]: "false",
    [`${portletPrefix}d_naiss`]: "",
    [`${portletPrefix}nrc`]: rootNrc
  });

  params.append("p_p_lifecycle", "1");
  return `${pageUrlForPayload(payload)}?${params.toString()}`;
}

function buildDetailsIdentifier(company: CompanyResult, payload: CnrcPayload) {
  return company.idCommercant || `${company.rc}${payload.nrc4}${payload.nrc5}`.replace(/\s+/g, "");
}

function extractAuthToken(html: string) {
  return (
    html.match(/Liferay\.authToken\s*=\s*["']([^"']+)["']/)?.[1] ||
    html.match(/p_auth=([^"'&\s]+)/)?.[1] ||
    ""
  );
}

function mergeSetCookie(cookie: string, response: Response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    return cookie;
  }

  const cookieMap = new Map<string, string>();

  cookie.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (name && rest.length) cookieMap.set(name, rest.join("="));
  });

  setCookie.split(/,(?=\s*[^;,\s]+=)/).forEach((entry) => {
    const [pair] = entry.split(";");
    const [name, ...rest] = pair.trim().split("=");
    if (name && rest.length) cookieMap.set(name, rest.join("="));
  });

  return [...cookieMap.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function setCookieValue(cookie: string, name: string, value: string) {
  const cookieMap = new Map<string, string>();

  cookie.split(";").forEach((part) => {
    const [cookieName, ...rest] = part.trim().split("=");
    if (cookieName && rest.length) cookieMap.set(cookieName, rest.join("="));
  });

  cookieMap.set(name, value);
  return [...cookieMap.entries()].map(([cookieName, cookieValue]) => `${cookieName}=${cookieValue}`).join("; ");
}

function cookieForPayload(cookie: string, payload?: SidjilcomSearchPayload) {
  return setCookieValue(cookie, "GUEST_LANGUAGE_ID", isArabicPayload(payload) ? "ar_SA" : "fr_FR");
}

async function bootstrapSidjilcomSession(cookie: string, fallbackPAuth: string, payload?: SidjilcomSearchPayload) {
  try {
    const response = await fetch(refererForPayload(payload), {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLanguage(payload),
        Cookie: cookieForPayload(cookie, payload),
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });
    const html = await response.text();
    const freshPAuth = extractAuthToken(html);
    const mergedCookie = mergeSetCookie(cookie, response);

    console.log("BOOTSTRAP STATUS:", response.status);
    console.log("BOOTSTRAP HAS AUTH:", Boolean(freshPAuth));

    return {
      cookie: mergedCookie,
      pAuth: freshPAuth || fallbackPAuth
    };
  } catch (error) {
    console.log("BOOTSTRAP FAILED:", error instanceof Error ? error.message : error);
    return {
      cookie,
      pAuth: fallbackPAuth
    };
  }
}

export function parseCompanies(html: string): CompanyResult[] {
  const $ = cheerio.load(html);
  const rowEntries: { cells: string[]; idCommercant: string }[] = [];

  $("tbody.table-data tr, table.table-data tbody tr, table tbody tr").each((_, row) => {
    const rowHtml = $.html(row);
    const rowCells = $(row)
      .find("td")
      .map((__, cell) => cleanCellText($(cell).text()))
      .get();

    if (rowCells.length >= 4) {
      console.log("SIDJILCOM RESULT ROW HTML:", rowHtml.substring(0, 2000));
      const detailMatch = rowHtml.match(/get_details\('([^']+)'\)|get_detailpm\('([^']+)'\)/);
      const idCommercant = detailMatch?.[1] ?? detailMatch?.[2] ?? "";

      console.log("DETAIL MATCH:", detailMatch?.[0]);
      console.log("ID COMMERCANT:", idCommercant);

      rowEntries.push({
        cells: rowCells,
        idCommercant: idCommercant || extractCommercantId(rowHtml)
      });
    }
  });

  return rowEntries
    .filter((row) => row.cells.some((cell) => cell))
    .map((entry) => {
      const cells = entry.cells;
      const hasPrenomColumn = cells.length >= 5 && !/actif|conforme|radi|ناشط|مطابق|مشطوب|غير/i.test(cells[3] ?? "");

      return {
        rc: cells[0] ?? "",
        nom: cells[1] ?? "",
        prenom: hasPrenomColumn ? cells[2] ?? "" : "",
        adresse: hasPrenomColumn ? cells[3] ?? "" : cells[2] ?? "",
        statut: hasPrenomColumn ? cells[4] ?? "" : cells[3] ?? "",
        hasSecondaires:
          Boolean(entry.idCommercant) &&
          (html.includes(`get_secondaires('${cells[0] ?? ""}')`) || html.includes(`get_secondairesByNrc('${cells[0] ?? ""}')`)),
        idCommercant: entry.idCommercant || undefined
      };
    });
}

export function parseFirstCompany(html: string): CompanyResult | null {
  return parseCompanies(html)[0] ?? null;
}

function extractCommercantId(html: string) {
  const patterns = [
    /id_commercant["'=:\s]+([0-9]+)/i,
    /idCommercant["'=:\s]+([0-9]+)/i,
    /get_details\((?:'|")?([A-Z0-9]+)(?:'|")?\)/i,
    /get_detailpm\((?:'|")?([A-Z0-9]+)(?:'|")?\)/i,
    /idCommercant\((?:'|")?([A-Z0-9]+)(?:'|")?\)/i,
    /get_detailsCommercantById\((?:'|")?([A-Z0-9]+)(?:'|")?\)/i,
    /detailsPP\((?:'|")?([A-Z0-9]+)(?:'|")?\)/i,
    /data-id(?:_commercant)?=["']([A-Z0-9]+)["']/i,
    /data-id-commercant=["']([A-Z0-9]+)["']/i,
    /get_detailsCommercantById[^A-Z0-9]+([A-Z0-9]+)/i,
    /detailsPP\.jsp[^"']*?([?&](?:amp;)?id[^=]*=)([A-Z0-9]+)/i,
    /(?:^|[^\w])id["'=:\s]+([0-9]{2,})/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const id = match?.[2] || match?.[1];

    if (id) {
      return id;
    }
  }

  return "";
}

function emptyDetails(): SidjilcomDetails {
  return {
    merchant: {
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
    },
    activities: [],
    associates: [],
    inscription: {
      dateImmatriculation: "",
      numeroInscription: "",
      dateModification: ""
    },
    commercant: {
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
    },
    localCommercial: {
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
    rawFields: {}
  };
}

function normalizeText(value: string) {
  const normalized = value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

  const shouldRepair = [...normalized].some((char) => [194, 195, 216, 217].includes(char.charCodeAt(0)));

  if (!shouldRepair) {
    return normalized;
  }

  try {
    return Buffer.from(normalized, "latin1").toString("utf8").replace(/\s+/g, " ").trim();
  } catch {
    return normalized;
  }
}

function normalizeKey(value: string) {
  return normalizeText(value).replace(/[:：]+$/g, "").trim();
}

function addRawField(rawFields: Record<string, string>, key: string, value: string) {
  const cleanKey = normalizeKey(key);
  const cleanValue = normalizeText(value);

  if (!cleanKey) {
    return;
  }

  if (!rawFields[cleanKey]) {
    rawFields[cleanKey] = cleanValue;
    return;
  }

  let index = 2;
  while (rawFields[`${cleanKey} (${index})`] !== undefined) {
    index += 1;
  }
  rawFields[`${cleanKey} (${index})`] = cleanValue;
}

function looksLikeFieldName(value: string) {
  const text = normalizeText(value);
  return text.endsWith(":") || text.endsWith("：") || /^[\p{L}\s'’()./-]{3,}$/u.test(text);
}

function extractFieldPairsFromScope($: cheerio.CheerioAPI, scopeSelector: string) {
  const pairs: Record<string, string> = {};
  let labelCount = 0;

  $(scopeSelector)
    .find(".row")
    .each((_, row) => {
    const labels = $(row)
      .find("label, .control-label, strong, b, span, div")
      .map((__, element) => normalizeText($(element).clone().children().remove().end().text()))
      .get()
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);

    labelCount += labels.length;

    for (let index = 0; index < labels.length; index += 1) {
      const current = labels[index];
      const next = labels.slice(index + 1).find((value) => value && value !== current) ?? "";

      if (looksLikeFieldName(current) && next) {
        addRawField(pairs, current, next);
        index += 1;
      }
    }
    });

  console.log("Sidjilcom details labels parsed", labelCount);
  console.log("Sidjilcom details field pairs parsed", Object.keys(pairs).length);

  return pairs;
}

function findField(rawFields: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(rawFields);
  const normalizedEntries = entries.map(([key, value]) => ({
    value,
    normalizedKey: normalizeKey(key).replace(/\s+\(\d+\)$/g, "").toLowerCase()
  }));

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias).toLowerCase();
    const match = normalizedEntries.find((entry) => entry.normalizedKey === normalizedAlias);

    if (match) {
      return match.value;
    }
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias).toLowerCase();

    if (normalizedAlias.length <= 3) {
      continue;
    }

    const match = normalizedEntries.find((entry) => entry.normalizedKey.includes(normalizedAlias));

    if (match) {
      return match.value;
    }
  }

  return "";
}

function cleanMappedValue(value?: string) {
  const repaired = String(value ?? "")
    .replace(/\u00c3\u00a9/g, "\u00e9")
    .replace(/\u00c3\u00a8/g, "\u00e8")
    .replace(/\u00c3\u00aa/g, "\u00ea")
    .replace(/\u00c3\u00a0/g, "\u00e0")
    .replace(/\u00c3\u00a7/g, "\u00e7")
    .replace(/\u00c2\u00b0/g, "\u00b0");

  return /:$/.test(repaired.trim()) ? "" : repaired;
}

function parseTableRows($: cheerio.CheerioAPI, selector: string) {
  const rows: Record<string, string>[] = [];

  $(selector).each((_, row) => {
    const record: Record<string, string> = {};
    const table = $(row).closest("table");
    const headers = table
      .find("thead tr")
      .first()
      .find("th")
      .map((__, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);
    $(row)
      .find("td")
      .each((index, cell) => {
        const value = normalizeText($(cell).text());
        record[`col${index + 1}`] = value;

        const header = headers[index];
        if (header) {
          record[header] = value;
        }
      });

    if (Object.values(record).some(Boolean)) {
      rows.push(record);
    }
  });

  return rows;
}

function normalizeLabel(value: string) {
  return cleanMappedValue(normalizeText(value))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function firstNonEmptyValue(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const direct = cleanMappedValue(record[alias]);
    if (direct) return direct;
  }

  const entries = Object.entries(record);
  for (const alias of aliases) {
    const normalizedAlias = normalizeLabel(alias);
    const match = entries.find(([key]) => normalizeLabel(key) === normalizedAlias || normalizeLabel(key).includes(normalizedAlias));
    if (match) {
      const value = cleanMappedValue(match[1]);
      if (value) return value;
    }
  }

  return "";
}

function parseActivitiesFromTab($: cheerio.CheerioAPI) {
  const activities: { code: string; libelle: string }[] = [];
  const scope = $("#tab_1").length ? $("#tab_1") : $(".tab_1, [id*='activ']");

  scope.find("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);
    const code = cells.find((cell) => /^\d{5,6}$/.test(cell)) ?? "";
    const libelle = cells.find((cell) => cell !== code && /[A-Za-zÀ-ÿ]/.test(cell)) ?? "";

    if (code || libelle) {
      activities.push({ code, libelle });
    }
  });

  if (!activities.length) {
    const text = normalizeText(scope.text());
    [...text.matchAll(/(\d{5,6})\s+(.+?)(?=\s+\d{5,6}\s+|$)/g)].forEach((match) => {
      activities.push({ code: match[1], libelle: normalizeText(match[2]) });
    });
  }

  console.log("Sidjilcom activities parsed", activities.length);
  return activities;
}

function parseImportedActivities($: cheerio.CheerioAPI) {
  const activities: ImportedSidjilcomDetails["activities"] = [];

  $("#tab_1 tbody.table-data tr, #tab_1 table tbody tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length) {
      activities.push({
        codeActivite: cells[0] ?? "",
        libelleActivite: cells[1] ?? "",
        numeroAgrement: cells[2] ?? ""
      });
    }
  });

  if (!activities.length) {
    parseActivitiesFromTab($).forEach((activity) => {
      activities.push({
        codeActivite: activity.code,
        libelleActivite: activity.libelle,
        numeroAgrement: ""
      });
    });
  }

  return activities;
}

function parseImportedModifications($: cheerio.CheerioAPI) {
  const modifications: Record<string, string>[] = [];

  $("#tab_2 tbody.table-data tr, #tab_2 table tbody tr").each((_, row) => {
    const record: Record<string, string> = {};
    $(row)
      .find("td")
      .each((index, cell) => {
        record[`col${index + 1}`] = normalizeText($(cell).text());
      });

    if (Object.values(record).some(Boolean)) {
      modifications.push(record);
    }
  });

  return modifications;
}

function mapMerchant(rawFields: Record<string, string>) {
  return {
    rc: findField(rawFields, ["RC", "Numéro RC", "Numero RC", "Numéro Inscription", "Numero Inscription", "رقم السجل"]),
    nom: findField(rawFields, ["Nom Français", "Nom"]),
    prenom: findField(rawFields, ["Prénom Français", "Prenom", "Prénom"]),
    nomAr: findField(rawFields, ["Nom Arabe", "اللقب"]),
    prenomAr: findField(rawFields, ["Prénom Arabe", "Prenom Arabe", "الاسم"]),
    dateNaissance: findField(rawFields, ["Date naissance", "Date de naissance"]),
    lieuNaissance: findField(rawFields, ["Lieu naissance", "Lieu de naissance"]),
    nis: findField(rawFields, ["NIS"]),
    nif: findField(rawFields, ["NIF"]),
    etatCivil: findField(rawFields, ["Etat civil", "État civil"]),
    nationalite: findField(rawFields, ["Nationalité"]),
    regimeMatrimonial: findField(rawFields, ["Régime matrimonial", "Regime matrimonial"]),
    dateImmatriculation: findField(rawFields, ["Date immatriculation", "Date d'immatriculation"]),
    adresse: findField(rawFields, ["Adresse"]),
    commune: findField(rawFields, ["Commune", "Commune/Wilaya"]),
    telephone: findField(rawFields, ["Téléphone", "Telephone"]),
    dateDebutExploitation: findField(rawFields, ["Date début exploitation", "Date debut exploitation"]),
    typeCommerce: findField(rawFields, ["Type commerce", "Type de commerce"])
  };
}

function refineMerchant(rawFields: Record<string, string>, merchant: SidjilcomDetails["merchant"]) {
  return {
    ...merchant,
    rc:
      cleanMappedValue(
        findField(rawFields, ["Numéro d'inscription", "Numero d'inscription", "Numéro Inscription", "Numero Inscription"])
      ) || merchant.rc,
    dateNaissance: cleanMappedValue(findField(rawFields, ["Date de Naiss", "Date naissance", "Date de naissance"])) || merchant.dateNaissance,
    lieuNaissance: cleanMappedValue(findField(rawFields, ["Lieu Naiss", "Lieu naissance", "Lieu de naissance"])) || merchant.lieuNaissance,
    nis: cleanMappedValue(findField(rawFields, ["NIS"])),
    nif: cleanMappedValue(findField(rawFields, ["NIF"])) || merchant.nif,
    adresse: cleanMappedValue(findField(rawFields, ["Adresse"])) || merchant.adresse,
    commune:
      cleanMappedValue(findField(rawFields, ["Commune / Wilaya d'inscription", "Commune/Wilaya d'inscription", "Commune", "Commune/Wilaya"])) ||
      merchant.commune,
    typeCommerce: cleanMappedValue(findField(rawFields, ["Type de Commerce", "Type commerce"])) || merchant.typeCommerce
  };
}

export function parseImportedSidjilcomDetails(html: string): ImportedSidjilcomDetails {
  const $ = cheerio.load(html);
  const rawFields = extractFieldPairsFromScope($, $("#tab_0").length ? "#tab_0" : "body");
  const merchant = refineMerchant(rawFields, mapMerchant(rawFields));
  const activities = parseImportedActivities($);
  const modifications = parseImportedModifications($);

  console.log("Imported Sidjilcom raw fields", Object.keys(rawFields).length);
  console.log("Imported Sidjilcom activities", activities.length);
  console.log("Imported Sidjilcom modifications", modifications.length);

  return {
    rawFields,
    merchant,
    activities,
    modifications
  };
}

function parseSidjilcomDetails(html: string): SidjilcomDetails {
  const $ = cheerio.load(html);
  const details = emptyDetails();
  const scopeSelector = $("#tab_0").length ? "#tab_0" : $(".portlet-body").length ? ".portlet-body" : "body";
  const rawFields = extractFieldPairsFromScope($, scopeSelector);

  details.rawFields = rawFields;
  details.merchant = refineMerchant(rawFields, mapMerchant(rawFields));
  details.activities = parseActivitiesFromTab($);
  details.associates = parseAssociatesFromTab($);
  details.inscription = {
    dateImmatriculation: details.merchant.dateImmatriculation,
    numeroInscription: details.merchant.rc || findField(rawFields, ["Numéro d'inscription", "Numero Inscription", "رقم القيد"]),
    dateModification: findField(rawFields, ["Date Modification", "Date de modification", "تاريخ التعديل"])
  };
  details.commercant = {
    nomFr: details.merchant.nom,
    nomAr: details.merchant.nomAr,
    prenomFr: details.merchant.prenom,
    prenomAr: details.merchant.prenomAr,
    dateNaissance: details.merchant.dateNaissance,
    numeroActeNaissance: findField(rawFields, ["Numéro Acte Naissance", "N° Acte Naissance", "رقم شهادة الميلاد"]),
    lieuNaissance: details.merchant.lieuNaissance,
    nis: details.merchant.nis,
    nif: details.merchant.nif,
    etatCivil: details.merchant.etatCivil,
    nationalite: details.merchant.nationalite,
    regimeMatrimonial: details.merchant.regimeMatrimonial
  };
  details.localCommercial = {
    typeCommerce: findField(rawFields, ["Type Commerce", "Type de commerce"]),
    adresse: findField(rawFields, ["Adresse du local", "Adresse", "العنوان"]),
    codePostal: findField(rawFields, ["Code Postal", "الرمز البريدي"]),
    communeWilayaInscription: findField(rawFields, ["Commune/Wilaya d'inscription", "Commune Wilaya Inscription"]),
    nomCommercial: findField(rawFields, ["Nom Commercial", "الاسم التجاري"]),
    dateDebutExploitation: findField(rawFields, ["Date Début Exploitation", "Date Debut Exploitation"]),
    telephone: findField(rawFields, ["Téléphone", "Telephone"]),
    fax: findField(rawFields, ["Fax"]),
    email: findField(rawFields, ["Email", "E-mail"]),
    appartenanceLocal: findField(rawFields, ["Appartenance Local"]),
    natureAcquisitionLocal: findField(rawFields, ["Nature Acquisition Local"]),
    proprietaireLocal: findField(rawFields, ["Propriétaire Local", "Proprietaire Local"]),
    natureLocation: findField(rawFields, ["Nature Location"]),
    dureeBail: findField(rawFields, ["Durée Bail", "Duree Bail"])
  };
  details.fondsCommerce = {
    appartenanceFonds: findField(rawFields, ["Appartenance Fonds"]),
    natureAcquisitionFonds: findField(rawFields, ["Nature Acquisition Fonds"]),
    numeroRc: findField(rawFields, ["Numéro RC", "Numero RC"]),
    proprietaireFonds: findField(rawFields, ["Propriétaire Fonds", "Proprietaire Fonds"]),
    adresseFonds: findField(rawFields, ["Adresse Fonds"]),
    natureBail: findField(rawFields, ["Nature Bail"]),
    dateDebutBail: findField(rawFields, ["Date Début Bail", "Date Debut Bail"]),
    dureeBail: findField(rawFields, ["Durée Bail", "Duree Bail"])
  };
  details.activitesExercees = details.activities.length
    ? details.activities.map((activity) => ({ code: activity.code, libelle: activity.libelle }))
    : parseTableRows($, "#tab_1 tbody tr, #activite tbody tr, .activite tbody tr, table tbody tr").filter((row) =>
        Object.values(row).some((value) => /activité|activite|code|libell/i.test(value))
      );
  details.modifications = parseTableRows($, "#modification tbody tr, .modification tbody tr, table tbody tr").filter((row) =>
    Object.values(row).some((value) => /modification|radiation|transfert|changement|date/i.test(value))
  );

  return details;
}

function parseAssociatesFromTab($: cheerio.CheerioAPI) {
  const rows = parseTableRows($, "#tab_2 tbody tr");
  const associates = rows
    .map((row) => ({
      nomComplet: firstNonEmptyValue(row, ["Nom /Prénom", "Nom / Prenom", "Nom/Prénom", "Nom/Prenom"]),
      dateNaissance: firstNonEmptyValue(row, ["Date de Naiss", "Date Naiss"]),
      lieuNaissance: firstNonEmptyValue(row, ["Lieu Naiss", "Lieu de Naissance"]),
      qualite: firstNonEmptyValue(row, ["Qualité", "Qualite"]),
      telephone: firstNonEmptyValue(row, ["Télephone", "Telephone"]),
      fax: firstNonEmptyValue(row, ["Fax"]),
      nationalite: firstNonEmptyValue(row, ["Nationalité", "Nationalite"])
    }))
    .filter((row) => Object.values(row).some(Boolean));

  console.log("Sidjilcom associates parsed", associates.length);
  return associates;
}

function hasMeaningfulDetails(details: SidjilcomDetails, idCommercant: string) {
  const relevantRawValues = Object.entries(details.rawFields).filter(([key]) =>
    /nif|nis|nom|prenom|raison|adresse|activit|capital|forme|gerant|assoc|date|registre|immatric/i.test(key)
  );

  return Boolean(
    details.merchant.nom ||
        details.merchant.nif ||
        details.merchant.nis ||
        details.activities.length ||
        details.associates.length ||
        details.activitesExercees.length ||
        details.rawFields["NIF"] ||
        details.rawFields["NIS"] ||
        (idCommercant && relevantRawValues.some(([, value]) => value.includes(idCommercant)))
  );
}

function hasDetailsMarker(html: string, idCommercant: string) {
  return Boolean(
    html.includes(idCommercant) ||
      html.includes("NIF") ||
      html.includes("NIS") ||
      html.includes("Informations") ||
      html.includes("معلومات") ||
      html.includes("Activit")
  );
}

function hasPmDetailsSignal(html: string, idCommercant: string) {
  if (!html) return false;

  if (hasDetailsMarker(html, idCommercant)) {
    return true;
  }

  return /raison sociale|forme juridique|capital|gerant|g[eé]rant|associe|associ[eé]|activit[eé]|detailpm|societe/i.test(html);
}

function buildActionParams(payload: SidjilcomSearchPayload, command: string) {
  const isMorale = payload.searchType === "morale";
  const params = new URLSearchParams();
  params.append("p_p_id", portletId);
  params.append("p_p_lifecycle", "2");
  params.append("p_p_state", "normal");
  params.append("p_p_mode", "view");
  params.append("p_p_cacheability", "cacheLevelPage");
  params.append(`${portletPrefix}cmd`, command);
  params.append(`${portletPrefix}mvcPath`, isMorale ? "/resultatRecherchePm.jsp" : "/resultatRecherchePp.jsp");
  params.append("p_p_lifecycle", "1");
  params.append(`${portletPrefix}nrc2`, payload.nrc2);
  params.append(`${portletPrefix}nrc1`, payload.nrc1);
  params.append(`${portletPrefix}javax.portlet.action`, isMorale ? "actionPM" : "action");
  params.append(`${portletPrefix}nation`, "");
  params.append(`${portletPrefix}nrc5`, payload.nrc5);
  params.append(`${portletPrefix}formDate`, String(Date.now()));
  params.append(`${portletPrefix}nrc4`, payload.nrc4);
  params.append(`${portletPrefix}Rechercher`, "");
  params.append(`${portletPrefix}nrc3`, payload.nrc3);
  params.append(`${portletPrefix}nom_com`, "");
  params.append(`${portletPrefix}fin_immat`, "");
  params.append(`${portletPrefix}nom`, "");
  params.append(`${portletPrefix}wilcom`, "");
  params.append(`${portletPrefix}activite`, "");
  params.append(`${portletPrefix}secteur`, "-1");
  params.append(`${portletPrefix}checkboxNames`, "presume");
  params.append(`${portletPrefix}deb_immat`, "");
  params.append(`${portletPrefix}presume`, "false");
  params.append(`${portletPrefix}d_naiss`, "");
  params.append(`${portletPrefix}prenom`, "");
  return params;
}

function normalizeAnnex(record: Record<string, unknown>): SidjilcomAnnex {
  const id = String(record.nrcEtsWil ?? record.nrc ?? record.rc ?? "");
  const statusCode = String(record.st_comr ?? record.etat ?? record.libEtat ?? record.statut ?? "");
  const statut =
    statusCode === "0"
      ? "Actif/Conforme"
      : statusCode === "9"
        ? "Actif/Non conforme"
        : normalizeText(statusCode);

  return {
    rc: normalizeText(String(record.nrcEts ?? id)),
    wilaya: normalizeText(String(record.libWilfr ?? record.wilayaIns ?? record.wilIns ?? record.wilaya ?? "")),
    adresse: normalizeText(String(record.adrFR ?? record.adresse ?? "")),
    statut,
    idCommercant: id
  };
}

function getRecordValue(record: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(record);
  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined && direct !== null) return normalizeText(String(direct));

    const lowerKey = key.toLowerCase();
    const match = entries.find(([entryKey]) => entryKey.toLowerCase().includes(lowerKey));
    if (match?.[1] !== undefined && match[1] !== null) return normalizeText(String(match[1]));
  }

  return "";
}

function normalizeMoralRecord(record: Record<string, unknown>): CompanyResult {
  const rc = getRecordValue(record, ["nrc", "num_rc", "numeroInscription", "numero", "rc"]);
  const nom = getRecordValue(record, ["raison_social", "raisonSocial", "raison", "denomination", "nom_com", "nomCom", "nom"]);
  const adresse = getRecordValue(record, ["adrFR", "adrAR", "adresse", "siege", "address"]);
  const statutCode = getRecordValue(record, ["st_comr", "etat", "statut", "libEtat"]);
  const statut =
    statutCode === "0"
      ? "Actif/Conforme"
      : statutCode === "9"
        ? "Actif/Non conforme"
        : statutCode;
  const idCommercant = getRecordValue(record, ["nrcEtsWil", "id_commercant", "idCommercant", "id", "nrc"]);

  return {
    rc,
    nom,
    prenom: "",
    adresse,
    statut,
    idCommercant: idCommercant || rc || undefined,
    hasSecondaires: false
  };
}

function normalizeStringRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeText(key), value === undefined || value === null ? "" : normalizeText(String(value))])
  );
}

function normalizeCompteSocial(record: Record<string, unknown>): SidjilcomCompteSocial {
  const raw = normalizeStringRecord(record);
  return {
    exercice: getRecordValue(record, ["exercice", "annee", "year", "exer", "exerciceFiscal"]),
    dateDepot: getRecordValue(record, ["dateDepot", "dtDepot", "date_depot", "depot", "date"]),
    statut: getRecordValue(record, ["statut", "etat", "libEtat", "status"]),
    raw
  };
}

function parseCompteSociaux(text: string) {
  try {
    const json = JSON.parse(text) as unknown;
    const rows = Array.isArray(json)
      ? json
      : json && typeof json === "object"
        ? Object.values(json as Record<string, unknown>).find(Array.isArray)
        : null;

    if (!Array.isArray(rows) || rows[0] === "-1") {
      return [];
    }

    return rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map(normalizeCompteSocial)
      .filter((row) => row.exercice || Object.values(row.raw).some(Boolean));
  } catch {
    return [];
  }
}

function parseMoralCompanies(text: string): CompanyResult[] {
  try {
    const json = JSON.parse(text) as unknown;
    const rows = Array.isArray(json)
      ? json
      : json && typeof json === "object"
        ? Object.values(json as Record<string, unknown>).find(Array.isArray)
        : null;

    if (Array.isArray(rows)) {
      return rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map(normalizeMoralRecord)
        .filter((row) => row.rc || row.nom || row.adresse);
    }
  } catch {
    // Sidjilcom may return an HTML fragment instead of JSON.
  }

  return parseCompanies(text);
}

async function getSidjilcomServerSession() {
  const localSession = readSidjilcomServerSession();
  const localIsFresh =
    localSession?.updatedAt && Date.now() - new Date(localSession.updatedAt).getTime() < 1000 * 60 * 60 * 12;
  const envCookie = (localIsFresh ? localSession?.cookie : undefined) || serverEnv("SIDJILCOM_COOKIE") || localSession?.cookie || PRIVATE_SIDJILCOM_COOKIE;
  const envPAuth = (localIsFresh ? localSession?.pAuth : undefined) || serverEnv("SIDJILCOM_P_AUTH") || localSession?.pAuth || PRIVATE_SIDJILCOM_P_AUTH;

  if (!envCookie || !envPAuth) {
    return null;
  }

  return bootstrapSidjilcomSession(envCookie, envPAuth);
}

export async function lookupSidjilcomAnnexes(payload: SidjilcomSearchPayload, nrc = `${payload.nrc1}${payload.nrc2}${payload.nrc3}`) {
  const session = await getSidjilcomServerSession();

  if (!session) {
    return {
      ok: false as const,
      status: 500,
      code: "CONFIGURATION",
      error: "SIDJILCOM_COOKIE et SIDJILCOM_P_AUTH sont requis côté serveur."
    };
  }

  const sessionForPayload = await bootstrapSidjilcomSession(session.cookie, session.pAuth, payload);
  const params = buildActionParams(payload, "get_secondairesByNrc");
  params.append(`${portletPrefix}nrc`, nrc);

  try {
    const response = await fetch(`${pageUrlForPayload(payload)}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": acceptLanguage(payload),
        Referer: refererForPayload(payload),
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieForPayload(sessionForPayload.cookie, payload),
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });

    const text = await response.text();
    const json = JSON.parse(text) as unknown;
    const annexes = Array.isArray(json)
      ? json
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && row !== "-1")
          .map(normalizeAnnex)
      : [];

    return {
      ok: true as const,
      status: response.status,
      annexes
    };
  } catch (error) {
    console.log("SIDJILCOM ANNEXES FAILED:", error instanceof Error ? error.message : error);
    return {
      ok: false as const,
      status: 502,
      code: "NETWORK",
      error: "Impossible de charger les établissements secondaires."
    };
  }
}

export async function lookupSidjilcomDetailsById(payload: SidjilcomSearchPayload, idCommercant: string) {
  const session = await getSidjilcomServerSession();

  if (!session) {
    return {
      ok: false as const,
      status: 500,
      code: "CONFIGURATION",
      error: "SIDJILCOM_COOKIE et SIDJILCOM_P_AUTH sont requis côté serveur."
    };
  }

  const sessionForPayload = await bootstrapSidjilcomSession(session.cookie, session.pAuth, payload);
  await writeSidjilcomServerSession(sessionForPayload.cookie, sessionForPayload.pAuth);

  const detailsHtml = await fetchDetailsHtml(idCommercant, sessionForPayload.cookie, sessionForPayload.pAuth, payload);
  const details = detailsHtml ? parseSidjilcomDetails(detailsHtml) : emptyDetails();

  if (!details.merchant.rc) {
    details.merchant.rc = idCommercant;
    details.inscription.numeroInscription = idCommercant;
  }

  return {
    ok: true as const,
    status: 200,
    details,
    detailUnavailableReason: hasMeaningfulDetails(details, idCommercant)
      ? undefined
      : "Le serveur n'a pas pu charger les details de cet etablissement."
  };
}

export async function lookupSidjilcomComptesSociaux(payload: SidjilcomSearchPayload, nrc: string) {
  const session = await getSidjilcomServerSession();

  if (!session) {
    return {
      ok: false as const,
      status: 500,
      code: "CONFIGURATION",
      error: "SIDJILCOM_COOKIE et SIDJILCOM_P_AUTH sont requis côté serveur."
    };
  }

  const sessionForPayload = await bootstrapSidjilcomSession(session.cookie, session.pAuth, payload);
  const params = buildActionParams({ ...payload, searchType: "morale" }, "get_csByNrc");
  params.append(`${portletPrefix}nrc`, nrc);

  try {
    const response = await fetch(`${pageUrlForPayload(payload)}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": acceptLanguage(payload),
        Referer: refererForPayload({ ...payload, searchType: "morale" }),
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieForPayload(sessionForPayload.cookie, payload),
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });

    const text = await response.text();
    const comptesSociaux = parseCompteSociaux(text);
    console.log("COMPTES SOCIAUX STATUS:", response.status);
    console.log("COMPTES SOCIAUX COUNT:", comptesSociaux.length);

    return {
      ok: true as const,
      status: response.status,
      comptesSociaux
    };
  } catch (error) {
    console.log("SIDJILCOM COMPTES SOCIAUX FAILED:", error instanceof Error ? error.message : error);
    return {
      ok: false as const,
      status: 502,
      code: "NETWORK",
      error: "Impossible de charger les comptes sociaux."
    };
  }
}

export async function lookupSidjilcomCompteSocialDetails(payload: SidjilcomSearchPayload, nrc: string, exercice: string) {
  const session = await getSidjilcomServerSession();

  if (!session) {
    return {
      ok: false as const,
      status: 500,
      code: "CONFIGURATION",
      error: "SIDJILCOM_COOKIE et SIDJILCOM_P_AUTH sont requis côté serveur."
    };
  }

  const sessionForPayload = await bootstrapSidjilcomSession(session.cookie, session.pAuth, payload);
  const params = buildActionParams({ ...payload, searchType: "morale" }, "get_detailCsByNrc");
  params.append(`${portletPrefix}nrc`, nrc);
  params.append(`${portletPrefix}exercice`, exercice);

  let detailCookie = sessionForPayload.cookie;

  try {
    const initResponse = await fetch(`${pageUrlForPayload(payload)}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "text/plain, */*",
        "Accept-Language": acceptLanguage(payload),
        Referer: refererForPayload({ ...payload, searchType: "morale" }),
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieForPayload(detailCookie, payload),
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });

    await initResponse.text();
    detailCookie = mergeSetCookie(detailCookie, initResponse);

    const mvcPath = Number.parseInt(exercice, 10) < 2010 ? "%2FdetailsCS.jsp" : "%2FdetailsCS_SCF.jsp";
    const detailsUrl =
      `${pageUrlForPayload(payload)}?p_p_id=${portletId}` +
      `&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
      `&${portletPrefix}mvcPath=${mvcPath}`;

    const detailsResponse = await fetch(detailsUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLanguage(payload),
        Referer: `${pageUrlForPayload(payload)}?${params.toString()}`,
        Cookie: cookieForPayload(detailCookie, payload),
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });

    const html = await detailsResponse.text();
    const details = parseSidjilcomDetails(html);

    return {
      ok: true as const,
      status: detailsResponse.status,
      exercice,
      details,
      rawFields: details.rawFields
    };
  } catch (error) {
    console.log("SIDJILCOM COMPTE SOCIAL DETAIL FAILED:", error instanceof Error ? error.message : error);
    return {
      ok: false as const,
      status: 502,
      code: "NETWORK",
      error: "Impossible de charger le détail du compte social."
    };
  }
}

async function fetchDetailsHtml(idCommercant: string, cookie: string, pAuth: string, payload?: SidjilcomSearchPayload) {
  if (!idCommercant) return "";
  const isMorale = payload?.searchType === "morale";
  const moraleLookupMode = payload?.lookupMode ?? "name";
  const useMoraleRc = moraleLookupMode === "rc";
  const useMoraleName = moraleLookupMode === "name";
  const useMoraleAssociate = moraleLookupMode === "associate";
  const useMoraleActivity = moraleLookupMode === "activity";
  const initBaseUrl = isMorale && !isArabicPayload(payload) ? basePmGroupPageUrl : pageUrlForPayload(payload);
  const initReferer = isMorale && !isArabicPayload(payload) ? refererPmGroupActionUrl : refererForPayload(payload);

  const initParams = new URLSearchParams();
  initParams.append("p_p_id", portletId);
  initParams.append("p_p_lifecycle", "2");
  initParams.append("p_p_state", "normal");
  initParams.append("p_p_mode", "view");
  initParams.append("p_p_cacheability", "cacheLevelPage");
  initParams.append(`${portletPrefix}cmd`, isMorale ? "get_detailSocieteById" : "get_detailsCommercantById");
  initParams.append(`${portletPrefix}mvcPath`, isMorale ? "/resultatRecherchePm.jsp" : "/resultatRecherchePp.jsp");
  initParams.append("p_p_lifecycle", "1");
  initParams.append(`${portletPrefix}nrc2`, isMorale ? (useMoraleRc ? payload?.nrc2 ?? "" : "-1") : payload?.nrc2 ?? "");
  initParams.append(`${portletPrefix}nrc1`, isMorale ? (useMoraleRc ? payload?.nrc1 ?? "" : "") : payload?.nrc1 ?? "");
  initParams.append(`${portletPrefix}javax.portlet.action`, isMorale ? "actionPM" : "action");
  initParams.append(`${portletPrefix}nation`, "");
  initParams.append(`${portletPrefix}nrc5`, isMorale ? (useMoraleRc ? payload?.nrc5 ?? "" : "-1") : payload?.nrc5 ?? "");
  initParams.append(`${portletPrefix}formDate`, String(Date.now()));
  initParams.append(`${portletPrefix}nrc4`, isMorale ? (useMoraleRc ? payload?.nrc4 ?? "" : "") : payload?.nrc4 ?? "");
  initParams.append(`${portletPrefix}Rechercher`, "");
  initParams.append(`${portletPrefix}nrc3`, isMorale ? (useMoraleRc ? payload?.nrc3 ?? "" : "") : payload?.nrc3 ?? "");
  initParams.append(`${portletPrefix}nom_com`, isMorale ? "" : payload?.searchType === "morale" ? payload.nomCommercial ?? "" : "");
  initParams.append(`${portletPrefix}fin_immat`, "");
  initParams.append(`${portletPrefix}nom`, payload?.searchType === "physique" ? payload.nom ?? "" : "");
  initParams.append(`${portletPrefix}wilcom`, "");
  initParams.append(`${portletPrefix}activite`, useMoraleActivity ? payload?.activite?.trim() ?? "" : "");
  initParams.append(`${portletPrefix}secteur`, "-1");
  initParams.append(`${portletPrefix}checkboxNames`, "presume");
  initParams.append(`${portletPrefix}deb_immat`, "");
  initParams.append(`${portletPrefix}presume`, "false");
  initParams.append(`${portletPrefix}d_naiss`, "");
  initParams.append(`${portletPrefix}prenom`, payload?.searchType === "physique" ? payload.prenom ?? "" : "");
  if (isMorale) {
    initParams.append(`${portletPrefix}qualite_associe`, "-1");
    initParams.append(`${portletPrefix}raison_social`, useMoraleName ? payload?.nomCommercial?.trim() ?? "" : "");
    initParams.append(`${portletPrefix}nom_prenom_assoc`, useMoraleAssociate ? [payload?.nom, payload?.prenom].filter(Boolean).join(" ").trim() : "");
    initParams.append(`${portletPrefix}forme_juridi`, "-1");
  }
  initParams.append(`${portletPrefix}id_commercant`, idCommercant);
  initParams.append(`${portletPrefix}nat_hist`, "0");

  const initUrl = `${initBaseUrl}?${initParams.toString()}`;

  const detailsBaseUrl = isMorale && !isArabicPayload(payload) ? basePmGroupPageUrl : pageUrlForPayload(payload);
  const detailsUrl =
    `${detailsBaseUrl}?p_p_id=${portletId}` +
    `&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
    `&${portletPrefix}mvcPath=${isMorale ? "%2FdetailPM.jsp" : "%2FdetailsPP.jsp"}`;

  const detailsScfUrl =
    `${pageUrlForPayload(payload)}?p_p_id=${portletId}` +
    `&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
    `&${portletPrefix}mvcPath=%2FdetailsCS_SCF.jsp`;

  let detailCookie = cookie;

  const initHeaders = {
    Accept: "text/plain, */*",
    "Accept-Language": acceptLanguage(payload),
    Origin: "https://sidjilcom.cnrc.dz",
    Referer: initReferer,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieForPayload(detailCookie, payload),
    "User-Agent": "Mozilla/5.0"
  };

  const initResponse = await fetch(initUrl, {
    method: "GET",
    headers: initHeaders,
    cache: "no-store"
  });

  const initText = await initResponse.text();
  detailCookie = mergeSetCookie(detailCookie, initResponse);

  console.log("INIT STATUS:", initResponse.status);
  console.log("INIT TEXT:", initText);

  if (isMorale && hasPmDetailsSignal(initText, idCommercant)) {
    const parsedInitDetails = parseSidjilcomDetails(initText);
    if (hasMeaningfulDetails(parsedInitDetails, idCommercant)) {
      return initText;
    }
  }

  const detailsResponse = await fetch(detailsUrl, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": acceptLanguage(payload),
      "Cache-Control": "max-age=0",
      Connection: "keep-alive",
      Referer: initReferer,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      Cookie: cookieForPayload(detailCookie, payload),
      "User-Agent": "Mozilla/5.0"
    },
    cache: "no-store"
  });

  const detailsHtml = await detailsResponse.text();

  console.log("DETAILS STATUS:", detailsResponse.status);
  console.log("DETAILS HAS NIF:", detailsHtml.includes("NIF"));
  console.log("DETAILS HAS RC:", detailsHtml.includes(idCommercant));

  if (isMorale) {
    const parsedDetails = parseSidjilcomDetails(detailsHtml);
    if (hasMeaningfulDetails(parsedDetails, idCommercant)) {
      return detailsHtml;
    }
  }

  if (isMorale && !hasDetailsMarker(detailsHtml, idCommercant)) {
    const scfResponse = await fetch(detailsScfUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLanguage(payload),
        Referer: initReferer,
        Cookie: cookieForPayload(detailCookie, payload)
      },
      cache: "no-store"
    });
    const scfHtml = await scfResponse.text();
    console.log("DETAILS SCF STATUS:", scfResponse.status);
    console.log("DETAILS SCF HAS RC:", scfHtml.includes(idCommercant));
    if (hasPmDetailsSignal(scfHtml, idCommercant)) {
      const parsedScfDetails = parseSidjilcomDetails(scfHtml);
      if (hasMeaningfulDetails(parsedScfDetails, idCommercant)) {
        return scfHtml;
      }
    }
    if (hasDetailsMarker(scfHtml, idCommercant)) {
      return scfHtml;
    }
  }

  return detailsHtml;
}

function isRetryableSidjilcomStatus(status: number) {
  return [502, 503, 504].includes(status);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function lookupSidjilcomCompany(payload: SidjilcomSearchPayload, options: { includeDetails?: boolean } = {}) {
  const localSession = readSidjilcomServerSession();
  const envCookie = localSession?.cookie || serverEnv("SIDJILCOM_COOKIE") || PRIVATE_SIDJILCOM_COOKIE;
  const envPAuth = localSession?.pAuth || serverEnv("SIDJILCOM_P_AUTH") || PRIVATE_SIDJILCOM_P_AUTH;
  const searchType = payload.searchType ?? "cnrc";
  const lookupUrl =
    serverEnv("SIDJILCOM_LOOKUP_URL") ||
    "https://sidjilcom.cnrc.dz/fr/group/sidjilcom/repertoire-des-commercants?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_javax.portlet.action=action";

  if (!envCookie || !envPAuth) {
    return {
      ok: false as const,
      status: 500,
      code: "CONFIGURATION",
      error: "SIDJILCOM_COOKIE et SIDJILCOM_P_AUTH sont requis côté serveur."
    };
  }

  let response: Response;
  let html: string;
  let session: { cookie: string; pAuth: string };

  try {
    session = await bootstrapSidjilcomSession(envCookie, envPAuth, payload);

    const runPrimarySearch = () =>
      searchType === "morale"
        ? fetch(
            `${pageUrlForPayload(payload)}?p_p_id=${portletId}&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&${portletPrefix}javax.portlet.action=actionPM`,
            {
            method: "POST",
            headers: {
              Accept: "*/*",
              "Accept-Language": acceptLanguage(payload),
              Origin: "https://sidjilcom.cnrc.dz",
              Referer: refererForPayload(payload),
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "same-origin",
              "X-PJAX": "true",
              "X-Requested-With": "XMLHttpRequest",
              Cookie: cookieForPayload(session.cookie, payload),
              "User-Agent": "Mozilla/5.0"
            },
            body: buildSidjilcomPmFormData(payload, session.pAuth),
            cache: "no-store"
          })
        : fetch(
            searchType === "cnrc" && !isArabicPayload(payload)
              ? lookupUrl
              : `${pageUrlForPayload(payload)}?p_p_id=${portletId}&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&${portletPrefix}javax.portlet.action=action`,
            {
            method: "POST",
            headers: {
              Accept: "*/*",
              "Accept-Language": acceptLanguage(payload),
              Origin: "https://sidjilcom.cnrc.dz",
              Referer: refererForPayload(payload),
              "User-Agent": "Mozilla/5.0",
              "X-PJAX": "true",
              "X-Requested-With": "XMLHttpRequest",
              Cookie: cookieForPayload(session.cookie, payload)
            },
            body: buildSidjilcomFormData(payload, session.pAuth),
            cache: "no-store"
          });

    response = await runPrimarySearch();
    if (isRetryableSidjilcomStatus(response.status)) {
      await wait(800);
      response = await runPrimarySearch();
    }

    if (searchType === "morale" && !response.ok) {
      response = await fetch(buildSidjilcomPmGetUrl(payload), {
        method: "GET",
        headers: {
          Accept: "application/json, text/javascript, */*",
          "Accept-Language": acceptLanguage(payload),
          Referer: refererForPayload(payload),
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "X-Requested-With": "XMLHttpRequest",
          Cookie: cookieForPayload(session.cookie, payload),
          "User-Agent": "Mozilla/5.0"
        },
        cache: "no-store"
      });
      if (isRetryableSidjilcomStatus(response.status)) {
        await wait(800);
        response = await fetch(buildSidjilcomPmGetUrl(payload), {
          method: "GET",
          headers: {
            Accept: "application/json, text/javascript, */*",
            "Accept-Language": acceptLanguage(payload),
            Referer: refererForPayload(payload),
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "X-Requested-With": "XMLHttpRequest",
            Cookie: cookieForPayload(session.cookie, payload),
            "User-Agent": "Mozilla/5.0"
          },
          cache: "no-store"
        });
      }
    }
    html = await response.text();
    session = {
      cookie: mergeSetCookie(session.cookie, response),
      pAuth: extractAuthToken(html) || session.pAuth
    };
    await writeSidjilcomServerSession(session.cookie, session.pAuth);
  } catch (error) {
    console.log("SIDJILCOM LOOKUP FAILED:", error instanceof Error ? error.message : error);
    return {
      ok: false as const,
      status: 502,
      code: "NETWORK",
      error: "Impossible de contacter Sidjilcom."
    };
  }

  console.log("SIDJILCOM STATUS:", response.status);
  console.log("SIDJILCOM HTML HAS DETAILS:", html.includes("Informations Commer"));
  console.log("SIDJILCOM HTML HAS NIF:", html.includes("NIF"));
  console.log("SIDJILCOM HTML START:", html.substring(0, 1000));

  // TEMP: disabled because Sidjilcom page contains words like connexion/session
  // and creates false COOKIE_EXPIRED errors.

  if (!response.ok) {
    return {
      ok: false as const,
      status: 502,
      code: "NETWORK",
      error: `Sidjilcom a retourné une erreur HTTP ${response.status}.`
    };
  }

  let parsedCompanies = searchType === "morale" ? parseMoralCompanies(html) : parseCompanies(html);

  if (searchType === "morale" && parsedCompanies.length === 0) {
    try {
      const fallbackResponse = await fetch(buildSidjilcomPmGetUrl(payload), {
        method: "GET",
        headers: {
          Accept: "application/json, text/javascript, */*",
          "Accept-Language": acceptLanguage(payload),
          Referer: refererForPayload(payload),
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "X-Requested-With": "XMLHttpRequest",
          Cookie: cookieForPayload(session.cookie, payload),
          "User-Agent": "Mozilla/5.0"
        },
        cache: "no-store"
      });

      const fallbackHtml = await fallbackResponse.text();
      const fallbackSession = {
        cookie: mergeSetCookie(session.cookie, fallbackResponse),
        pAuth: extractAuthToken(fallbackHtml) || session.pAuth
      };
      await writeSidjilcomServerSession(fallbackSession.cookie, fallbackSession.pAuth);

      console.log("SIDJILCOM PM GET FALLBACK STATUS:", fallbackResponse.status);
      console.log("SIDJILCOM PM GET FALLBACK START:", fallbackHtml.substring(0, 1000));

      parsedCompanies = parseMoralCompanies(fallbackHtml);
      response = fallbackResponse;
      html = fallbackHtml;
      session = fallbackSession;
    } catch (error) {
      console.log("SIDJILCOM PM GET FALLBACK FAILED:", error instanceof Error ? error.message : error);
    }
  }

  const companies = parsedCompanies.map((row) => ({
    ...row,
    idCommercant: row.idCommercant || buildDetailsIdentifier(row, payload)
  }));
  const company = companies[0] ?? null;

  if (!company) {
    return {
      ok: false as const,
      status: 404,
      code: "NO_RESULT",
      error: "Aucun résultat trouvé pour ce numéro CNRC."
    };
  }

  const detailsIdentifier = buildDetailsIdentifier(company, payload);

  if (!options.includeDetails || searchType === "morale") {
    return {
      ok: true as const,
      status: 200,
      company: {
        ...company,
        idCommercant: detailsIdentifier
      },
      results: companies
    };
  }

  const detailsHtml = await fetchDetailsHtml(detailsIdentifier, session.cookie, session.pAuth, payload);
  const details = detailsHtml ? parseSidjilcomDetails(detailsHtml) : emptyDetails();
  if (!details.merchant.rc) {
    details.merchant.rc = detailsIdentifier;
    details.inscription.numeroInscription = detailsIdentifier;
  }
  const detailUnavailableReason = hasMeaningfulDetails(details, detailsIdentifier)
    ? undefined
    : "Le serveur a trouve la ligne CNRC, mais cette session Sidjilcom ne donne pas acces aux details premium.";

  return {
    ok: true as const,
    status: 200,
    company: {
      ...company,
      idCommercant: detailsIdentifier,
      detailUnavailableReason,
      details
    },
    results: companies
  };
}
