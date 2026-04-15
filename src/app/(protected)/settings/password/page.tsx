import Link from "next/link";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const metadata = { title: "Change password" };

export default function PasswordPage() {
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
            Change password
          </h2>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
