import { NextResponse } from "next/server";
import { checkRateLimit, publicIp } from "@/lib/cnrc-cache";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { lookupSidjilcomDetailsById } from "@/lib/sidjilcom";
import type { SidjilcomSearchPayload } from "@/lib/types";

export async function POST(request: Request) {
  let body: { payload?: SidjilcomSearchPayload; idCommercant?: string };

  try {
    body = (await request.json()) as { payload?: SidjilcomSearchPayload; idCommercant?: string };
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide.", code: "VALIDATION" }, { status: 400 });
  }

  if (!body.payload || !body.idCommercant) {
    return NextResponse.json({ error: "payload et idCommercant sont requis.", code: "VALIDATION" }, { status: 400 });
  }

  const validationErrors = validateSidjilcomSearchPayload(body.payload);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json({ error: "Champs CNRC invalides.", code: "VALIDATION", fields: validationErrors }, { status: 400 });
  }

  if (!checkRateLimit(`annex-detail:${publicIp(request)}`, 3, 60_000)) {
    return NextResponse.json({ error: "Trop de demandes de details. Veuillez patienter une minute.", code: "RATE_LIMIT" }, { status: 429 });
  }

  const lookup = await lookupSidjilcomDetailsById(body.payload, body.idCommercant);

  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error, code: lookup.code }, { status: lookup.status });
  }

  return NextResponse.json({
    details: lookup.details,
    detailUnavailableReason: lookup.detailUnavailableReason
  });
}
