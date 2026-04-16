"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReplyAction } from "@/lib/post-actions";
import { MarkdownEditor } from "@/components/office/MarkdownEditor";

interface ReplyComposerProps {
  parentPostId: string;
  onCancel?: () => void;
}

export function ReplyComposer({ parentPostId, onCancel }: ReplyComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValid = body.trim().length >= 1 && !isPending;

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const result = await createReplyAction({
        parentPostId,
        body: body.trim(),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setBody("");
      router.refresh();
      onCancel?.();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <MarkdownEditor
        value={body}
        onChange={setBody}
        minLength={1}
        maxLength={20000}
        placeholder="Write a reply..."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className="px-4 py-1.5 text-sm font-medium rounded bg-bc-navy text-bc-offwhite hover:bg-bc-deep-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Replying..." : "Reply"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm font-medium rounded border border-bc-light-lavender text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
