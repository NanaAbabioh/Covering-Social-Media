import { supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/settings";
import QueryManager from "../components/QueryManager";
import ConfigEditor from "../components/ConfigEditor";
import RunDiscoveryButton from "../components/RunDiscoveryButton";
import ReclassifyButton from "../components/ReclassifyButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [{ data: queries }, config] = await Promise.all([
    supabase.from("search_queries").select("*").order("created_at"),
    getConfig(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Tune what gets discovered and how it&apos;s scored — no code changes needed.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Run discovery
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Manually run the YouTube search pipeline now (also runs daily via cron).
        </p>
        <RunDiscoveryButton />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-3 text-sm text-slate-500">
            Re-run the AI content-type classifier over everything not yet approved or
            rejected, and rebuild the queue from teaching/testimony videos only. Use
            this after changing the classifier model, or to clean up an existing backlog.
          </p>
          <ReclassifyButton />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Search queries
        </h2>
        <QueryManager queries={queries ?? []} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Scoring & queue
        </h2>
        <ConfigEditor config={config} />
      </section>
    </div>
  );
}
