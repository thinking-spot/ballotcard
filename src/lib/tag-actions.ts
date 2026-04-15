"use server";

import { db } from "@/lib/supabase";

export type TagResult = {
  id: string;
  kind: string;
  label: string;
  refId?: string;
};

/**
 * Search tags by label prefix. Returns up to 10 matches.
 * Public — no auth required.
 */
export async function searchTagsAction(
  query: string,
  kind?: string
): Promise<{ success: true; data: TagResult[] } | { error: string }> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { success: true, data: [] };
  if (trimmed.length > 100) return { error: "Query too long." };

  let q = db
    .from("Tags")
    .select("id, kind, label, ref_id")
    .ilike("label", `%${trimmed}%`)
    .order("label")
    .limit(10);

  if (kind) {
    q = q.eq("kind", kind);
  }

  const { data, error } = await q;

  if (error) return { error: "Failed to search tags." };

  return {
    success: true,
    data: (data ?? []).map((t) => ({
      id: t.id as string,
      kind: t.kind as string,
      label: t.label as string,
      refId: (t.ref_id as string) || undefined,
    })),
  };
}
