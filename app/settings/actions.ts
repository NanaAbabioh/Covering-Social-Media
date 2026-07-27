"use server";

import { runSearchDiscovery } from "@/lib/discovery";
import { reclassifyBacklog } from "@/lib/reclassify";

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

/**
 * Server action for the "Reclassify backlog" button. Classifies every undecided
 * video by content type and rebuilds the queue from teaching/testimony content.
 */
export async function reclassifyBacklogNow() {
  try {
    const result = await reclassifyBacklog();
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
