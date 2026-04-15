"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";

// ─── Watch ──────────────────────────────────────────────────────────────────

export async function watchOfficeAction(officeId: string) {
  const session = await auth();
  if (!session) return { error: "You must be logged in to watch an office." };

  // Verify office exists
  const { data: officeCheck } = await db
    .from("Offices")
    .select("id, district_id")
    .eq("id", officeId)
    .maybeSingle();

  if (!officeCheck) return { error: "Office not found." };

  // Idempotent insert — ignore conflict on (user_id, office_id)
  const { error } = await db
    .from("OfficeWatches")
    .upsert(
      { user_id: session.user.id, office_id: officeId },
      { onConflict: "user_id,office_id" }
    );

  if (error) return { error: "Failed to watch. Please try again." };

  // Get updated count
  const { count } = await db
    .from("OfficeWatches")
    .select("*", { count: "exact", head: true })
    .eq("office_id", officeId);

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return { success: true, data: { watcherCount: count ?? 0 } };
}

// ─── Unwatch ────────────────────────────────────────────────────────────────

export async function unwatchOfficeAction(officeId: string) {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const { error } = await db
    .from("OfficeWatches")
    .delete()
    .eq("user_id", session.user.id)
    .eq("office_id", officeId);

  if (error) return { error: "Failed to unwatch. Please try again." };

  // Get updated count
  const { count } = await db
    .from("OfficeWatches")
    .select("*", { count: "exact", head: true })
    .eq("office_id", officeId);

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return { success: true, data: { watcherCount: count ?? 0 } };
}
