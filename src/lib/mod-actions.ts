"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import {
  ModDeletePostSchema,
  ModPinPostSchema,
  ModRestorePostSchema,
} from "@/lib/validation";
import { limits } from "@/lib/rate-limit";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Verify the current user is the active Witness for the given office. */
async function verifyWitnessForOffice(
  userId: string,
  officeId: string
): Promise<boolean> {
  const { data } = await db
    .from("Witnesses")
    .select("id")
    .eq("office_id", officeId)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  return !!data;
}

/** Record a mod action in the public audit log. */
async function recordModAction(params: {
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  reason?: string;
  scopeOfficeId: string;
}) {
  await db.from("ModActions").insert({
    actor_id: params.actorId,
    target_type: params.targetType,
    target_id: params.targetId,
    action: params.action,
    reason: params.reason ?? null,
    scope_office_id: params.scopeOfficeId,
  });
}

// ─── Pin ──────────────────────────────────────────────────────────────────

export async function pinPostAction(
  postId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const parsed = ModPinPostSchema.safeParse({ postId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (!limits.modAction(session.user.id)) {
    return { error: "Too many actions. Please wait a moment." };
  }

  // Fetch the post
  const { data: post } = await db
    .from("Posts")
    .select("id, office_id, is_pinned, deleted_at, parent_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (post.deleted_at) return { error: "Cannot pin a deleted post." };
  if (post.parent_id) return { error: "Only top-level posts can be pinned." };
  if (post.is_pinned) return { error: "Post is already pinned." };

  const officeId = post.office_id as string;

  // Verify Witness authority
  if (!(await verifyWitnessForOffice(session.user.id, officeId))) {
    return { error: "Only the current Witness can pin posts." };
  }

  const { error: updateError } = await db
    .from("Posts")
    .update({ is_pinned: true })
    .eq("id", postId);

  if (updateError) return { error: "Failed to pin post. Please try again." };

  await recordModAction({
    actorId: session.user.id,
    targetType: "post",
    targetId: postId,
    action: "pin",
    scopeOfficeId: officeId,
  });

  revalidatePath("/[state]/[...slug]", "page");
  return { success: true };
}

// ─── Unpin ────────────────────────────────────────────────────────────────

export async function unpinPostAction(
  postId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const parsed = ModPinPostSchema.safeParse({ postId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (!limits.modAction(session.user.id)) {
    return { error: "Too many actions. Please wait a moment." };
  }

  const { data: post } = await db
    .from("Posts")
    .select("id, office_id, is_pinned")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (!post.is_pinned) return { error: "Post is not pinned." };

  const officeId = post.office_id as string;

  if (!(await verifyWitnessForOffice(session.user.id, officeId))) {
    return { error: "Only the current Witness can unpin posts." };
  }

  const { error: updateError } = await db
    .from("Posts")
    .update({ is_pinned: false })
    .eq("id", postId);

  if (updateError) return { error: "Failed to unpin post. Please try again." };

  await recordModAction({
    actorId: session.user.id,
    targetType: "post",
    targetId: postId,
    action: "unpin",
    scopeOfficeId: officeId,
  });

  revalidatePath("/[state]/[...slug]", "page");
  return { success: true };
}

// ─── Mod delete ───────────────────────────────────────────────────────────

export async function modDeletePostAction(input: {
  postId: string;
  reason: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const parsed = ModDeletePostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { postId, reason } = parsed.data;

  if (!limits.modAction(session.user.id)) {
    return { error: "Too many actions. Please wait a moment." };
  }

  const { data: post } = await db
    .from("Posts")
    .select("id, office_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (post.deleted_at) return { error: "Post is already deleted." };

  const officeId = post.office_id as string;

  if (!(await verifyWitnessForOffice(session.user.id, officeId))) {
    return { error: "Only the current Witness can remove posts." };
  }

  const { error: updateError } = await db
    .from("Posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) return { error: "Failed to remove post. Please try again." };

  await recordModAction({
    actorId: session.user.id,
    targetType: "post",
    targetId: postId,
    action: "soft_delete",
    reason,
    scopeOfficeId: officeId,
  });

  revalidatePath("/[state]/[...slug]", "page");
  return { success: true };
}

// ─── Restore ──────────────────────────────────────────────────────────────

export async function restorePostAction(
  postId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const parsed = ModRestorePostSchema.safeParse({ postId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (!limits.modAction(session.user.id)) {
    return { error: "Too many actions. Please wait a moment." };
  }

  const { data: post } = await db
    .from("Posts")
    .select("id, office_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (!post.deleted_at) return { error: "Post is not deleted." };

  const officeId = post.office_id as string;

  if (!(await verifyWitnessForOffice(session.user.id, officeId))) {
    return { error: "Only the current Witness can restore posts." };
  }

  const { error: updateError } = await db
    .from("Posts")
    .update({ deleted_at: null })
    .eq("id", postId);

  if (updateError) {
    return { error: "Failed to restore post. Please try again." };
  }

  await recordModAction({
    actorId: session.user.id,
    targetType: "post",
    targetId: postId,
    action: "restore",
    scopeOfficeId: officeId,
  });

  revalidatePath("/[state]/[...slug]", "page");
  return { success: true };
}
