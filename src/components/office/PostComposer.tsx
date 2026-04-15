"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostAction } from "@/lib/post-actions";
import { MarkdownEditor } from "@/components/office/MarkdownEditor";
import { TagPicker } from "@/components/office/TagPicker";
import {
  FeaturedLinkInput,
  type OGPreview,
} from "@/components/office/FeaturedLinkInput";
import type { TagResult } from "@/lib/tag-actions";

interface PostComposerProps {
  officeId: string;
  officeHref: string;
}

export function PostComposer({ officeId, officeHref }: PostComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [ogPreview, setOgPreview] = useState<OGPreview | null>(null);
  const [selectedTags, setSelectedTags] = useState<TagResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    title.trim().length >= 5 &&
    body.trim().length >= 10 &&
    !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createPostAction({
        officeId,
        title: title.trim(),
        body: body.trim(),
        featuredLinkUrl: url.trim() || null,
        tagIds: selectedTags.map((t) => t.id),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push(officeHref);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="post-title"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Title
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A clear, specific title"
          maxLength={300}
          className="w-full px-3 py-2 text-sm rounded-md border border-bc-light-lavender bg-white outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-bc-lavender"
        />
        {title.length > 0 && title.length < 5 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            At least 5 characters ({5 - title.length} more)
          </p>
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Body
        </label>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          placeholder="Sourced, factual, specific. Link to primary sources."
        />
      </div>

      {/* Featured link */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Featured link{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <FeaturedLinkInput
          value={url}
          onChange={setUrl}
          preview={ogPreview}
          onPreview={setOgPreview}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Tags{" "}
          <span className="font-normal text-muted-foreground">
            (up to 10)
          </span>
        </label>
        <TagPicker
          selected={selectedTags}
          onChange={setSelectedTags}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="px-4 py-2 text-sm font-medium rounded bg-bc-navy text-bc-offwhite hover:bg-bc-deep-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Posting..." : "Post"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium rounded border border-bc-light-lavender text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
