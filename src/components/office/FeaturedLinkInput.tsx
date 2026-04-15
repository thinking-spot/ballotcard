"use client";

import { useState, useRef, useCallback } from "react";
import { FeaturedLinkCard } from "@/components/office/FeaturedLinkCard";

interface FeaturedLinkInputProps {
  value: string;
  onChange: (url: string) => void;
  preview: OGPreview | null;
  onPreview: (preview: OGPreview | null) => void;
}

export type OGPreview = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
  fetchStatus: string;
};

export function FeaturedLinkInput({
  value,
  onChange,
  preview,
  onPreview,
}: FeaturedLinkInputProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchPreview = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        onPreview(null);
        return;
      }

      // Basic URL validation
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Only http and https URLs are supported.");
          return;
        }
      } catch {
        setError(null);
        onPreview(null);
        return;
      }

      setIsFetching(true);
      setError(null);

      try {
        const res = await fetch("/api/og-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          setError("Failed to fetch preview.");
          onPreview(null);
          return;
        }

        const data = await res.json();
        onPreview(data);
      } catch {
        setError("Failed to fetch preview.");
        onPreview(null);
      } finally {
        setIsFetching(false);
      }
    },
    [onPreview]
  );

  function handleChange(newUrl: string) {
    onChange(newUrl);
    clearTimeout(debounceRef.current);

    if (!newUrl.trim()) {
      onPreview(null);
      setError(null);
      return;
    }

    // Debounce preview fetch
    debounceRef.current = setTimeout(() => fetchPreview(newUrl), 600);
  }

  function handleClear() {
    onChange("");
    onPreview(null);
    setError(null);
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="https://example.com/article"
          className="flex-1 px-3 py-2 text-sm rounded-md border border-bc-light-lavender bg-white outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-bc-lavender"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 text-muted-foreground hover:text-foreground text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {isFetching && (
        <p className="mt-2 text-xs text-muted-foreground">
          Fetching preview...
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      {preview && !isFetching && (
        <div className="mt-2">
          <FeaturedLinkCard link={preview} />
        </div>
      )}
    </div>
  );
}
