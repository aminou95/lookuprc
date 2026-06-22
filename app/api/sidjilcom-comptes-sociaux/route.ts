import { NextResponse } from "next/server";
import { validateSidjilcomSearchPayload } from "@/lib/cnrc";
import { checkRateLimit, publicIp } from "@/lib/cnrc-cache";
import { appendComptesSociaux, appendSearchEvent, getGoogleCachedComptesSociaux } from "@/lib/google-sheets";
import { lookupSidjilcomComptesSociaux } from "@/lib/sidjilcom";
import type { SidjilcomSearchPayload } from "@/lib/types";

export async function POST(request: Request) {
  let body: { payload?: SidjilcomSearchPayload; nrc?: string };

  try {
    body = (await request.json()) as { payload?: SidjilcomSearchPayload; nrc?: string };
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide.", code: "VALIDATION" }, { status: 400 });
  }

  if (!body.payload || !body.nrc) {
    return NextResponse.json({ error: "payload et nrc sont requis.", code: "VALIDATION" }, { status: 400 });
  }

  const payload = { ...body.payload, searchType: "morale" as const };
  const validationErrors = validateSidjilcomSearchPayload(payload);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json({ error: "Champs de recherche invalides.", code: "VALIDATION", fields: validationErrors }, { status: 400 });
  }

  const googleCached = await getGoogleCachedComptesSociaux(body.nrc);
  if (googleCached?.comptesSociaux?.length) {
    return NextResponse.json({
      comptesSociaux: googleCached.comptesSociaux,
      cache: googleCached.cache
    });
  }

  if (!checkRateLimit(`comptes-sociaux:${publicIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Trop de demandes de comptes sociaux. Veuillez patienter une minute.", code: "RATE_LIMIT" }, { status: 429 });
  }

  const lookup = await lookupSidjilcomComptesSociaux(payload, body.nrc);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error, code: lookup.code }, { status: lookup.status });
  }

  await appendSearchEvent({
    event: "comptes_sociaux",
    payload,
    company: { rc: body.nrc },
    resultCount: lookup.comptesSociaux.length,
    metadata: { comptesSociaux: lookup.comptesSociaux }
  });
  await appendComptesSociaux(payload, body.nrc, lookup.comptesSociaux);

  return NextResponse.json({ comptesSociaux: lookup.comptesSociaux });
}
