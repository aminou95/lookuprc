import { directEnv } from "@/lib/direct-env";

export function serverEnv(name: string) {
  return String(process.env[name] ?? directEnv[name] ?? "").trim();
}
