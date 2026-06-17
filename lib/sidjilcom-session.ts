import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const sessionFile = path.join(process.cwd(), ".sidjilcom-session.local.json");

export type SidjilcomServerSession = {
  cookie: string;
  pAuth: string;
  updatedAt: string;
};

function extractCookieFromCurl(input: string) {
  return (
    input.match(/(?:-H|--header)\s+['"]cookie:\s*([^'"]+)['"]/i)?.[1] ||
    input.match(/(?:-b|--cookie)\s+['"]([^'"]+)['"]/i)?.[1] ||
    input.match(/cookie:\s*([^\r\n]+)/i)?.[1] ||
    ""
  ).trim();
}

function extractPAuth(input: string) {
  return (
    input.match(/[?&]p_auth=([^&\s'"]+)/)?.[1] ||
    input.match(/Liferay\.authToken\s*=\s*["']([^"']+)["']/)?.[1] ||
    input.match(/SIDJILCOM_P_AUTH\s*=\s*([^\s]+)/)?.[1] ||
    ""
  ).trim();
}

export function parseSidjilcomSessionInput(input: { cookie?: string; pAuth?: string; curl?: string }) {
  const curl = input.curl ?? "";
  return {
    cookie: (input.cookie || extractCookieFromCurl(curl)).trim(),
    pAuth: (input.pAuth || extractPAuth(curl)).trim()
  };
}

export function readSidjilcomServerSession(): SidjilcomServerSession | null {
  if (!existsSync(sessionFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(sessionFile, "utf8")) as SidjilcomServerSession;
    if (!parsed.cookie || !parsed.pAuth) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSidjilcomServerSession(cookie: string, pAuth: string) {
  const session: SidjilcomServerSession = {
    cookie,
    pAuth,
    updatedAt: new Date().toISOString()
  };

  await writeFile(sessionFile, JSON.stringify(session, null, 2), "utf8");
  return session;
}
