import { format } from "date-fns";
import type { FeaturedLink } from "@/lib/office-data";

interface FeaturedLinkCardProps {
  link: FeaturedLink;
}

export function FeaturedLinkCard({ link }: FeaturedLinkCardProps) {
  if (link.fetchStatus === "failed" || link.fetchStatus === "timeout" || link.fetchStatus === "blocked") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-bc-navy underline underline-offset-2 hover:opacity-70 transition-opacity truncate"
      >
        {link.url}
      </a>
    );
  }

  const domainLabel = link.domain?.replace(/^www\./, "") ?? new URL(link.url).hostname.replace(/^www\./, "");

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-bc-light-lavender bg-bc-offwhite hover:bg-bc-light-lavender/30 transition-colors overflow-hidden no-underline"
    >
      <div className="flex gap-3 p-3">
        {link.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={link.imageUrl}
            alt=""
            className="w-16 h-16 object-cover rounded flex-shrink-0 bg-bc-light-lavender"
          />
        ) : (
          <div className="w-16 h-16 rounded flex-shrink-0 bg-bc-light-lavender flex items-center justify-center text-muted-foreground text-xs text-center p-1">
            {domainLabel}
          </div>
        )}

        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            Featured source · {domainLabel}
          </p>
          {link.title && (
            <p className="text-sm font-medium text-bc-navy leading-snug line-clamp-2">
              {link.title}
            </p>
          )}
          {link.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
              {link.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
