import Link from "next/link";
import { auth } from "@/auth";
import { getUserProfileAction } from "@/lib/actions";
import { format } from "date-fns";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const result = await getUserProfileAction();
  const profile = result.success ? result.data! : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif text-2xl text-bc-navy mb-8">Settings</h1>

      <div className="flex flex-col sm:flex-row gap-8">
        {/* Sidebar */}
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

        {/* Content */}
        <div className="flex-1">
          <h2 className="font-serif text-lg text-bc-navy mb-4">Account</h2>

          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="text-bc-navy font-medium mt-0.5">
                @{session?.user.username}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Home district</dt>
              <dd className="text-bc-navy mt-0.5">
                {profile?.homeDistrict?.name ?? (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="text-bc-navy mt-0.5">
                {profile?.createdAt
                  ? format(profile.createdAt, "MMMM d, yyyy")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
