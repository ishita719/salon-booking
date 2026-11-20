import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Reads a secret/setting from .env (local) or Cloudflare variables/secrets (production). */
export function getEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  try {
    const v = (getCloudflareContext().env as unknown as Record<string, unknown>)[name];
    return typeof v === "string" && v ? v : undefined;
  } catch {
    return undefined;
  }
}
