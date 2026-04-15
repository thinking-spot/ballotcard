import { cn } from "@/lib/utils";

interface WitnessBadgeProps {
  className?: string;
}

/** Small uppercase "WITNESS" label shown on posts authored by the current Witness. */
export function WitnessBadge({ className }: WitnessBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-bc-navy text-bc-offwhite",
        className
      )}
    >
      Witness
    </span>
  );
}
