import { createClient } from "@/lib/supabase/server";
import SourcesManager from "@/app/components/SourcesManager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("sources")
    .select("id, name")
    .order("name");

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Settings
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">Manage your transaction sources.</p>
      </div>

      <SourcesManager sources={sources ?? []} />
    </div>
  );
}
