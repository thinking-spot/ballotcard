import Link from "next/link";
import { auth } from "@/auth";
import { getBallotData } from "@/lib/ballot-data";
import type { BallotOffice, BallotLayer } from "@/lib/ballot-data";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Your ballot" };

// ─── Office row ──────────────────────────────────────────────────────────────

function OfficeRow({ office }: { office: BallotOffice }) {
  const href = `/${office.districtGeoSlug}/${office.slug}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2.5 border-b border-bc-light-lavender/60 last:border-b-0">
      {/* Office + official */}
      <div className="flex-1 min-w-0">
        <Link
          href={href}
          className="text-sm font-medium text-bc-navy hover:underline underline-offset-2"
        >
          {office.title}
        </Link>
        {office.officialName && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {office.officialName}
            {office.officialParty && (
              <span className="text-muted-foreground/60">
                {" "}
                ({office.officialParty})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <WitnessStatus office={office} />
        {office.nextElectionAt && (
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            next {new Date(office.nextElectionAt + "T12:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Witness status indicator ────────────────────────────────────────────────

function WitnessStatus({ office }: { office: BallotOffice }) {
  if (office.hasOpenElection) {
    return <StatusPill variant="election" label="Election open" />;
  }

  if (office.witnessUsername) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            office.witnessIsActive ? "bg-emerald-500" : "bg-gray-300"
          }`}
        />
        @{office.witnessUsername}
        {office.watcherCount > 0 && (
          <span className="text-muted-foreground/60">
            · {office.watcherCount} watching
          </span>
        )}
      </span>
    );
  }

  return <StatusPill variant="vacant" />;
}

// ─── Layer card ──────────────────────────────────────────────────────────────

function LayerCard({ layer }: { layer: BallotLayer }) {
  const officeCount = layer.offices.length;

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white">
      {/* Layer header */}
      <div className="px-4 py-3 border-b border-bc-light-lavender/60">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-base text-bc-navy font-bold">
            {layer.label}
          </h2>
          <span className="text-xs text-muted-foreground">
            {officeCount} office{officeCount !== 1 ? "s" : ""} · {layer.districtName}
          </span>
        </div>
      </div>

      {/* Office list */}
      <div className="px-4">
        {layer.offices.map((office) => (
          <OfficeRow key={office.id} office={office} />
        ))}
      </div>
    </div>
  );
}

// ─── Cold-start card ─────────────────────────────────────────────────────────

function ColdStartCard({ homeDistrictName }: { homeDistrictName: string }) {
  return (
    <div className="rounded-lg bg-bc-navy text-bc-offwhite p-6">
      <h2 className="font-serif text-lg mb-3">Start here</h2>
      <p className="text-sm text-bc-lavender mb-4">
        Welcome to BallotCard. Your home district is {homeDistrictName}. Here
        are three things you can do:
      </p>
      <ol className="flex flex-col gap-3 text-sm text-bc-lavender">
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">1.</span>
          <span>
            <span className="text-bc-offwhite font-medium">Watch an office</span>{" "}
            — pick any office on your ballot below and click Watch to see
            activity from that seat.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">2.</span>
          <span>
            <span className="text-bc-offwhite font-medium">Post something</span>{" "}
            — if you have information about what an official is doing, go to
            their office page and post it.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">3.</span>
          <span>
            <span className="text-bc-offwhite font-medium">
              Run for Witness
            </span>{" "}
            — if no one is watching an office, you can file a candidacy and
            become the Witness for that seat.
          </span>
        </li>
      </ol>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BallotPage() {
  const session = await auth();
  if (!session) return null;

  const homeDistrictId = session.user.homeDistrictId;

  // No home district set
  if (!homeDistrictId) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-serif text-2xl text-bc-navy mb-2">
          Your ballot card
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Set your home district to see your ballot.
        </p>
        <Link
          href="/settings/district"
          className="inline-flex items-center justify-center bg-bc-blush text-bc-navy font-medium text-sm px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          Set home district
        </Link>
      </div>
    );
  }

  const data = await getBallotData(homeDistrictId);

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-serif text-2xl text-bc-navy mb-2">
          Your ballot card
        </h1>
        <p className="text-sm text-muted-foreground">
          Could not load your ballot. Your home district may not be activated
          yet.
        </p>
      </div>
    );
  }

  const isColdStart = data.activeWitnesses === 0;
  const vacantCount = data.layers.reduce(
    (sum, l) => sum + l.offices.filter((o) => !o.witnessUsername).length,
    0
  );

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl text-bc-navy font-bold">
            Your ballot card
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.homeDistrictName} · {data.totalOffices} office
            {data.totalOffices !== 1 ? "s" : ""} · {data.activeWitnesses} active
            Witness{data.activeWitnesses !== 1 ? "es" : ""}
          </p>
        </div>

        {/* Cold-start onboarding */}
        {isColdStart && (
          <div className="mb-6">
            <ColdStartCard homeDistrictName={data.homeDistrictName} />
          </div>
        )}

        {/* Layer cards */}
        <div className="flex flex-col gap-4">
          {data.layers.map((layer) => (
            <LayerCard key={layer.label} layer={layer} />
          ))}
        </div>

        {/* Empty state */}
        {data.layers.length === 0 && (
          <div className="rounded-lg border border-bc-light-lavender bg-white p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No offices on BallotCard yet for your district. Offices are added
              as residents activate them.
            </p>
          </div>
        )}

        {/* Vacant seats banner */}
        {vacantCount > 0 && !isColdStart && (
          <div className="mt-6 rounded-lg bg-bc-navy text-bc-offwhite p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-bc-lavender">
              {vacantCount} office{vacantCount !== 1 ? "s" : ""} on your ballot{" "}
              {vacantCount !== 1 ? "have" : "has"} no Witness yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
