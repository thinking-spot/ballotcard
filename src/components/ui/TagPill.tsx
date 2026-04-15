import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagPillProps {
  label: string;
  href?: string;
  className?: string;
}

/** Read-only tag chip. Wrap in a link when href is provided. */
export function TagPill({ label, href, className }: TagPillProps) {
  const classes = cn(
    "inline-flex items-center px-2 py-0.5 rounded-sm text-xs text-bc-navy bg-bc-light-lavender hover:bg-bc-lavender/40 transition-colors",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {label}
      </Link>
    );
  }
  return <span className={classes}>{label}</span>;
}
