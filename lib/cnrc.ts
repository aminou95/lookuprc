import type { CnrcPayload, SidjilcomSearchPayload } from "@/lib/types";

export const nrc2Options = [
  { value: "A", label: "A => أ", preview: "أ" },
  { value: "D", label: "D => د", preview: "د" },
  { value: "W1", label: "W1 => و1", preview: "و1" }
] as const;

export const nrc2PersonneMoraleOptions = [
  { value: "B", label: "B => ب", preview: "ب" },
  { value: "W2", label: "W2 => و2", preview: "و2" },
  { value: "S", label: "S => س", preview: "س" }
] as const;

export const wilayaOptions = Array.from({ length: 58 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: value };
});

export function getNrc2Preview(value: CnrcPayload["nrc2"]) {
  return [...nrc2Options, ...nrc2PersonneMoraleOptions].find((option) => option.value === value)?.preview ?? value;
}

export function getNrc2SidjilcomValue(value: CnrcPayload["nrc2"]) {
  return getNrc2Preview(value);
}

export function formatCnrcPreview(payload: CnrcPayload) {
  const nrc1 = payload.nrc1 || "22";
  const nrc2 = getNrc2Preview(payload.nrc2);
  const nrc3 = payload.nrc3 || "5912919";
  const nrc4 = payload.nrc4 || "00";
  const nrc5 = payload.nrc5 || "16";
  return `${nrc1} ${nrc2} ${nrc3} / ${nrc4} - ${nrc5}`;
}

export function validateCnrcPayload(payload: CnrcPayload) {
  const errors: Partial<Record<keyof CnrcPayload, string>> = {};

  if (!/^\d{2}$/.test(payload.nrc1)) errors.nrc1 = "Saisissez 2 chiffres.";
  if (!["A", "D", "W1", "B", "W2", "S"].includes(payload.nrc2)) errors.nrc2 = "Selection invalide.";
  if (!/^\d{7}$/.test(payload.nrc3)) errors.nrc3 = "Saisissez 7 chiffres.";
  if (!/^\d{2}$/.test(payload.nrc4)) errors.nrc4 = "Saisissez 2 chiffres.";
  if (!wilayaOptions.some((wilaya) => wilaya.value === payload.nrc5)) errors.nrc5 = "Wilaya invalide.";

  return errors;
}

export function validateSidjilcomSearchPayload(payload: SidjilcomSearchPayload): Partial<Record<keyof SidjilcomSearchPayload, string>> {
  const searchType = payload.searchType ?? "cnrc";
  const lookupMode = payload.lookupMode ?? (searchType === "cnrc" ? "rc" : "name");
  const errors: Partial<Record<keyof SidjilcomSearchPayload, string>> = {};

  if (searchType === "cnrc") {
    return validateCnrcPayload(payload);
  }

  if (searchType === "physique") {
    if (lookupMode === "rc") {
      if (!/^\d{2}$/.test(payload.nrc1)) errors.nrc1 = "Saisissez 2 chiffres.";
      if (!["A", "D", "W1"].includes(payload.nrc2)) errors.nrc2 = "Selection PP invalide.";
      if (!/^\d{7}$/.test(payload.nrc3)) errors.nrc3 = "Saisissez 7 chiffres.";
      if (!/^\d{2}$/.test(payload.nrc4)) errors.nrc4 = "Saisissez 2 chiffres.";
      if (!wilayaOptions.some((wilaya) => wilaya.value === payload.nrc5)) errors.nrc5 = "Wilaya invalide.";
    } else {
      if (!payload.nom?.trim()) errors.nom = "Saisissez le nom.";
      if (!payload.prenom?.trim()) errors.prenom = "Saisissez le prenom.";
    }
  }

  if (searchType === "morale") {
    if (lookupMode === "rc") {
      if (!/^\d{2}$/.test(payload.nrc1)) errors.nrc1 = "Saisissez 2 chiffres.";
      if (!["B", "W2", "S"].includes(payload.nrc2)) errors.nrc2 = "Selection PM invalide.";
      if (!/^\d{7}$/.test(payload.nrc3)) errors.nrc3 = "Saisissez 7 chiffres.";
      if (!/^\d{2}$/.test(payload.nrc4)) errors.nrc4 = "Saisissez 2 chiffres.";
      if (!wilayaOptions.some((wilaya) => wilaya.value === payload.nrc5)) errors.nrc5 = "Wilaya invalide.";
    } else if (lookupMode === "name" && !payload.nomCommercial?.trim()) {
      errors.nomCommercial = "Saisissez la raison sociale.";
    } else if (lookupMode === "associate") {
      if (!payload.nom?.trim()) errors.nom = "Saisissez le nom de l'associe.";
      if (!payload.prenom?.trim()) errors.prenom = "Saisissez le prenom de l'associe.";
    } else if (lookupMode === "activity" && !payload.activite?.trim()) {
      errors.activite = "Saisissez le code ou libelle d'activite.";
    }
  }

  if (!["fr", "ar"].includes(payload.language ?? "fr")) {
    errors.language = "Langue invalide.";
  }

  return errors;
}
