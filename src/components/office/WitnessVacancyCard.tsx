import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";

interface WitnessVacancyCardProps {
  officeHref: string;
}

export function WitnessVacancyCard({ officeHref }: WitnessVacancyCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-700">
          Witness
        </p>
        <StatusPill variant="vacant" />
      </div>

      <p className="text-sm text-bc-navy leading-relaxed">
        No Witness for this office yet. Any resident whose home district covers
        this seat can file a candidacy and run in the next election.
      </p>

      <div className="mt-3 flex gap-3 text-sm">
        <Link
          href={`${officeHref}/election`}
          className="text-bc-navy underline underline-offset-2 hover:opacity-70 transition-opacity"
        >
          See filing timeline
        </Link>
      </div>
    </div>
  );
}
