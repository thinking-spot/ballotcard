"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchTagsAction, type TagResult } from "@/lib/tag-actions";
import { TagPill } from "@/components/ui/TagPill";

interface TagPickerProps {
  selected: TagResult[];
  onChange: (tags: TagResult[]) => void;
  max?: number;
}

export function TagPicker({ selected, onChange, max = 10 }: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const res = await searchTagsAction(q);
    if ("success" in res) {
      setResults(res.data);
      setIsOpen(res.data.length > 0);
      setActiveIndex(-1);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  function addTag(tag: TagResult) {
    if (selected.length >= max) return;
    if (selected.some((t) => t.id === tag.id)) return;
    onChange([...selected, tag]);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(id: string) {
    onChange(selected.filter((t) => t.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      addTag(results[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      removeTag(selected[selected.length - 1].id);
    }
  }

  // Filter out already-selected tags from results
  const filtered = results.filter(
    (r) => !selected.some((s) => s.id === r.id)
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-bc-light-lavender bg-white min-h-[38px]">
        {selected.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1">
            <TagPill
              label={tag.kind !== "issue" ? `${tag.kind}: ${tag.label}` : tag.label}
              className={tag.kind === "official" ? "bg-amber-100 text-amber-900" : tag.kind === "district" ? "bg-sky-100 text-sky-900" : undefined}
            />
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="text-muted-foreground hover:text-foreground text-xs leading-none"
              aria-label={`Remove ${tag.label}`}
            >
              &times;
            </button>
          </span>
        ))}
        {selected.length < max && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (filtered.length > 0) setIsOpen(true);
            }}
            onBlur={() => {
              // Delay to allow click on dropdown
              setTimeout(() => setIsOpen(false), 150);
            }}
            placeholder={selected.length === 0 ? "Search tags..." : ""}
            className="flex-1 min-w-[60px] text-sm outline-none bg-transparent placeholder:text-muted-foreground"
          />
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 w-full bg-white border border-bc-light-lavender rounded-md shadow-sm max-h-48 overflow-y-auto"
          role="listbox"
        >
          {filtered.map((tag, i) => (
            <li
              key={tag.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(tag);
              }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex
                  ? "bg-bc-light-lavender/50"
                  : "hover:bg-bc-light-lavender/30"
              }`}
            >
              {tag.kind !== "issue" && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1.5">
                  {tag.kind}
                </span>
              )}
              {tag.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
