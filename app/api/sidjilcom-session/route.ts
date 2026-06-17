import { NextResponse } from "next/server";
import {
  PRIVATE_SIDJILCOM_ADMIN_KEY,
  PRIVATE_SIDJILCOM_COOKIE,
  PRIVATE_SIDJILCOM_P_AUTH
} from "@/lib/private-sidjilcom-config";
import {
  parseSidjilcomSessionInput,
  readSidjilcomServerSession,
  writeSidjilcomServerSession
} from "@/lib/sidjilcom-session";
import { serverEnv } from "@/lib/env";

function isAuthorized(request: Request) {
  const adminKey = serverEnv("SIDJILCOM_ADMIN_KEY") || PRIVATE_SIDJILCOM_ADMIN_KEY;

  if (!adminKey) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("x-admin-key") === adminKey;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acces non autorise." }, { status: 401 });
  }

  const session = readSidjilcomServerSession();
  const hasEnvSession = Boolean(
    (serverEnv("SIDJILCOM_COOKIE") || PRIVATE_SIDJILCOM_COOKIE) && (serverEnv("SIDJILCOM_P_AUTH") || PRIVATE_SIDJILCOM_P_AUTH)
  );

  return NextResponse.json({
    configured: Boolean(session) || hasEnvSession,
    source: session ? "local" : hasEnvSession ? "environment" : null,
    updatedAt: session?.updatedAt ?? null
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acces non autorise." }, { status: 401 });
  }

  let body: { cookie?: string; pAuth?: string; curl?: string };

  try {
    body = (await request.json()) as { cookie?: string; pAuth?: string; curl?: string };
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const parsed = parseSidjilcomSessionInput(body);
  const cookie = parsed.cookie;
  const pAuth = parsed.pAuth || serverEnv("SIDJILCOM_P_AUTH") || "";

  if (!cookie) {
    return NextResponse.json(
      {
        error: "Collez une requete cURL contenant le cookie Sidjilcom, ou renseignez le champ Cookie."
      },
      { status: 400 }
    );
  }

  if (!pAuth) {
    return NextResponse.json(
      {
        error: "p_auth est manquant. Renseignez le champ p_auth ou gardez SIDJILCOM_P_AUTH dans .env.local."
      },
      { status: 400 }
    );
  }

  const session = await writeSidjilcomServerSession(cookie, pAuth);

  return NextResponse.json({
    configured: true,
    updatedAt: session.updatedAt
  });
}
