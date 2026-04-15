import Link from "next/link";
import { cn } from "@/lib/utils";

type WordMarkProps = {
  color?: "navy" | "offwhite";
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
};

const sizeClasses = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

const colorClasses = {
  navy: "text-bc-navy",
  offwhite: "text-bc-offwhite",
};

export function WordMark({
  color = "navy",
  size = "md",
  asLink = true,
}: WordMarkProps) {
  const cls = cn(
    "font-serif font-bold tracking-tight",
    sizeClasses[size],
    colorClasses[color]
  );

  if (asLink) {
    return (
      <Link href="/" className={cls}>
        BallotCard
      </Link>
    );
  }

  return <span className={cls}>BallotCard</span>;
}
