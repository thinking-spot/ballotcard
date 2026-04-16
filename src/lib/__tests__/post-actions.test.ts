import { describe, it, expect } from "vitest";
import {
  q,
  loginAsTestUser,
  getInserts,
  getUpdates,
  TEST_USER,
} from "@/test-utils/helpers";
import {
  createPostAction,
  createReplyAction,
  editPostAction,
  softDeletePostAction,
} from "@/lib/post-actions";

// ── createPostAction ────────────────────────────────────────────────────────

describe("createPostAction", () => {
  const validInput = {
    officeId: "00000000-0000-0000-0000-000000000010",
    title: "A valid post title here",
    body: "This is the body of the post, meeting the minimum length requirement.",
    tagIds: [] as string[],
  };

  it("requires authentication", async () => {
    const result = await createPostAction(validInput);
    expect(result).toEqual({ error: "You must be logged in to post." });
  });

  it("rejects invalid input (title too short)", async () => {
    loginAsTestUser();
    const result = await createPostAction({ ...validInput, title: "Hi" });
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("at least 5 characters");
  });

  it("rejects nonexistent office", async () => {
    loginAsTestUser();
    q(null); // office not found

    const result = await createPostAction(validInput);
    expect(result).toEqual({ error: "Office not found." });
  });

  it("creates post (non-witness)", async () => {
    loginAsTestUser();
    q({ id: "o-001" }); // office exists
    q(null); // not a witness
    q({ id: "post-new" }); // inserted post

    const result = await createPostAction(validInput);
    expect(result).toEqual({ success: true, data: { postId: "post-new" } });

    const inserts = getInserts("Posts");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].row as any).is_witness_post).toBe(false);
  });

  it("marks witness posts correctly", async () => {
    loginAsTestUser();
    q({ id: "o-001" }); // office exists
    q({ id: "w-001" }); // is current witness
    q({ id: "post-new" }); // inserted post

    const result = await createPostAction(validInput);
    expect(result).toHaveProperty("success", true);

    const inserts = getInserts("Posts");
    expect((inserts[0].row as any).is_witness_post).toBe(true);
  });

  it("rejects invalid tags", async () => {
    loginAsTestUser();
    q({ id: "o-001" }); // office exists
    q([{ id: "t-001" }]); // only 1 tag found, but 2 requested

    const result = await createPostAction({
      ...validInput,
      tagIds: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ],
    });
    expect(result).toEqual({ error: "One or more tags are invalid." });
  });

  it("creates post with tags", async () => {
    loginAsTestUser();
    q({ id: "o-001" }); // office exists
    q([
      { id: "00000000-0000-0000-0000-000000000001" },
      { id: "00000000-0000-0000-0000-000000000002" },
    ]); // both tags valid
    q(null); // not a witness
    q({ id: "post-tagged" }); // inserted post
    q(null); // PostTags insert

    const result = await createPostAction({
      ...validInput,
      tagIds: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ],
    });
    expect(result).toEqual({
      success: true,
      data: { postId: "post-tagged" },
    });

    const tagInserts = getInserts("PostTags");
    expect(tagInserts).toHaveLength(1);
    expect((tagInserts[0].row as any)).toHaveLength(2);
  });
});

// ── createReplyAction ───────────────────────────────────────────────────────

describe("createReplyAction", () => {
  const validInput = {
    parentPostId: "00000000-0000-0000-0000-000000000020",
    body: "A reply to the post.",
  };

  it("requires authentication", async () => {
    const result = await createReplyAction(validInput);
    expect(result).toEqual({ error: "You must be logged in to reply." });
  });

  it("rejects reply to nonexistent post", async () => {
    loginAsTestUser();
    q(null); // parent not found

    const result = await createReplyAction(validInput);
    expect(result).toEqual({ error: "Parent post not found." });
  });

  it("rejects reply to deleted post", async () => {
    loginAsTestUser();
    q({
      id: "p-parent",
      office_id: "o-001",
      deleted_at: "2026-01-01T00:00:00Z",
    });

    const result = await createReplyAction(validInput);
    expect(result).toEqual({ error: "Cannot reply to a deleted post." });
  });

  it("creates reply successfully", async () => {
    loginAsTestUser();
    q({ id: "p-parent", office_id: "o-001", deleted_at: null }); // parent post
    q(null); // not a witness
    q({ id: "reply-new" }); // inserted reply

    const result = await createReplyAction(validInput);
    expect(result).toEqual({ success: true, data: { postId: "reply-new" } });
  });
});

// ── editPostAction ──────────────────────────────────────────────────────────

describe("editPostAction", () => {
  const validInput = {
    postId: "00000000-0000-0000-0000-000000000030",
    body: "Updated body content here.",
  };

  it("requires authentication", async () => {
    const result = await editPostAction(validInput);
    expect(result).toEqual({ error: "You must be logged in to edit." });
  });

  it("rejects edit by non-author", async () => {
    loginAsTestUser();
    q({
      id: "p-001",
      author_id: "other-user",
      title: "Title",
      body: "Body",
      parent_id: null,
      deleted_at: null,
    });

    const result = await editPostAction(validInput);
    expect(result).toEqual({ error: "You can only edit your own posts." });
  });

  it("rejects edit of deleted post", async () => {
    loginAsTestUser();
    q({
      id: "p-001",
      author_id: TEST_USER.id,
      title: "Title",
      body: "Body",
      parent_id: null,
      deleted_at: "2026-01-01T00:00:00Z",
    });

    const result = await editPostAction(validInput);
    expect(result).toEqual({ error: "Cannot edit a deleted post." });
  });

  it("saves revision and updates post", async () => {
    loginAsTestUser();
    q({
      id: "p-001",
      author_id: TEST_USER.id,
      title: "Old title",
      body: "Old body",
      parent_id: null,
      deleted_at: null,
    }); // fetch post
    q(null); // insert revision
    q(null); // update post

    const result = await editPostAction({
      ...validInput,
      title: "New title",
    });
    expect(result).toEqual({ success: true });

    const revisionInserts = getInserts("PostRevisions");
    expect(revisionInserts).toHaveLength(1);
    expect((revisionInserts[0].row as any).body).toBe("Old body");
  });
});

// ── softDeletePostAction ────────────────────────────────────────────────────

describe("softDeletePostAction", () => {
  it("requires authentication", async () => {
    const result = await softDeletePostAction("p-001");
    expect(result).toEqual({ error: "You must be logged in." });
  });

  it("rejects if post not found", async () => {
    loginAsTestUser();
    q(null);

    const result = await softDeletePostAction("p-001");
    expect(result).toEqual({ error: "Post not found." });
  });

  it("rejects if already deleted", async () => {
    loginAsTestUser();
    q({
      id: "p-001",
      author_id: TEST_USER.id,
      deleted_at: "2026-01-01T00:00:00Z",
    });

    const result = await softDeletePostAction("p-001");
    expect(result).toEqual({ error: "Post is already deleted." });
  });

  it("rejects if not author", async () => {
    loginAsTestUser();
    q({ id: "p-001", author_id: "other-user", deleted_at: null });

    const result = await softDeletePostAction("p-001");
    expect(result).toEqual({ error: "You can only delete your own posts." });
  });

  it("soft-deletes post", async () => {
    loginAsTestUser();
    q({ id: "p-001", author_id: TEST_USER.id, deleted_at: null });
    q(null); // update success

    const result = await softDeletePostAction("p-001");
    expect(result).toEqual({ success: true });

    const updates = getUpdates("Posts");
    expect(updates).toHaveLength(1);
    expect((updates[0].row as any).deleted_at).toBeTruthy();
  });
});
