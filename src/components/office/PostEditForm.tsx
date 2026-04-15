"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editPostAction } from "@/lib/post-actions";
import { MarkdownEditor } from "@/components/office/MarkdownEditor";

interface PostEditFormProps {
  postId: string;
  initialTitle?: string;
  initialBody: string;
  isTopLevel: boolean;
  onCancel: () => void;
}

export function PostEditForm({
  postId,
  initialTitle,
  initialBody,
  isTopLevel,
  onCancel,
}: PostEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    body.trim().length >= 1 &&
    (!isTopLevel || title.trim().length >= 5) &&
    !isPending;

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const result = await editPostAction({
        postId,
        title: isTopLevel ? title.trim() : undefined,
        body: body.trim(),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.refresh();
      onCancel();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isTopLevel && (
        <div>
          <label
            htmlFor="edit-title"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            className="w-full px-3 py-2 text-sm rounded-md border border-bc-light-lavender bg-white outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-bc-lavender"
          />
        </div>
      )}

      <MarkdownEditor
        value={body}
        onChange={setBody}
        minLength={1}
        maxLength={isTopLevel ? 50000 : 20000}
        placeholder="Edit your post..."
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className="px-4 py-1.5 text-sm font-medium rounded bg-bc-navy text-bc-offwhite hover:bg-bc-deep-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save edit"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm font-medium rounded border border-bc-light-lavender text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
