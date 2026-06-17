import { NextResponse } from "next/server";
import { getGoogleSheetCompanies, isGoogleSheetsConfigured } from "@/lib/google-sheets";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    if (isGoogleSheetsConfigured()) {
      const companies = await getGoogleSheetCompanies();
      return NextResponse.json({ companies: companies ?? [], warning: "Historique charge depuis Google Sheets." });
    }

    return NextResponse.json({ companies: [], warning: "Supabase et Google Sheets ne sont pas configures cote serveur." });
  }

  const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Impossible de charger l'historique." }, { status: 500 });
  }

  return NextResponse.json({ companies: data ?? [] });
}
