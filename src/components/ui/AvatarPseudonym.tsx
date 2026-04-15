import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface AvatarPseudonymProps {
  username: string;
  size?: Size;
  className?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
};

/** Circular avatar showing the first two initials of a pseudonym. */
export function AvatarPseudonym({
  username,
  size = "md",
  className,
}: AvatarPseudonymProps) {
  const initials = username
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full bg-bc-lavender text-bc-navy font-medium flex items-center justify-center flex-shrink-0 select-none",
        sizeClasses[size],
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
