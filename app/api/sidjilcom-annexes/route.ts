import { NextResponse } from "next/server";
import { checkRateLimit, getCachedCompany, publicIp, upsertCompanyAnnexes } from "@/lib/cnrc-cache";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { appendAnnexes, appendSearchEvent } from "@/lib/google-sheets";
import { lookupSidjilcomAnnexes } from "@/lib/sidjilcom";
import type { SidjilcomSearchPayload } from "@/lib/types";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  let payload: SidjilcomSearchPayload;
  let nrc = "";

  try {
    const body = (await request.json()) as SidjilcomSearchPayload & { payload?: SidjilcomSearchPayload; nrc?: string };
    payload = body.payload ?? body;
    nrc = body.nrc ?? "";
  } catch {
    return jsonError("Payload JSON invalide.", 400, "VALIDATION");
  }

  const validationErrors = validateSidjilcomSearchPayload(payload);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json({ error: "Champs de recherche invalides.", code: "VALIDATION", fields: validationErrors }, { status: 400 });
  }

  const searchType = payload.searchType ?? "cnrc";
  const cached = searchType === "cnrc" ? await getCachedCompany(payload) : null;
  if (cached?.annexes?.length) {
    return NextResponse.json({ annexes: cached.annexes, cache: { hit: true } });
  }

  if (!checkRateLimit(`annexes:${publicIp(request)}`, 5, 60_000)) {
    return jsonError("Trop de demandes de secondaires. Veuillez patienter une minute.", 429, "RATE_LIMIT");
  }

  const targetNrc = nrc || cached?.rc || `${payload.nrc1}${payload.nrc2}${payload.nrc3}`;
  const lookup = await lookupSidjilcomAnnexes(payload, targetNrc);

  if (!lookup.ok) {
    return jsonError(lookup.error, lookup.status, lookup.code);
  }

  if (cached) {
    await upsertCompanyAnnexes(payload, cached, lookup.annexes);
  }

  await appendSearchEvent({
    event: "secondaires",
    payload,
    company: { rc: targetNrc },
    resultCount: lookup.annexes.length,
    metadata: { annexes: lookup.annexes }
  });
  await appendAnnexes(payload, targetNrc, lookup.annexes);

  return NextResponse.json({ annexes: lookup.annexes, cache: { hit: false } });
}
