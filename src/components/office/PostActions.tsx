"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeletePostAction } from "@/lib/post-actions";
import { ReplyComposer } from "@/components/office/ReplyComposer";
import { PostEditForm } from "@/components/office/PostEditForm";

interface PostActionsProps {
  postId: string;
  isOwner: boolean;
  isTopLevel: boolean;
  title?: string;
  body: string;
}

export function PostActions({
  postId,
  isOwner,
  isTopLevel,
  title,
  body,
}: PostActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "replying" | "editing" | "confirming-delete">("idle");

  function handleDelete() {
    startTransition(async () => {
      const result = await softDeletePostAction(postId);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      {mode === "idle" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("replying")}
            className="text-xs font-medium text-muted-foreground hover:text-bc-navy transition-colors"
          >
            Reply
          </button>
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setMode("editing")}
                className="text-xs font-medium text-muted-foreground hover:text-bc-navy transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("confirming-delete")}
                className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {mode === "replying" && (
        <div className="mt-3">
          <ReplyComposer
            parentPostId={postId}
            onCancel={() => setMode("idle")}
          />
        </div>
      )}

      {mode === "editing" && (
        <div className="mt-3">
          <PostEditForm
            postId={postId}
            initialTitle={title}
            initialBody={body}
            isTopLevel={isTopLevel}
            onCancel={() => setMode("idle")}
          />
        </div>
      )}

      {mode === "confirming-delete" && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-destructive">Delete this post?</p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-3 py-1 text-xs font-medium rounded bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
