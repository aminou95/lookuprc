import type { CnrcPayload } from "@/lib/types";

const nrc2Values: CnrcPayload["nrc2"][] = ["A", "D", "W1", "B", "W2", "S"];

function normalizeNrc2(value: unknown): CnrcPayload["nrc2"] | null {
  const text = String(value ?? "").trim().toUpperCase();

  if (text === "أ" || text === "A") return "A";
  if (text === "د" || text === "D") return "D";
  if (text === "و1" || text === "W1") return "W1";
  if (nrc2Values.includes(text as CnrcPayload["nrc2"])) return text as CnrcPayload["nrc2"];

  return null;
}

function findValue(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);

  for (const name of names) {
    const match = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== "") {
      return match[1];
    }
  }

  return "";
}

export function getRowValue(row: Record<string, unknown>, names: string[]) {
  return String(findValue(row, names)).trim();
}

export function getClientType(row: Record<string, unknown>) {
  return getRowValue(row, ["STATUT", "Statut", "statut", "type", "Type", "TYPE", "client_type", "Client Type", "nature", "Nature"]);
}

export function isPhysicalClient(row: Record<string, unknown>) {
  const type = getClientType(row).toUpperCase();
  return type === "PHY" || type === "PHYSIQUE" || type === "PERSONNE PHYSIQUE";
}

export function isMoralClient(row: Record<string, unknown>) {
  const type = [getClientType(row), getClientName(row), getRowValue(row, ["forme", "Forme", "forme_juridique", "Forme Juridique"])]
    .join(" ")
    .toUpperCase();

  return /\b(PM|MORALE|PERSONNE MORALE|SARL|EURL|SPA|SNC|SCS|SCA|SOCIETE|SOCIÉTÉ)\b/.test(type);
}

export function categoryFromCnrc(cnrc: CnrcPayload | null, row?: Record<string, unknown>) {
  if (cnrc?.nrc2 === "B" || cnrc?.nrc2 === "W2" || cnrc?.nrc2 === "S") return "morale" as const;
  if (cnrc?.nrc2 === "A" || cnrc?.nrc2 === "D" || cnrc?.nrc2 === "W1") return "physique" as const;
  if (row && isMoralClient(row)) return "morale" as const;
  if (row && isPhysicalClient(row)) return "physique" as const;
  return "unknown" as const;
}

export function getClientName(row: Record<string, unknown>) {
  const fullName = getRowValue(row, [
    "client",
    "Client",
    "nom_client",
    "Nom Client",
    "name",
    "Name",
    "full_name",
    "Full Name"
  ]);

  if (fullName) {
    return fullName;
  }

  return [getRowValue(row, ["nom", "Nom", "last_name", "Last Name"]), getRowValue(row, ["prenom", "Prénom", "prenom", "first_name", "First Name"])]
    .filter(Boolean)
    .join(" ");
}

export function getMoralClientName(row: Record<string, unknown>) {
  return (
    getRowValue(row, [
      "raison_sociale",
      "Raison Sociale",
      "raison sociale",
      "Raison sociale",
      "nom_commercial",
      "Nom Commercial",
      "Nom commercial",
      "societe",
      "Societe",
      "Société"
    ]) || getClientName(row)
  );
}

export function getRawRc(row: Record<string, unknown>) {
  return getRowValue(row, ["CNRC", "cnrc", "RC", "rc", "registre", "registre_commerce"]);
}

export function getRawNif(row: Record<string, unknown>) {
  return getRowValue(row, ["NIF", "nif", "Num NIF", "Numero NIF", "numero_nif", "identifiant_fiscal"]);
}

export function getRawNis(row: Record<string, unknown>) {
  return getRowValue(row, ["NIS", "nis", "Num NIS", "Numero NIS", "numero_nis", "identifiant_statistique"]);
}

export function splitPersonName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nom: value.trim(), prenom: "" };
  return {
    nom: parts.slice(0, -1).join(" "),
    prenom: parts.at(-1) ?? ""
  };
}

export function formatOfficialCnrc(payload: CnrcPayload) {
  return `${payload.nrc1} | ${payload.nrc2} | ${payload.nrc3} | ${payload.nrc4} | ${payload.nrc5}`;
}

export function normalizeComparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function namesLookSimilar(appName: string, officialName: string) {
  const app = normalizeComparableName(appName);
  const official = normalizeComparableName(officialName);

  if (!app || !official) {
    return false;
  }

  if (app === official || app.includes(official) || official.includes(app)) {
    return true;
  }

  const appTokens = new Set(app.split(" ").filter((token) => token.length > 1));
  const officialTokens = official.split(" ").filter((token) => token.length > 1);
  const matches = officialTokens.filter((token) => appTokens.has(token)).length;

  return matches >= Math.min(2, officialTokens.length);
}

export function cnrcPayloadFromRow(row: Record<string, unknown>): CnrcPayload | null {
  const nrc1 = String(findValue(row, ["nrc1", "NRC1", "rc1"])).replace(/\D/g, "").slice(0, 2);
  const nrc2 = normalizeNrc2(findValue(row, ["nrc2", "NRC2", "type", "type_rc"]));
  const nrc3 = String(findValue(row, ["nrc3", "NRC3", "rc3"])).replace(/\D/g, "").slice(0, 7);
  const nrc4 = String(findValue(row, ["nrc4", "NRC4", "rc4"])).replace(/\D/g, "").slice(0, 2);
  const nrc5 = String(findValue(row, ["nrc5", "NRC5", "wilaya", "wilaya_rc"])).replace(/\D/g, "").slice(0, 2);

  if (/^\d{2}$/.test(nrc1) && nrc2 && /^\d{7}$/.test(nrc3) && /^\d{2}$/.test(nrc4) && /^\d{2}$/.test(nrc5)) {
    return { nrc1, nrc2, nrc3, nrc4, nrc5 };
  }

  const fullRc = getRawRc(row);
  const match = fullRc.match(/(\d{2})\s*([A-Za-z]|أ|د|و1|W1|ب|و2|W2|س)\s*(\d{7})\s*[/-]?\s*(\d{2})?\s*[-/]?\s*(\d{2})?/i);

  if (!match) {
    return null;
  }

  const parsedNrc2 = normalizeNrc2(match[2]);

  if (!parsedNrc2) {
    return null;
  }

  return {
    nrc1: match[1],
    nrc2: parsedNrc2,
    nrc3: match[3],
    nrc4: match[4] || "00",
    nrc5: match[5] || String(findValue(row, ["wilaya", "nrc5", "NRC5"])).replace(/\D/g, "").slice(0, 2)
  };
}
