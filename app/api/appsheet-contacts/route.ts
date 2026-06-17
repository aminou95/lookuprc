import { NextResponse } from "next/server";
import { fetchAppSheetRows } from "@/lib/appsheet";
import { cnrcPayloadFromRow } from "@/lib/rc-parser";

export async function GET() {
  try {
    const rows = await fetchAppSheetRows();

    return NextResponse.json({
      count: rows.length,
      contacts: rows.map((row) => ({
        row,
        cnrc: cnrcPayloadFromRow(row)
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur AppSheet inconnue."
      },
      { status: 500 }
    );
  }
}
