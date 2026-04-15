import { format, formatDistanceToNow } from "date-fns";
import { AvatarPseudonym } from "@/components/ui/AvatarPseudonym";
import type { WitnessData } from "@/lib/office-data";

interface WitnessCardProps {
  witness: WitnessData;
}

export function WitnessCard({ witness }: WitnessCardProps) {
  // Append T12:00:00 so date-only strings parse as local noon, not UTC midnight
  // (UTC midnight on March 1 renders as Feb 28 in US timezones).
  const termEnd = new Date(witness.termEnd + "T12:00:00");
  const termStart = new Date(witness.termStart + "T12:00:00");

  const electedLabel = format(termStart, "MMM yyyy");
  const termEndLabel = format(termEnd, "MMM yyyy");

  const meta = [
    `Term ends ${termEndLabel}`,
    `${witness.postCount} post${witness.postCount !== 1 ? "s" : ""}`,
    `${witness.watcherCount} watching`,
  ].join(" · ");

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
        Witness · Elected {electedLabel}
      </p>

      <div className="flex items-start gap-3">
        <AvatarPseudonym username={witness.username} size="lg" />

        <div className="min-w-0">
          <p className="font-medium text-bc-navy text-sm leading-tight">
            @{witness.username}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
        </div>
      </div>

      {witness.statement && (
        <blockquote className="mt-3 text-sm text-bc-navy/80 italic border-l-2 border-bc-light-lavender pl-3 leading-relaxed">
          "{witness.statement}"
        </blockquote>
      )}
    </div>
  );
}
