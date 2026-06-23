import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const localSessionFile = path.join(process.cwd(), ".sidjilcom-session.local.json");
const tempSessionFile = path.join(os.tmpdir(), ".sidjilcom-session.local.json");

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
  const multipartEscapedMatch = input.match(new RegExp(String.raw`name=["']p_auth["'][\s\S]{0,200}?\\r\\n\\r\\n([^\\'"]+)`));
  const multipartLiteralMatch = input.match(new RegExp(String.raw`name=["']p_auth["'][\s\S]{0,200}?\r\n\r\n([^\r\n'"]+)`));

  return (
    input.match(/[?&]p_auth=([^&\s'"]+)/)?.[1] ||
    multipartEscapedMatch?.[1] ||
    multipartLiteralMatch?.[1] ||
    input.match(/(?:^|[?&'"\s])p_auth=([^&\s'"]+)/)?.[1] ||
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

function chooseSessionFile() {
  return existsSync(localSessionFile) ? localSessionFile : tempSessionFile;
}

export function readSidjilcomServerSession(): SidjilcomServerSession | null {
  const sessionFile = chooseSessionFile();
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

  const preferredPath = localSessionFile;
  try {
    await writeFile(preferredPath, JSON.stringify(session, null, 2), "utf8");
    return session;
  } catch (error) {
    console.warn(
      "SIDJILCOM SESSION WRITE FAILED, falling back to temp directory:",
      error instanceof Error ? error.message : error
    );
  }

  await writeFile(tempSessionFile, JSON.stringify(session, null, 2), "utf8");
  return session;
}
