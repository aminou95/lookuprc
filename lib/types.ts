export type CnrcPayload = {
  nrc1: string;
  nrc2: "A" | "D" | "W1" | "B" | "W2" | "S";
  nrc3: string;
  nrc4: string;
  nrc5: string;
};

export type SidjilcomSearchPayload = CnrcPayload & {
  searchType?: "cnrc" | "physique" | "morale";
  lookupMode?: "rc" | "name" | "associate" | "activity";
  language?: "fr" | "ar";
  nom?: string;
  prenom?: string;
  nomCommercial?: string;
  activite?: string;
};

export type CompanyResult = {
  rc: string;
  nom: string;
  prenom: string;
  adresse: string;
  statut: string;
  idCommercant?: string;
  hasSecondaires?: boolean;
  annexes?: SidjilcomAnnex[];
  detailUnavailableReason?: string;
  details?: SidjilcomDetails;
  cache?: {
    hit: boolean;
    detailsAvailable: boolean;
    checkedAt: string | null;
  };
};

export type SidjilcomLookupResult = {
  company: CompanyResult;
  results: CompanyResult[];
};

export type SidjilcomAnnex = {
  rc: string;
  wilaya: string;
  adresse: string;
  statut: string;
  idCommercant: string;
};

export type SidjilcomCompteSocial = {
  exercice: string;
  dateDepot: string;
  statut: string;
  raw: Record<string, string>;
};

export type SidjilcomDetails = {
  merchant: {
    rc: string;
    nom: string;
    prenom: string;
    nomAr: string;
    prenomAr: string;
    dateNaissance: string;
    lieuNaissance: string;
    nis: string;
    nif: string;
    etatCivil: string;
    nationalite: string;
    regimeMatrimonial: string;
    dateImmatriculation: string;
    adresse: string;
    commune: string;
    telephone: string;
    dateDebutExploitation: string;
    typeCommerce: string;
  };
  activities: {
    code: string;
    libelle: string;
  }[];
  associates: {
    nomComplet: string;
    dateNaissance: string;
    lieuNaissance: string;
    qualite: string;
    telephone: string;
    fax: string;
    nationalite: string;
  }[];
  inscription: {
    dateImmatriculation: string;
    numeroInscription: string;
    dateModification: string;
  };
  commercant: {
    nomFr: string;
    nomAr: string;
    prenomFr: string;
    prenomAr: string;
    dateNaissance: string;
    numeroActeNaissance: string;
    lieuNaissance: string;
    nis: string;
    nif: string;
    etatCivil: string;
    nationalite: string;
    regimeMatrimonial: string;
  };
  localCommercial: {
    typeCommerce: string;
    adresse: string;
    codePostal: string;
    communeWilayaInscription: string;
    nomCommercial: string;
    dateDebutExploitation: string;
    telephone: string;
    fax: string;
    email: string;
    appartenanceLocal: string;
    natureAcquisitionLocal: string;
    proprietaireLocal: string;
    natureLocation: string;
    dureeBail: string;
  };
  fondsCommerce: {
    appartenanceFonds: string;
    natureAcquisitionFonds: string;
    numeroRc: string;
    proprietaireFonds: string;
    adresseFonds: string;
    natureBail: string;
    dateDebutBail: string;
    dureeBail: string;
  };
  activitesExercees: Record<string, string>[];
  modifications: Record<string, string>[];
  rawFields: Record<string, string>;
};

export type ImportedSidjilcomDetails = {
  rawFields: Record<string, string>;
  merchant: SidjilcomDetails["merchant"];
  activities: {
    codeActivite: string;
    libelleActivite: string;
    numeroAgrement: string;
  }[];
  modifications: Record<string, string>[];
};

export type CompanyRecord = CnrcPayload &
  CompanyResult & {
    id: string;
    created_at: string;
  };
