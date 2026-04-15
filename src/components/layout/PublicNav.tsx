import Link from "next/link";
import { auth } from "@/auth";
import { WordMark } from "@/components/brand/WordMark";
import { logout } from "@/lib/actions";

export async function PublicNav() {
  const session = await auth();

  return (
    <nav className="bg-bc-navy border-b border-bc-deep-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <WordMark color="offwhite" size="md" />

        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/how-it-works"
            className="text-bc-lavender hover:text-bc-offwhite transition-colors hidden sm:block"
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="text-bc-lavender hover:text-bc-offwhite transition-colors hidden sm:block"
          >
            About
          </Link>

          {session ? (
            <>
              <Link
                href="/ballot"
                className="text-bc-lavender hover:text-bc-offwhite transition-colors"
              >
                Your ballot
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-bc-lavender hover:text-bc-offwhite transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-bc-lavender hover:text-bc-offwhite transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="bg-bc-blush text-bc-navy text-sm font-medium px-4 py-1.5 rounded hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
