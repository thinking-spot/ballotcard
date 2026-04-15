"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeletePostAction } from "@/lib/post-actions";
import {
  pinPostAction,
  unpinPostAction,
  modDeletePostAction,
  restorePostAction,
} from "@/lib/mod-actions";
import { ReplyComposer } from "@/components/office/ReplyComposer";
import { PostEditForm } from "@/components/office/PostEditForm";

type Mode =
  | "idle"
  | "replying"
  | "editing"
  | "confirming-delete"
  | "mod-delete"
  | "confirming-restore";

interface PostActionsProps {
  postId: string;
  isOwner: boolean;
  isTopLevel: boolean;
  title?: string;
  body: string;
  isWitness?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
}

export function PostActions({
  postId,
  isOwner,
  isTopLevel,
  title,
  body,
  isWitness,
  isPinned,
  isDeleted,
}: PostActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [modReason, setModReason] = useState("");

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

  function handlePin() {
    startTransition(async () => {
      const result = isPinned
        ? await unpinPostAction(postId)
        : await pinPostAction(postId);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleModDelete() {
    if (modReason.trim().length < 5) return;
    startTransition(async () => {
      const result = await modDeletePostAction({
        postId,
        reason: modReason.trim(),
      });
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setMode("idle");
      setModReason("");
      router.refresh();
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restorePostAction(postId);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  const buttonClass =
    "text-xs font-medium text-muted-foreground hover:text-bc-navy transition-colors";
  const dangerButtonClass =
    "text-xs font-medium text-muted-foreground hover:text-destructive transition-colors";

  return (
    <div className="mt-3">
      {mode === "idle" && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Standard actions (not shown on deleted posts) */}
          {!isDeleted && (
            <>
              <button type="button" onClick={() => setMode("replying")} className={buttonClass}>
                Reply
              </button>
              {isOwner && (
                <>
                  <button type="button" onClick={() => setMode("editing")} className={buttonClass}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("confirming-delete")}
                    className={dangerButtonClass}
                  >
                    Delete
                  </button>
                </>
              )}
            </>
          )}

          {/* Witness mod actions */}
          {isWitness && !isDeleted && (
            <>
              {isTopLevel && (
                <button
                  type="button"
                  onClick={handlePin}
                  disabled={isPending}
                  className={buttonClass}
                >
                  {isPending ? "..." : isPinned ? "Unpin" : "Pin"}
                </button>
              )}
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => setMode("mod-delete")}
                  className={dangerButtonClass}
                >
                  Remove
                </button>
              )}
            </>
          )}

          {/* Restore (Witness only, on deleted posts) */}
          {isWitness && isDeleted && (
            <button
              type="button"
              onClick={() => setMode("confirming-restore")}
              className={buttonClass}
            >
              Restore
            </button>
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

      {mode === "mod-delete" && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Remove this post as Witness
          </p>
          <p className="text-xs text-amber-700 mb-2">
            This action is recorded in the public moderation log.
          </p>
          <textarea
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
            placeholder="Reason for removal (required, min 5 characters)"
            rows={2}
            className="w-full text-sm border border-amber-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 mb-2"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleModDelete}
              disabled={isPending || modReason.trim().length < 5}
              className="px-3 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Removing..." : "Remove post"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setModReason("");
              }}
              className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "confirming-restore" && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
          <p className="text-sm text-emerald-800">Restore this post?</p>
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPending}
            className="px-3 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Restoring..." : "Yes, restore"}
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
