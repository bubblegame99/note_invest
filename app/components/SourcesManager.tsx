"use client";

import { useActionState, useTransition } from "react";
import { addSource, deleteSource } from "@/app/actions/sources";

type Source = { id: string; name: string };

export default function SourcesManager({ sources }: { sources: Source[] }) {
  const [state, action, pending] = useActionState(addSource, null);
  const [isDeleting, startDelete] = useTransition();

  return (
    <div className="space-y-6">
      {/* Add source form */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Add Source
        </h3>
        <form action={action} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="e.g. Personal Research"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </form>
        {state?.error && (
          <p className="mt-1 text-xs text-red-500">{state.error}</p>
        )}
      </div>

      {/* Source list */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Your Sources
        </h3>
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-400">No sources yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{s.name}</span>
                <button
                  disabled={isDeleting}
                  onClick={() => startDelete(() => deleteSource(s.id))}
                  className="text-xs text-zinc-400 transition-colors hover:text-red-500 disabled:opacity-40"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
