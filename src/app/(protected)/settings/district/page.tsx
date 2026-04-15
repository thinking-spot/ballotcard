import Link from "next/link";
import { getUserProfileAction } from "@/lib/actions";
import { format, addYears } from "date-fns";

export const metadata = { title: "Home district" };

export default async function DistrictSettingsPage() {
  const result = await getUserProfileAction();
  const profile = result.success ? result.data! : null;

  const twoYearsFromNow = profile?.homeDistrictSetAt
    ? addYears(profile.homeDistrictSetAt, 2)
    : null;
  const canChange =
    !profile?.homeDistrictSetAt || new Date() >= (twoYearsFromNow ?? new Date(0));
  const nextEligibleDate = twoYearsFromNow && !canChange
    ? format(twoYearsFromNow, "MMMM d, yyyy")
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif text-2xl text-bc-navy mb-8">Settings</h1>

      <div className="flex flex-col sm:flex-row gap-8">
        <nav className="sm:w-40 flex-shrink-0">
          <ul className="flex flex-col gap-1 text-sm">
            {[
              { href: "/settings", label: "Account" },
              { href: "/settings/district", label: "Home district" },
              { href: "/settings/password", label: "Password" },
              { href: "/settings/delete", label: "Delete account" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block px-2 py-1.5 rounded text-bc-navy hover:bg-bc-light-lavender transition-colors font-medium"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1">
          <h2 className="font-serif text-lg text-bc-navy mb-4">
            Home district
          </h2>

          <dl className="flex flex-col gap-3 text-sm mb-6">
            <div>
              <dt className="text-muted-foreground">Current district</dt>
              <dd className="text-bc-navy font-medium mt-0.5">
                {profile?.homeDistrict?.name ?? (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </dd>
            </div>
            {nextEligibleDate && (
              <div>
                <dt className="text-muted-foreground">
                  Next eligible change date
                </dt>
                <dd className="text-bc-navy mt-0.5">{nextEligibleDate}</dd>
              </div>
            )}
          </dl>

          {canChange ? (
            <p className="text-sm text-muted-foreground">
              District change form coming in a later phase.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can change your home district once every two years. Next
              eligible: {nextEligibleDate}.
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed max-w-sm">
            Your home district determines which Witness elections you can vote
            in and which offices appear on your ballot card. The two-year limit
            aligns with most election cycles.
          </p>
        </div>
      </div>
    </div>
  );
}
