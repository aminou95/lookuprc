import { directEnv } from "@/lib/direct-env";

export function serverEnv(name: string) {
  return process.env[name] ?? directEnv[name] ?? "";
}
