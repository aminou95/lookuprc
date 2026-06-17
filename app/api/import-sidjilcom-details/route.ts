import { NextResponse } from "next/server";
import { parseImportedSidjilcomDetails } from "@/lib/sidjilcom";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  let body: { html?: string };

  try {
    body = (await request.json()) as { html?: string };
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  if (!body.html || body.html.trim().length < 50) {
    return NextResponse.json({ error: "Collez le HTML complet de la page détails Sidjilcom." }, { status: 400 });
  }

  const details = parseImportedSidjilcomDetails(body.html);
  const rc = details.merchant.rc || details.rawFields.RC || "";
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error } = await supabase.from("sidjilcom_detail_imports").insert({
      rc,
      merchant: details.merchant,
      activities: details.activities,
      modifications: details.modifications,
      raw_fields: details.rawFields
    });

    if (error) {
      return NextResponse.json({
        ...details,
        warning: "Détails extraits, mais l'enregistrement Supabase a échoué."
      });
    }
  }

  return NextResponse.json(details);
}
