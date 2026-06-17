import { serverEnv } from "@/lib/env";

type AppSheetActionResponse = Record<string, unknown>[];

export type AppSheetRow = Record<string, unknown>;

export function getAppSheetConfig() {
  const appId = serverEnv("APPSHEET_APP_ID");
  const accessKey = serverEnv("APPSHEET_ACCESS_KEY");
  const tableName = serverEnv("APPSHEET_TABLE_NAME") || "CONTACT";

  if (!appId || !accessKey) {
    return null;
  }

  return { appId, accessKey, tableName };
}

export async function fetchAppSheetRows(tableName?: string) {
  const config = getAppSheetConfig();

  if (!config) {
    throw new Error("APPSHEET_APP_ID et APPSHEET_ACCESS_KEY sont requis côté serveur.");
  }

  const selectedTable = encodeURIComponent(tableName || config.tableName);
  const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(config.appId)}/tables/${selectedTable}/Action`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "ApplicationAccessKey": config.accessKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      Action: "Find",
      Properties: {
        Locale: "fr-FR"
      },
      Rows: []
    }),
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`AppSheet HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as AppSheetActionResponse;
  } catch {
    throw new Error("Réponse AppSheet JSON invalide.");
  }
}
