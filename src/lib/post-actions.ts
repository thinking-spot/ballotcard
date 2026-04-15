"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { CreatePostSchema } from "@/lib/validation";
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
