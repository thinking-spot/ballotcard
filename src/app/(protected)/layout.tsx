import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WordMark } from "@/components/brand/WordMark";
import { Footer } from "@/components/layout/Footer";
import { logout } from "@/lib/actions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <nav className="bg-bc-navy border-b border-bc-deep-navy">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <WordMark color="offwhite" size="md" />

          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/ballot"
              className="text-bc-lavender hover:text-bc-offwhite transition-colors"
            >
              Your ballot
            </Link>
            <Link
              href="/settings"
              className="text-bc-lavender hover:text-bc-offwhite transition-colors"
            >
              Settings
            </Link>
            <span className="text-bc-lavender opacity-50 hidden sm:inline">
              @{session.user.username}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-bc-lavender hover:text-bc-offwhite transition-colors cursor-pointer"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <Footer />
    </>
  );
}
