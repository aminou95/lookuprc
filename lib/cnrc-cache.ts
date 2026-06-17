import { getSupabaseAdmin } from "@/lib/supabase";
import type { CnrcPayload, CompanyResult, SidjilcomAnnex, SidjilcomDetails } from "@/lib/types";

export function cnrcKey(payload: CnrcPayload) {
  return `${payload.nrc1}${payload.nrc2}${payload.nrc3}${payload.nrc4}${payload.nrc5}`.toUpperCase();
}

export function publicIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

const rateHits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (rateHits.get(key) ?? []).filter((time) => now - time < windowMs);

  if (recent.length >= limit) {
    return false;
  }

  recent.push(now);
  rateHits.set(key, recent);
  return true;
}

export async function getCachedCompany(payload: CnrcPayload) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const key = cnrcKey(payload);

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("cnrc_key", key)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const normalizedRc = String(data.rc ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (normalizedRc && normalizedRc !== key && !key.startsWith(normalizedRc) && !normalizedRc.startsWith(key)) {
    return null;
  }
  if (!data.nom && !data.prenom && !data.adresse && !data.statut && !data.details) {
    return null;
  }

  return {
    rc: data.rc ?? "",
    nom: data.nom ?? "",
    prenom: data.prenom ?? "",
    adresse: data.adresse ?? "",
    statut: data.statut ?? "",
    idCommercant: data.id_commercant ?? undefined,
    hasSecondaires: Boolean(data.has_secondaires),
    details: data.details ?? undefined,
    annexes: data.annexes ?? undefined,
    cache: {
      hit: true,
      detailsAvailable: Boolean(data.details_checked_at),
      checkedAt: data.updated_at ?? data.created_at
    }
  } as CompanyResult & {
    cache: { hit: boolean; detailsAvailable: boolean; checkedAt: string | null };
  };
}

export async function upsertCompanySummary(payload: CnrcPayload, company: CompanyResult) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("companies").upsert(
    {
      ...payload,
      cnrc_key: cnrcKey(payload),
      rc: company.rc,
      nom: company.nom,
      prenom: company.prenom,
      adresse: company.adresse,
      statut: company.statut,
      id_commercant: company.idCommercant ?? null,
      has_secondaires: Boolean(company.hasSecondaires),
      updated_at: new Date().toISOString()
    },
    { onConflict: "cnrc_key" }
  );
}

export async function upsertCompanyAnnexes(payload: CnrcPayload, company: CompanyResult, annexes: SidjilcomAnnex[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("companies").upsert(
    {
      ...payload,
      cnrc_key: cnrcKey(payload),
      rc: company.rc,
      nom: company.nom,
      prenom: company.prenom,
      adresse: company.adresse,
      statut: company.statut,
      id_commercant: company.idCommercant ?? null,
      has_secondaires: annexes.length > 0,
      annexes,
      annexes_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "cnrc_key" }
  );
}

export async function upsertCompanyDetails(payload: CnrcPayload, company: CompanyResult, details: SidjilcomDetails) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("companies").upsert(
    {
      ...payload,
      cnrc_key: cnrcKey(payload),
      rc: company.rc,
      nom: company.nom,
      prenom: company.prenom,
      adresse: company.adresse,
      statut: company.statut,
      id_commercant: company.idCommercant ?? null,
      merchant: details.merchant,
      activities: details.activities,
      modifications: details.modifications,
      details,
      details_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "cnrc_key" }
  );
}
