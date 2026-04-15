import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/office-data";

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/** Geographic breadcrumb trail: USA › North Carolina › NC-07 › US House */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="text-bc-light-lavender">›</span>}
            {isLast || !item.href ? (
              <span className={isLast ? "text-bc-navy font-medium" : ""}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-bc-navy transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
