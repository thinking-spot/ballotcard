import { cn } from "@/lib/utils";

type Variant = "witness" | "vacant" | "election" | "dormant" | "warming";

interface StatusPillProps {
  variant: Variant;
  label?: string;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  witness: "bg-emerald-100 text-emerald-800 border-emerald-200",
  vacant: "bg-amber-100 text-amber-800 border-amber-200",
  election: "bg-blue-100 text-blue-800 border-blue-200",
  dormant: "bg-bc-light-lavender text-muted-foreground border-bc-lavender",
  warming: "bg-bc-light-lavender text-bc-navy border-bc-lavender",
};

const defaultLabels: Record<Variant, string> = {
  witness: "Witness active",
  vacant: "Witness seat vacant",
  election: "Election open",
  dormant: "Not yet on BallotCard",
  warming: "Getting started",
};

/** Small status badge used on office rows and office headers. */
export function StatusPill({ variant, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        variantClasses[variant],
        className
      )}
    >
      {label ?? defaultLabels[variant]}
    </span>
  );
}
