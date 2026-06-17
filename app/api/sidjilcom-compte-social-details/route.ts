import { NextResponse } from "next/server";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { checkRateLimit, publicIp } from "@/lib/cnrc-cache";
import { appendCompteSocialDetails, appendSearchEvent } from "@/lib/google-sheets";
import { lookupSidjilcomCompteSocialDetails } from "@/lib/sidjilcom";
import type { SidjilcomSearchPayload } from "@/lib/types";

export async function POST(request: Request) {
  let body: { payload?: SidjilcomSearchPayload; nrc?: string; exercice?: string };

  try {
    body = (await request.json()) as { payload?: SidjilcomSearchPayload; nrc?: string; exercice?: string };
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide.", code: "VALIDATION" }, { status: 400 });
  }

  if (!body.payload || !body.nrc || !body.exercice) {
    return NextResponse.json({ error: "payload, nrc et exercice sont requis.", code: "VALIDATION" }, { status: 400 });
  }

  const payload = { ...body.payload, searchType: "morale" as const };
  const validationErrors = validateSidjilcomSearchPayload(payload);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json({ error: "Champs de recherche invalides.", code: "VALIDATION", fields: validationErrors }, { status: 400 });
  }

  if (!checkRateLimit(`compte-social-detail:${publicIp(request)}`, 3, 60_000)) {
    return NextResponse.json({ error: "Trop de demandes de details. Veuillez patienter une minute.", code: "RATE_LIMIT" }, { status: 429 });
  }

  const lookup = await lookupSidjilcomCompteSocialDetails(payload, body.nrc, body.exercice);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error, code: lookup.code }, { status: lookup.status });
  }

  await appendSearchEvent({
    event: "compte_social_details",
    payload,
    company: { rc: body.nrc },
    resultCount: 1,
    metadata: { exercice: lookup.exercice, rawFields: lookup.rawFields }
  });
  await appendCompteSocialDetails(payload, body.nrc, lookup.exercice, {
    details: lookup.details,
    rawFields: lookup.rawFields
  });

  return NextResponse.json({
    exercice: lookup.exercice,
    details: lookup.details,
    rawFields: lookup.rawFields
  });
}
