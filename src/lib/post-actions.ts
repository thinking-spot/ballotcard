"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { CreatePostSchema, CreateReplySchema, EditPostSchema } from "@/lib/validation";
import { limits } from "@/lib/rate-limit";
import { fetchOpenGraph } from "@/lib/og-fetch";

export async function createPostAction(input: {
  officeId: string;
  title: string;
  body: string;
  featuredLinkUrl?: string | null;
  tagIds: string[];
}): Promise<{ success: true; data: { postId: string } } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in to post." };

  // Validate input
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { officeId, title, body, featuredLinkUrl, tagIds } = parsed.data;

  // Rate limit
  if (!limits.createPost(session.user.id)) {
    return { error: "You're posting too fast. Please wait a moment." };
  }

  // Verify office exists
  const { data: office } = await db
    .from("Offices")
    .select("id")
    .eq("id", officeId)
    .maybeSingle();

  if (!office) return { error: "Office not found." };

  // Verify tags exist (if any)
  if (tagIds.length > 0) {
    const { data: validTags } = await db
      .from("Tags")
      .select("id")
      .in("id", tagIds);

    if (!validTags || validTags.length !== tagIds.length) {
      return { error: "One or more tags are invalid." };
    }
  }

  // Check if author is current Witness for this office
  const { data: witness } = await db
    .from("Witnesses")
    .select("id")
    .eq("office_id", officeId)
    .eq("user_id", session.user.id)
    .eq("is_current", true)
    .maybeSingle();

  const isWitnessPost = !!witness;

  // Fetch OG metadata if URL provided
  let ogData: Awaited<ReturnType<typeof fetchOpenGraph>> | null = null;
  if (featuredLinkUrl) {
    if (!limits.ogFetch(session.user.id)) {
      return { error: "Too many link previews. Please wait." };
    }
    ogData = await fetchOpenGraph(featuredLinkUrl);
  }

  // Insert post
  const postRow: Record<string, unknown> = {
    author_id: session.user.id,
    office_id: officeId,
    title,
    body,
    is_witness_post: isWitnessPost,
  };

  if (ogData) {
    postRow.featured_link_url = ogData.url;
    postRow.featured_link_title = ogData.title ?? null;
    postRow.featured_link_description = ogData.description ?? null;
    postRow.featured_link_image_url = ogData.imageUrl ?? null;
    postRow.featured_link_domain = ogData.domain ?? null;
    postRow.featured_link_published_at = ogData.publishedAt ?? null;
    postRow.featured_link_fetched_at = new Date().toISOString();
    postRow.featured_link_fetch_status = ogData.fetchStatus;
  }

  const { data: newPost, error: insertError } = await db
    .from("Posts")
    .insert(postRow)
    .select("id")
    .single();

  if (insertError || !newPost) {
    return { error: "Failed to create post. Please try again." };
  }

  const postId = newPost.id as string;

  // Insert post-tag associations
  if (tagIds.length > 0) {
    const postTagRows = tagIds.map((tagId) => ({
      post_id: postId,
      tag_id: tagId,
    }));

    await db.from("PostTags").insert(postTagRows);
  }

  revalidatePath("/[state]/[...slug]", "page");

  return { success: true, data: { postId } };
}

// ─── Reply ─────────────────────────────────────────────────────────────────

export async function createReplyAction(input: {
  parentPostId: string;
  body: string;
}): Promise<{ success: true; data: { postId: string } } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in to reply." };

  const parsed = CreateReplySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { parentPostId, body } = parsed.data;

  if (!limits.createReply(session.user.id)) {
    return { error: "You're replying too fast. Please wait a moment." };
  }

  // Fetch parent post to get office_id
  const { data: parentPost } = await db
    .from("Posts")
    .select("id, office_id, deleted_at")
    .eq("id", parentPostId)
    .maybeSingle();

  if (!parentPost) return { error: "Parent post not found." };
  if (parentPost.deleted_at) return { error: "Cannot reply to a deleted post." };

  const officeId = parentPost.office_id as string;

  // Check if author is current Witness for this office
  const { data: witness } = await db
    .from("Witnesses")
    .select("id")
    .eq("office_id", officeId)
    .eq("user_id", session.user.id)
    .eq("is_current", true)
    .maybeSingle();

  const { data: newReply, error: insertError } = await db
    .from("Posts")
    .insert({
      author_id: session.user.id,
      parent_id: parentPostId,
      office_id: officeId,
      body,
      is_witness_post: !!witness,
    })
    .select("id")
    .single();

  if (insertError || !newReply) {
    return { error: "Failed to post reply. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");

  return { success: true, data: { postId: newReply.id as string } };
}

// ─── Edit ──────────────────────────────────────────────────────────────────

export async function editPostAction(input: {
  postId: string;
  title?: string;
  body: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in to edit." };

  const parsed = EditPostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { postId, title, body } = parsed.data;

  // Fetch current post
  const { data: post } = await db
    .from("Posts")
    .select("id, author_id, title, body, parent_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (post.deleted_at) return { error: "Cannot edit a deleted post." };
  if (post.author_id !== session.user.id) {
    return { error: "You can only edit your own posts." };
  }

  // Save current state as a revision before applying the edit
  await db.from("PostRevisions").insert({
    post_id: postId,
    author_id: session.user.id,
    title: (post.title as string) ?? null,
    body: post.body as string,
  });

  // Apply the edit
  const updateFields: Record<string, unknown> = {
    body,
    updated_at: new Date().toISOString(),
  };

  // Only top-level posts have titles
  if (!post.parent_id) {
    updateFields.title = title ?? null;
  }

  const { error: updateError } = await db
    .from("Posts")
    .update(updateFields)
    .eq("id", postId);

  if (updateError) {
    return { error: "Failed to save edit. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");

  return { success: true };
}

// ─── Soft delete ───────────────────────────────────────────────────────────

export async function softDeletePostAction(
  postId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const { data: post } = await db
    .from("Posts")
    .select("id, author_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (post.deleted_at) return { error: "Post is already deleted." };
  if (post.author_id !== session.user.id) {
    return { error: "You can only delete your own posts." };
  }

  const { error: updateError } = await db
    .from("Posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    return { error: "Failed to delete post. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");

  return { success: true };
}
