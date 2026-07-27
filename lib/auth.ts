import "server-only";
import { NextRequest } from "next/server";

/**
 * Guards cron + admin endpoints. Vercel Cron sends the CRON_SECRET as a Bearer
 * token automatically when it's set as an env var. We also accept it as an
 * `?secret=` query param so the "Run discovery now" button and manual curl tests
 * work without setting a header.
 */
export function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}
