"use client";

import { useState } from "react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

/**
 * Simple markdown body formatting for preview.
 * Handles paragraphs, bold, italic, links, and blockquotes.
 * No heavy dependencies — this is intentionally minimal.
 */
function renderMarkdownPreview(text: string): string {
  return text
    .split("\n\n")
    .map((block) => {
      let html = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Bold
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // Italic
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
      // Links
      html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" class="text-bc-navy underline" target="_blank" rel="noopener noreferrer">$1</a>'
      );
      // Blockquotes
      if (html.startsWith("&gt; ")) {
        html = `<blockquote class="border-l-2 border-bc-lavender pl-3 text-muted-foreground">${html.slice(5)}</blockquote>`;
      } else {
        html = `<p>${html}</p>`;
      }

      return html;
    })
    .join("");
}

export function MarkdownEditor({
  value,
  onChange,
  minLength = 10,
  maxLength = 50000,
  placeholder = "Write your post...",
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="rounded-md border border-bc-light-lavender bg-white overflow-hidden">
      <div className="flex border-b border-bc-light-lavender">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "write"
              ? "text-bc-navy border-b-2 border-bc-navy"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "preview"
              ? "text-bc-navy border-b-2 border-bc-navy"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={8}
            maxLength={maxLength}
            className="w-full px-3 py-2 text-sm bg-transparent resize-y outline-none placeholder:text-muted-foreground min-h-[160px]"
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
            {value.length}/{maxLength}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 min-h-[160px] text-sm prose prose-sm max-w-none">
          {value.trim().length === 0 ? (
            <p className="text-muted-foreground italic">Nothing to preview.</p>
          ) : (
            <div
              dangerouslySetInnerHTML={{
                __html: renderMarkdownPreview(value),
              }}
            />
          )}
        </div>
      )}

      {value.length > 0 && value.length < minLength && (
        <p className="px-3 pb-2 text-[10px] text-muted-foreground">
          At least {minLength} characters required ({minLength - value.length}{" "}
          more)
        </p>
      )}
    </div>
  );
}
