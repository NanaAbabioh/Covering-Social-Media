"use server";

import { runSearchDiscovery } from "@/lib/discovery";

/**
 * Server action for the "Run discovery now" button. Runs entirely on the server;
 * the whole app is behind Vercel password protection, so no extra secret is
 * needed here (unlike the /api/cron/* routes, which Vercel invokes externally
 * and are guarded by CRON_SECRET).
 */
export async function runDiscoveryNow() {
  try {
    const result = await runSearchDiscovery();
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
